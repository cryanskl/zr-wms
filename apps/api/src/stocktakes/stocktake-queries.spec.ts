import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildApplyStocktakeLineQuery,
  buildCreateStocktakeLineQuery,
  buildCreateStocktakeQuery,
} from './stocktake-queries';
import { StocktakesService } from './stocktakes.service';

const { queryMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
}));

vi.mock('../database', () => ({
  queryDatabase: queryMock,
}));

beforeEach(() => {
  queryMock.mockReset();
});

describe('stocktake query builders', () => {
  it('creates stocktake documents and applies adjustments only through the stored procedure', () => {
    const sql = [
      buildCreateStocktakeQuery().text,
      buildCreateStocktakeLineQuery().text,
      buildApplyStocktakeLineQuery().text,
    ].join('\n');

    expect(sql).toContain('INSERT INTO stocktake');
    expect(sql).toContain('INSERT INTO stocktake_line');
    expect(sql).toContain('FROM inventory');
    expect(sql).toContain('op_apply_stocktake_line');
    expect(sql).toContain('$2::bigint');
    expect(sql).not.toMatch(/\b(UPDATE|DELETE\s+FROM)\s+(inventory|stock_movement)\b/i);
    expect(sql).not.toMatch(/\b(inventory|stock_movement)\s+SET\b/i);
  });
});

describe('stocktakes service', () => {
  it('creates a stocktake with the current JWT user as created_by', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [
        {
          stocktake_id: '11',
          warehouse_id: 'W1',
          status: 'COUNTING',
          created_by: '42',
          created_at: '2026-06-28T00:00:00.000Z',
        },
      ],
    });

    await expect(new StocktakesService().create({ warehouse_id: 'w1', created_by: 999 }, 42)).resolves.toEqual({
      stocktake_id: 11,
      warehouse_id: 'W1',
      status: 'COUNTING',
      created_by: 42,
      created_at: '2026-06-28T00:00:00.000Z',
      lines: [],
    });

    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO stocktake'), ['W1', 'COUNTING', 42]);
  });

  it('adds a counted line with a system quantity snapshot from inventory', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [
        {
          stline_id: '21',
          stocktake_id: '11',
          product_id: 'RM-001',
          slot_id: '5',
          batch_id: null,
          system_qty: '25.0000',
          counted_qty: '33.0000',
          diff: '8.0000',
          adj_movement_id: null,
        },
      ],
    });

    await expect(
      new StocktakesService().addLine('11', {
        product_id: 'rm-001',
        slot_id: 5,
        counted_qty: 33,
        batch_id: '',
      }),
    ).resolves.toEqual({
      stline_id: 21,
      stocktake_id: 11,
      product_id: 'RM-001',
      slot_id: 5,
      batch_id: null,
      system_qty: 25,
      counted_qty: 33,
      diff: 8,
      adj_movement_id: null,
    });

    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO stocktake_line'), [
      '11',
      'RM-001',
      '5',
      null,
      33,
    ]);
  });

  it('applies a counted line by calling op_apply_stocktake_line with the current JWT user id', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ movement_id: '31' }] });

    await expect(new StocktakesService().applyLine('21', 42)).resolves.toEqual({ stline_id: 21, movement_id: 31 });

    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining('op_apply_stocktake_line'), ['21', 42]);
  });

  it('returns null movement id when counted quantity already matches current stock', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ movement_id: null }] });

    await expect(new StocktakesService().applyLine('21', 42)).resolves.toEqual({ stline_id: 21, movement_id: null });
  });

  it('maps stocktake business errors to 409 and rejects invalid ids before querying postgres', async () => {
    queryMock.mockRejectedValueOnce({ code: 'P0001', message: '盘点明细 21 已生成过调整单' });

    await expect(new StocktakesService().applyLine('21', 42)).rejects.toThrow(ConflictException);
    await expect(new StocktakesService().applyLine('abc', 42)).rejects.toThrow(NotFoundException);
    await expect(new StocktakesService().addLine('11', { product_id: 'RM-001', slot_id: 5, counted_qty: -1 })).rejects.toThrow(
      BadRequestException,
    );
  });
});

describe('stocktakes controller contract', () => {
  it('requires admin role for apply endpoints', async () => {
    const { StocktakesController } = await import('./stocktakes.controller');
    const controller = new StocktakesController(new StocktakesService());

    expect(() => controller.applyLine('21', { user: { userId: 42, name: 'operator', role: 'OPERATOR' } })).toThrow(
      ForbiddenException,
    );
  });
});
