import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildCreateOrderQuery,
  buildInsertOrderLineQuery,
  buildOrderDetailQuery,
  buildOrderListQuery,
  buildUpdateOrderHeaderQuery,
} from './order-queries';
import { OrdersService } from './orders.service';

const { queryMock, connectMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
  connectMock: vi.fn(),
}));

vi.mock('../database', () => ({
  queryDatabase: queryMock,
  pool: {
    connect: connectMock,
  },
}));

beforeEach(() => {
  queryMock.mockReset();
  connectMock.mockReset();
});

describe('order query builders', () => {
  it('builds order skeleton queries without touching inventory, stock movement, reservations, or MRP', () => {
    const detailQueries = buildOrderDetailQuery();
    const sql = [
      buildOrderListQuery().text,
      buildCreateOrderQuery().text,
      buildInsertOrderLineQuery().text,
      detailQueries.header.text,
      detailQueries.lines.text,
      buildUpdateOrderHeaderQuery().text,
    ].join('\n');

    expect(sql).toContain('FROM order_doc');
    expect(sql).toContain('INSERT INTO order_doc');
    expect(sql).toContain('INSERT INTO order_line');
    expect(sql).toContain('UPDATE order_doc');
    expect(sql).not.toMatch(/\b(UPDATE|DELETE\s+FROM)\s+(inventory|stock_movement)\b/i);
    expect(sql).not.toMatch(/\b(inventory|stock_movement)\s+SET\b/i);
    expect(sql).not.toMatch(/\b(reservation|op_inbound|op_outbound|fn_order_mrp)\b/i);
  });

  it('keeps order list filters on order_type and status', () => {
    const sql = buildOrderListQuery().text;

    expect(sql).toContain('($1::text IS NULL OR order_doc.order_type = $1)');
    expect(sql).toContain('($2::text IS NULL OR order_doc.status = $2)');
    expect(sql).toContain('ORDER BY order_doc.created_at DESC, order_doc.order_id DESC');
  });
});

describe('orders service', () => {
  it('creates an order in one transaction and uses the current user as created_by', async () => {
    const client = makeClient();
    connectMock.mockResolvedValue(client);
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            order_id: '9',
            order_type: 'PURCHASE',
            partner: '供应商 A',
            due_date: '2026-07-01',
            status: 'PENDING',
            created_by: '42',
            created_at: '2026-06-28T00:00:00.000Z',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            order_line_id: '21',
            order_id: '9',
            product_id: 'RM-001',
            qty: '3.5000',
            qty_done: '0',
            line_status: 'PENDING',
          },
        ],
      });
    queryMock
      .mockResolvedValueOnce({
        rows: [
          {
            order_id: '9',
            order_type: 'PURCHASE',
            partner: '供应商 A',
            due_date: '2026-07-01',
            status: 'PENDING',
            created_by: '42',
            created_at: '2026-06-28T00:00:00.000Z',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            order_line_id: '21',
            order_id: '9',
            product_id: 'RM-001',
            product_name: '测试原料',
            qty: '3.5000',
            qty_done: '0',
            line_status: 'PENDING',
          },
        ],
      });

    const result = await new OrdersService().create(
      {
        order_type: 'PURCHASE',
        partner: '供应商 A',
        due_date: '2026-07-01',
        created_by: 999,
        lines: [{ product_id: 'RM-001', qty: 3.5 }],
      },
      42,
    );

    expect(result.order_id).toBe(9);
    expect(client.query).toHaveBeenNthCalledWith(1, 'BEGIN');
    expect(client.query.mock.calls).toContainEqual(['COMMIT']);
    expect(client.query.mock.calls).toContainEqual([expect.stringContaining('INSERT INTO order_doc'), [
      'PURCHASE',
      '供应商 A',
      '2026-07-01',
      'PENDING',
      42,
    ]]);
  });

  it('rejects line_status values that do not belong to the order type', async () => {
    await expect(
      new OrdersService().create(
        {
          order_type: 'PURCHASE',
          lines: [{ product_id: 'RM-001', qty: 1, line_status: 'IN_PRODUCTION' }],
        },
        42,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects invalid order ids before querying postgres', async () => {
    await expect(new OrdersService().detail('abc')).rejects.toThrow(NotFoundException);
    expect(queryMock).not.toHaveBeenCalled();
  });
});

function makeClient() {
  return {
    query: vi.fn(),
    release: vi.fn(),
  };
}
