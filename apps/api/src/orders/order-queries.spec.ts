import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildCreateOrderQuery,
  buildInsertOrderLineQuery,
  buildOrderDetailQuery,
  buildOrderListQuery,
  buildOrderMrpQuery,
  buildReceiveInboundQuery,
  buildReceiveOrderLineQuery,
  buildUpdateReceivedOrderLineQuery,
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

  it('builds receive and MRP queries through database routines without direct inventory writes', () => {
    const sql = [
      buildReceiveOrderLineQuery().text,
      buildReceiveInboundQuery().text,
      buildUpdateReceivedOrderLineQuery().text,
      buildOrderMrpQuery().text,
    ].join('\n');

    expect(sql).toContain('FOR UPDATE');
    expect(sql).toContain('op_inbound');
    expect(sql).toContain('$9::bigint');
    expect(sql).toContain('$10::bigint');
    expect(sql).toContain('UPDATE order_line');
    expect(sql).toContain('fn_order_mrp');
    expect(sql).not.toMatch(/\b(UPDATE|DELETE\s+FROM)\s+(inventory|stock_movement)\b/i);
    expect(sql).not.toMatch(/\b(inventory|stock_movement)\s+SET\b/i);
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

  it('receives a purchase line by calling op_inbound with order id and current JWT user id', async () => {
    const client = makeClient();
    connectMock.mockResolvedValue(client);
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            order_line_id: '21',
            order_id: '9',
            order_type: 'PURCHASE',
            product_id: 'RM-001',
            qty: '10',
            qty_done: '4',
            line_status: 'PARTIAL_RECEIVED',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ movement_id: '55' }] })
      .mockResolvedValueOnce({
        rows: [
          {
            order_line_id: '21',
            order_id: '9',
            product_id: 'RM-001',
            qty: '10',
            qty_done: '7',
            line_status: 'PARTIAL_RECEIVED',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });

    await expect(
      new OrdersService().receive(
        '9',
        {
          order_line_id: 21,
          product_id: 'rm-001',
          warehouse_id: 'W1',
          slot_id: 5,
          qty: 3,
          batch_id: '',
          reason: '采购到货',
        },
        42,
      ),
    ).resolves.toEqual({
      movement_id: 55,
      order_line_id: 21,
      qty_done: 7,
      line_status: 'PARTIAL_RECEIVED',
    });

    expect(client.query.mock.calls).toContainEqual([
      expect.stringContaining('op_inbound'),
      ['RM-001', 'W1', 3, '5', null, 'GOOD', 'IN', '采购到货', '9', 42],
    ]);
    expect(client.query.mock.calls).toContainEqual(['COMMIT']);
  });

  it('rejects over-receiving before calling op_inbound', async () => {
    const client = makeClient();
    connectMock.mockResolvedValue(client);
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            order_line_id: '21',
            order_id: '9',
            order_type: 'PURCHASE',
            product_id: 'RM-001',
            qty: '10',
            qty_done: '9',
            line_status: 'PARTIAL_RECEIVED',
          },
        ],
      });

    await expect(
      new OrdersService().receive(
        '9',
        {
          order_line_id: 21,
          product_id: 'RM-001',
          warehouse_id: 'W1',
          slot_id: 5,
          qty: 2,
        },
        42,
      ),
    ).rejects.toThrow(ConflictException);

    expect(client.query.mock.calls.flat().join('\n')).not.toContain('op_inbound');
    expect(client.query.mock.calls).toContainEqual(['ROLLBACK']);
  });

  it('gets MRP rows from fn_order_mrp and maps numeric fields', async () => {
    queryMock
      .mockResolvedValueOnce({
        rows: [
          {
            order_id: '9',
            order_type: 'PRODUCTION',
            partner: '客户 A',
            due_date: null,
            status: 'PENDING',
            created_by: '42',
            created_at: '2026-06-28T00:00:00.000Z',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            product_id: 'RM-001',
            ptype: 'RM',
            lvl: '2',
            gross_demand: '8.5000',
            on_hand: '3.0000',
            net_required: '5.5000',
          },
        ],
      });

    await expect(new OrdersService().mrp('9')).resolves.toEqual([
      {
        product_id: 'RM-001',
        ptype: 'RM',
        lvl: 2,
        gross_demand: 8.5,
        on_hand: 3,
        net_required: 5.5,
      },
    ]);
    expect(queryMock).toHaveBeenLastCalledWith(expect.stringContaining('fn_order_mrp'), ['9']);
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
