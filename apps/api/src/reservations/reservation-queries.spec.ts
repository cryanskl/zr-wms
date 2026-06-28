import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildFulfillReservationQuery,
  buildOrderReservationsQuery,
  buildReleaseReservationQuery,
  buildReserveQuery,
} from './reservation-queries';
import { ReservationsService } from './reservations.service';

const { queryMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
}));

vi.mock('../database', () => ({
  queryDatabase: queryMock,
}));

beforeEach(() => {
  queryMock.mockReset();
});

describe('reservation query builders', () => {
  it('builds reservation write queries that only call op_* procedures', () => {
    const sql = [
      buildReserveQuery().text,
      buildFulfillReservationQuery().text,
      buildReleaseReservationQuery().text,
    ].join('\n');

    expect(sql).toContain('op_reserve');
    expect(sql).toContain('op_fulfill_reservation');
    expect(sql).toContain('op_release_reservation');
    expect(sql).not.toMatch(/\b(INSERT|UPDATE|DELETE\s+FROM)\s+(inventory|stock_movement|reservation)\b/i);
    expect(sql).not.toMatch(/\b(inventory|stock_movement|reservation)\s+SET\b/i);
  });

  it('builds an order reservation detail query with product, slot, and warehouse context', () => {
    const sql = buildOrderReservationsQuery().text;

    expect(sql).toContain('FROM reservation');
    expect(sql).toContain('JOIN product');
    expect(sql).toContain('JOIN slot');
    expect(sql).toContain('JOIN warehouse');
    expect(sql).toContain('WHERE reservation.order_id = $1::bigint');
    expect(sql).toContain('reservation.reservation_id::text');
    expect(sql).toContain('product.name AS product_name');
    expect(sql).toContain('slot.code AS slot_code');
    expect(sql).toContain('slot.warehouse_id');
    expect(sql).not.toMatch(/\b(INSERT|UPDATE|DELETE\s+FROM)\b/i);
  });
});

describe('reservations service', () => {
  it('reserves inventory by calling op_reserve with the current JWT user id', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ reservation_id: '17' }] });

    const result = await new ReservationsService().reserve(
      {
        order_id: 9,
        product_id: 'rm-001',
        slot_id: 5,
        qty: '2.5',
        batch_id: '',
        operator: 999,
      },
      42,
    );

    expect(result).toEqual({ reservation_id: 17 });
    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining('op_reserve'), ['9', 'RM-001', '5', 2.5, null, 42]);
  });

  it('fulfills and releases reservations with the current JWT user id', async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ movement_id: '31' }] })
      .mockResolvedValueOnce({ rows: [{ released: true }] });

    await expect(new ReservationsService().fulfill('17', 42)).resolves.toEqual({ movement_id: 31 });
    await expect(new ReservationsService().release('17', 42)).resolves.toEqual({ reservation_id: 17 });

    expect(queryMock).toHaveBeenNthCalledWith(1, expect.stringContaining('op_fulfill_reservation'), ['17', 42]);
    expect(queryMock).toHaveBeenNthCalledWith(2, expect.stringContaining('op_release_reservation'), ['17', 42]);
  });

  it('lists order reservations and maps numeric ids and quantities', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [
        {
          reservation_id: '17',
          order_id: '9',
          product_id: 'RM-001',
          product_name: '测试原料',
          slot_id: '5',
          slot_code: 'A-01-01',
          warehouse_id: 'WH-A',
          batch_id: '3',
          qty: '2.5000',
          status: 'RESERVED',
          version: '0',
          created_at: '2026-06-28T00:00:00.000Z',
        },
      ],
    });

    await expect(new ReservationsService().listForOrder('9')).resolves.toEqual([
      {
        reservation_id: 17,
        order_id: 9,
        product_id: 'RM-001',
        product_name: '测试原料',
        slot_id: 5,
        slot_code: 'A-01-01',
        warehouse_id: 'WH-A',
        batch_id: 3,
        qty: 2.5,
        status: 'RESERVED',
        version: 0,
        created_at: '2026-06-28T00:00:00.000Z',
      },
    ]);
  });

  it('maps stored procedure business errors to 409 with Chinese messages', async () => {
    queryMock.mockRejectedValueOnce({
      code: '23514',
      message: '预留失败：该库位可用 1.0000, 需预留 2.0000（已被其他订单占用或库存不足）',
    });

    await expect(
      new ReservationsService().reserve(
        {
          order_id: 9,
          product_id: 'RM-001',
          slot_id: 5,
          qty: 2,
        },
        42,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('maps missing reservation procedure errors to 404', async () => {
    queryMock.mockRejectedValueOnce({
      code: 'P0001',
      message: '预留 999 不存在',
    });

    await expect(new ReservationsService().fulfill('999', 42)).rejects.toThrow(NotFoundException);
  });

  it('rejects invalid ids and quantities before querying postgres', async () => {
    await expect(new ReservationsService().fulfill('abc', 42)).rejects.toThrow(NotFoundException);
    await expect(new ReservationsService().listForOrder('abc')).rejects.toThrow(NotFoundException);
    await expect(
      new ReservationsService().reserve(
        {
          order_id: 9,
          product_id: 'RM-001',
          slot_id: 5,
          qty: 0,
        },
        42,
      ),
    ).rejects.toThrow(BadRequestException);
    expect(queryMock).not.toHaveBeenCalled();
  });
});
