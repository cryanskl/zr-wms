import { describe, expect, it } from 'vitest';
import { beforeEach, vi } from 'vitest';
import {
  buildBomQuery,
  buildDeleteBomLinesQuery,
  buildInsertBomLineQuery,
  buildMaxProducibleDeepQuery,
  buildMaxProducibleQuery,
  buildPathAliasesQuery,
  buildRegeneratePathAliasesQuery,
  buildWhereUsedQuery,
} from './bom-queries';
import { ProductsService } from './products.service';

const { queryMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
}));

vi.mock('../database', () => ({
  queryDatabase: queryMock,
  pool: null,
}));

beforeEach(() => {
  queryMock.mockReset();
});

describe('BOM query builders', () => {
  it('regenerates path aliases and delegates where-used to database functions', () => {
    const sql = [
      buildBomQuery().text,
      buildDeleteBomLinesQuery().text,
      buildInsertBomLineQuery().text,
      buildRegeneratePathAliasesQuery().text,
      buildWhereUsedQuery().text,
      buildPathAliasesQuery().text,
    ].join('\n');

    expect(sql).toContain('fn_regen_path_aliases');
    expect(sql).toContain('fn_where_used');
    expect(sql).toContain('bom_line');
    expect(sql).not.toMatch(/\b(UPDATE|DELETE\s+FROM)\s+(inventory|stock_movement)\b/i);
    expect(sql).not.toMatch(/\b(inventory|stock_movement)\s+SET\b/i);
  });

  it('delegates producible calculations to database functions without direct inventory writes', () => {
    const sql = [buildMaxProducibleQuery().text, buildMaxProducibleDeepQuery().text].join('\n');

    expect(sql).toContain('fn_max_producible');
    expect(sql).toContain('fn_max_producible_deep');
    expect(sql).toContain('$2::boolean');
    expect(sql).not.toMatch(/\b(INSERT|UPDATE|DELETE\s+FROM)\s+(inventory|stock_movement)\b/i);
    expect(sql).not.toMatch(/\b(inventory|stock_movement)\s+SET\b/i);
  });
});

describe('producible service', () => {
  it('maps single-level producible rows to API response fields', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [
        {
          target: 'FG-1',
          max_make: '7',
          limiting_product: 'ACC-1',
          limiting_on_hand: '7.0000',
        },
      ],
    });

    await expect(new ProductsService().producible('FG-1', undefined, undefined)).resolves.toEqual({
      target: 'FG-1',
      maxMake: 7,
      limiting: 'ACC-1',
      limitingOnHand: 7,
    });

    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining('fn_max_producible'), ['FG-1']);
  });

  it('maps deep producible rows and passes useSfStock=false to the database function', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [
        {
          target: 'FG-1',
          max_make: '5',
          limiting_product: 'RM-1',
          limiting_on_hand: '10.0000',
          limiting_demand: '12.0000',
        },
      ],
    });

    await expect(new ProductsService().producible('FG-1', 'true', 'false')).resolves.toEqual({
      target: 'FG-1',
      maxMake: 5,
      limiting: 'RM-1',
      limitingOnHand: 10,
      limitingDemand: 12,
    });

    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining('fn_max_producible_deep'), ['FG-1', false]);
  });
});
