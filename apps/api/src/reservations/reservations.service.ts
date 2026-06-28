import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { queryDatabase } from '../database';
import { mapPgConcurrencyError } from '../db-errors';
import {
  buildFulfillReservationQuery,
  buildOrderReservationsQuery,
  buildReleaseReservationQuery,
  buildReserveQuery,
} from './reservation-queries';

export interface CreateReservationBody {
  order_id?: number | string;
  product_id?: string;
  slot_id?: number | string;
  qty?: number | string;
  batch_id?: number | string | null;
  operator?: unknown;
}

interface ReservationIdRow {
  reservation_id: string;
}

interface MovementIdRow {
  movement_id: string;
}

interface ReservationDetailRow {
  reservation_id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  slot_id: string;
  slot_code: string;
  warehouse_id: string;
  batch_id: string | null;
  qty: string;
  status: string;
  version: string;
  created_at: string;
}

@Injectable()
export class ReservationsService {
  async reserve(body: CreateReservationBody, operatorId: number) {
    const orderId = requireBigintText(body.order_id, '订单不存在');
    const productId = requireProductId(body.product_id);
    const slotId = requireBigintText(body.slot_id, '库位不存在');
    const qty = requirePositiveNumber(body.qty, '预留数量必须 > 0');
    const batchId = nullableBigintText(body.batch_id, '批次不存在');

    try {
      const result = await queryDatabase<ReservationIdRow>(buildReserveQuery().text, [
        orderId,
        productId,
        slotId,
        qty,
        batchId,
        operatorId,
      ]);
      return { reservation_id: Number(result.rows[0].reservation_id) };
    } catch (error) {
      mapReservationError(error);
    }
  }

  async fulfill(reservationId: string, operatorId: number) {
    const normalizedReservationId = requireReservationId(reservationId);

    try {
      const result = await queryDatabase<MovementIdRow>(buildFulfillReservationQuery().text, [
        normalizedReservationId,
        operatorId,
      ]);
      return { movement_id: Number(result.rows[0].movement_id) };
    } catch (error) {
      mapReservationError(error);
    }
  }

  async release(reservationId: string, operatorId: number) {
    const normalizedReservationId = requireReservationId(reservationId);

    try {
      await queryDatabase(buildReleaseReservationQuery().text, [normalizedReservationId, operatorId]);
      return { reservation_id: Number(normalizedReservationId) };
    } catch (error) {
      mapReservationError(error);
    }
  }

  async listForOrder(orderId: string) {
    const normalizedOrderId = requireOrderId(orderId);
    const result = await queryDatabase<ReservationDetailRow>(buildOrderReservationsQuery().text, [normalizedOrderId]);
    return result.rows.map(mapReservationDetailRow);
  }
}

function mapReservationDetailRow(row: ReservationDetailRow) {
  return {
    reservation_id: Number(row.reservation_id),
    order_id: Number(row.order_id),
    product_id: row.product_id,
    product_name: row.product_name,
    slot_id: Number(row.slot_id),
    slot_code: row.slot_code,
    warehouse_id: row.warehouse_id,
    batch_id: row.batch_id === null ? null : Number(row.batch_id),
    qty: Number(row.qty),
    status: row.status,
    version: Number(row.version),
    created_at: row.created_at,
  };
}

function requireProductId(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new BadRequestException('产品不能为空');
  }
  return value.trim().toUpperCase();
}

function requireOrderId(value: unknown) {
  try {
    return requireBigintText(value, '订单不存在');
  } catch (error) {
    if (error instanceof BadRequestException) {
      throw new NotFoundException('订单不存在');
    }
    throw error;
  }
}

function requireReservationId(value: unknown) {
  try {
    return requireBigintText(value, '预留不存在');
  } catch (error) {
    if (error instanceof BadRequestException) {
      throw new NotFoundException('预留不存在');
    }
    throw error;
  }
}

function requireBigintText(value: unknown, message: string) {
  const text = String(value ?? '');
  if (!/^\d+$/.test(text)) {
    throw new BadRequestException(message);
  }
  return text;
}

function nullableBigintText(value: unknown, message: string) {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  return requireBigintText(value, message);
}

function requirePositiveNumber(value: unknown, message: string) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    throw new BadRequestException(message);
  }
  return numberValue;
}

function mapReservationError(error: unknown): never {
  if (
    error instanceof BadRequestException ||
    error instanceof ConflictException ||
    error instanceof NotFoundException
  ) {
    throw error;
  }

  const pgError = error as { code?: string; message?: string };
  if (pgError.code === 'P0001' && pgError.message?.includes('不存在')) {
    throw new NotFoundException(pgError.message);
  }
  if (pgError.code === '23514' || pgError.code === 'P0001') {
    throw new ConflictException(pgError.message ?? '预留操作冲突');
  }
  if (pgError.code === '23503') {
    throw new NotFoundException('订单、产品、库位或批次不存在');
  }
  if (pgError.code === '22P02') {
    throw new BadRequestException(pgError.message ?? '预留参数不合法');
  }

  try {
    mapPgConcurrencyError(error);
  } catch (mapped) {
    if (mapped !== error) throw mapped;
  }

  throw new InternalServerErrorException('预留操作失败');
}
