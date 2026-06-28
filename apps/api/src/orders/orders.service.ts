import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { pool, queryDatabase } from '../database';
import { mapPgConcurrencyError } from '../db-errors';
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

type OrderType = 'PURCHASE' | 'PRODUCTION';

type PurchaseLineStatus = 'PENDING' | 'PARTIAL_RECEIVED' | 'RECEIVED' | 'DONE' | 'CANCELLED';
type ProductionLineStatus = 'PENDING' | 'SHORTAGE' | 'PICKED' | 'IN_PRODUCTION' | 'PRODUCED' | 'CANCELLED';
type OrderLineStatus = PurchaseLineStatus | ProductionLineStatus;

const purchaseLineStatuses = new Set<OrderLineStatus>(['PENDING', 'PARTIAL_RECEIVED', 'RECEIVED', 'DONE', 'CANCELLED']);
const productionLineStatuses = new Set<OrderLineStatus>([
  'PENDING',
  'SHORTAGE',
  'PICKED',
  'IN_PRODUCTION',
  'PRODUCED',
  'CANCELLED',
]);

export interface OrderLineBody {
  product_id?: string;
  qty?: number | string;
  line_status?: string;
}

export interface CreateOrderBody {
  order_type?: string;
  partner?: string | null;
  due_date?: string | null;
  status?: string;
  created_by?: unknown;
  lines?: OrderLineBody[];
}

export interface PatchOrderBody {
  partner?: string | null;
  due_date?: string | null;
  status?: string;
}

export interface ReceiveOrderBody {
  order_line_id?: number | string;
  product_id?: string;
  warehouse_id?: string;
  slot_id?: number | string | null;
  qty?: number | string;
  batch_id?: number | string | null;
  quality?: string;
  type?: string;
  reason?: string | null;
}

interface OrderRow {
  order_id: string;
  order_type: OrderType;
  partner: string | null;
  due_date: string | null;
  status: string;
  created_by: string | null;
  created_at: string;
}

interface OrderListRow extends OrderRow {
  line_count: string;
  total_qty: string;
  total_done: string;
}

interface OrderLineRow {
  order_line_id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  qty: string;
  qty_done: string;
  line_status: OrderLineStatus;
}

interface ReceiveOrderLineRow {
  order_line_id: string;
  order_id: string;
  order_type: OrderType;
  product_id: string;
  qty: string;
  qty_done: string;
  line_status: OrderLineStatus;
}

interface ReceivedOrderLineRow {
  order_line_id: string;
  order_id: string;
  product_id: string;
  qty: string;
  qty_done: string;
  line_status: OrderLineStatus;
}

interface MovementRow {
  movement_id: string;
}

interface OrderMrpRow {
  product_id: string;
  ptype: string;
  lvl: string;
  gross_demand: string;
  on_hand: string;
  net_required: string;
}

@Injectable()
export class OrdersService {
  async list(filters: { type?: string; status?: string }) {
    const orderType = filters.type ? requireOrderType(filters.type) : null;
    const status = optionalNonEmptyText(filters.status);
    const result = await queryDatabase<OrderListRow>(buildOrderListQuery().text, [orderType, status]);
    return result.rows.map(mapOrderListRow);
  }

  async create(body: CreateOrderBody, operatorId: number) {
    const orderType = requireOrderType(body.order_type);
    const partner = nullableText(body.partner);
    const dueDate = nullableText(body.due_date);
    const status = optionalNonEmptyText(body.status) ?? 'PENDING';
    const lines = normalizeOrderLines(orderType, body.lines);

    if (!pool) {
      throw new Error('DATABASE_URL is not set');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const orderResult = await client.query<OrderRow>(buildCreateOrderQuery().text, [
        orderType,
        partner,
        dueDate,
        status,
        operatorId,
      ]);
      const order = orderResult.rows[0];

      for (const line of lines) {
        await client.query<OrderLineRow>(buildInsertOrderLineQuery().text, [
          order.order_id,
          line.product_id,
          line.qty,
          line.line_status,
        ]);
      }

      await client.query('COMMIT');
      return this.detail(order.order_id);
    } catch (error) {
      await client.query('ROLLBACK');
      mapOrderError(error);
    } finally {
      client.release();
    }
  }

  async detail(orderId: string) {
    const normalizedOrderId = requireOrderId(orderId);
    const queries = buildOrderDetailQuery();
    const headerResult = await queryDatabase<OrderRow>(queries.header.text, [normalizedOrderId]);
    const header = headerResult.rows[0];
    if (!header) {
      throw new NotFoundException('订单不存在');
    }

    const linesResult = await queryDatabase<OrderLineRow>(queries.lines.text, [normalizedOrderId]);
    return {
      ...mapOrderRow(header),
      lines: linesResult.rows.map(mapOrderLineRow),
    };
  }

  async update(orderId: string, body: PatchOrderBody) {
    const normalizedOrderId = requireOrderId(orderId);
    const current = await this.detail(normalizedOrderId);
    const status = body.status === undefined ? current.status : requirePatchStatus(body.status);
    const partner = body.partner === undefined ? current.partner : nullableText(body.partner);
    const dueDate = body.due_date === undefined ? current.due_date : nullableText(body.due_date);

    try {
      const result = await queryDatabase<OrderRow>(buildUpdateOrderHeaderQuery().text, [normalizedOrderId, partner, dueDate, status]);
      if (!result.rows[0]) {
        throw new NotFoundException('订单不存在');
      }
      return this.detail(normalizedOrderId);
    } catch (error) {
      mapOrderError(error);
    }
  }

  async receive(orderId: string, body: ReceiveOrderBody, operatorId: number) {
    const normalizedOrderId = requireOrderId(orderId);
    const orderLineId = requireOrderId(body.order_line_id);
    const productId = requireText(body.product_id, '到货产品不能为空').toUpperCase();
    const warehouseId = requireText(body.warehouse_id, '到货仓库不能为空').toUpperCase();
    const slotId = requireBigint(body.slot_id, '到货库位不能为空');
    const qty = requirePositiveNumber(body.qty, '到货数量必须大于 0');
    const batchId = nullableBigint(body.batch_id);
    const quality = optionalText(body.quality, 'GOOD');
    const movementType = optionalText(body.type, 'IN');
    const reason = nullableText(body.reason) ?? '采购到货';

    if (!pool) {
      throw new Error('DATABASE_URL is not set');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const lineResult = await client.query<ReceiveOrderLineRow>(buildReceiveOrderLineQuery().text, [
        normalizedOrderId,
        orderLineId,
      ]);
      const line = lineResult.rows[0];

      if (!line) {
        throw new NotFoundException('订单明细不存在');
      }
      if (line.order_type !== 'PURCHASE') {
        throw new BadRequestException('只有采购单可以到货入库');
      }
      if (line.product_id !== productId) {
        throw new BadRequestException('到货产品必须匹配订单明细');
      }
      if (line.line_status === 'CANCELLED') {
        throw new ConflictException('已取消的采购明细不能到货');
      }

      const orderedQty = Number(line.qty);
      const doneQty = Number(line.qty_done);
      const nextDoneQty = doneQty + qty;
      if (nextDoneQty - orderedQty > 0.000001) {
        throw new ConflictException('到货数量超过订单剩余数量');
      }

      const inboundResult = await client.query<MovementRow>(buildReceiveInboundQuery().text, [
        productId,
        warehouseId,
        qty,
        slotId,
        batchId,
        quality,
        movementType,
        reason,
        normalizedOrderId,
        operatorId,
      ]);
      const lineStatus: PurchaseLineStatus = nextDoneQty >= orderedQty ? 'RECEIVED' : 'PARTIAL_RECEIVED';
      const updatedLineResult = await client.query<ReceivedOrderLineRow>(buildUpdateReceivedOrderLineQuery().text, [
        normalizedOrderId,
        orderLineId,
        nextDoneQty,
        lineStatus,
      ]);

      await client.query('COMMIT');
      return {
        movement_id: Number(inboundResult.rows[0].movement_id),
        order_line_id: Number(updatedLineResult.rows[0].order_line_id),
        qty_done: Number(updatedLineResult.rows[0].qty_done),
        line_status: updatedLineResult.rows[0].line_status,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      mapReceiveError(error);
    } finally {
      client.release();
    }
  }

  async mrp(orderId: string) {
    const normalizedOrderId = requireOrderId(orderId);
    const queries = buildOrderDetailQuery();
    const headerResult = await queryDatabase<OrderRow>(queries.header.text, [normalizedOrderId]);
    const header = headerResult.rows[0];
    if (!header) {
      throw new NotFoundException('订单不存在');
    }
    if (header.order_type !== 'PRODUCTION') {
      throw new BadRequestException('只有生产单可以查看缺料推衍');
    }

    const result = await queryDatabase<OrderMrpRow>(buildOrderMrpQuery().text, [normalizedOrderId]);
    return result.rows.map((row) => ({
      product_id: row.product_id,
      ptype: row.ptype,
      lvl: Number(row.lvl),
      gross_demand: Number(row.gross_demand),
      on_hand: Number(row.on_hand),
      net_required: Number(row.net_required),
    }));
  }
}

function mapOrderListRow(row: OrderListRow) {
  return {
    ...mapOrderRow(row),
    line_count: Number(row.line_count),
    total_qty: Number(row.total_qty),
    total_done: Number(row.total_done),
  };
}

function mapOrderRow(row: OrderRow) {
  return {
    order_id: Number(row.order_id),
    order_type: row.order_type,
    partner: row.partner,
    due_date: row.due_date,
    status: row.status,
    created_by: row.created_by === null ? null : Number(row.created_by),
    created_at: row.created_at,
  };
}

function mapOrderLineRow(row: OrderLineRow) {
  return {
    order_line_id: Number(row.order_line_id),
    order_id: Number(row.order_id),
    product_id: row.product_id,
    product_name: row.product_name,
    qty: Number(row.qty),
    qty_done: Number(row.qty_done),
    line_status: row.line_status,
  };
}

function normalizeOrderLines(orderType: OrderType, lines: OrderLineBody[] | undefined) {
  if (!Array.isArray(lines) || lines.length === 0) {
    throw new BadRequestException('订单明细不能为空');
  }

  return lines.map((line) => ({
    product_id: requireText(line.product_id, '明细产品不能为空').toUpperCase(),
    qty: requirePositiveNumber(line.qty, '明细数量必须大于 0'),
    line_status: normalizeLineStatus(orderType, line.line_status),
  }));
}

function normalizeLineStatus(orderType: OrderType, value: unknown): OrderLineStatus {
  if (value === undefined || value === null || value === '') {
    return 'PENDING';
  }
  if (typeof value !== 'string' || !value.trim()) {
    throw new BadRequestException('明细状态必须是字符串');
  }

  const status = value.trim() as OrderLineStatus;
  const allowed = orderType === 'PURCHASE' ? purchaseLineStatuses : productionLineStatuses;
  if (!allowed.has(status)) {
    throw new BadRequestException(
      orderType === 'PURCHASE'
        ? '采购单明细状态必须是 PENDING/PARTIAL_RECEIVED/RECEIVED/DONE/CANCELLED'
        : '生产单明细状态必须是 PENDING/SHORTAGE/PICKED/IN_PRODUCTION/PRODUCED/CANCELLED',
    );
  }
  return status;
}

function requireOrderType(value: unknown): OrderType {
  if (value === 'PURCHASE' || value === 'PRODUCTION') {
    return value;
  }
  throw new BadRequestException('订单类型必须是 PURCHASE/PRODUCTION');
}

function requirePatchStatus(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new BadRequestException('订单状态不能为空');
  }
  return value.trim();
}

function requireOrderId(value: unknown) {
  const text = String(value);
  if (!/^\d+$/.test(text)) {
    throw new NotFoundException('订单不存在');
  }
  return text;
}

function requireText(value: unknown, message: string) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new BadRequestException(message);
  }
  return value.trim();
}

function optionalNonEmptyText(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  if (typeof value !== 'string' || !value.trim()) {
    throw new BadRequestException('状态必须是字符串');
  }
  return value.trim();
}

function optionalText(value: unknown, fallback: string) {
  if (typeof value !== 'string' || !value.trim()) {
    return fallback;
  }
  return value.trim();
}

function nullableText(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }
  return value.trim();
}

function nullableBigint(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  return requireBigint(value, 'ID 必须是正整数');
}

function requireBigint(value: unknown, message: string) {
  const text = String(value);
  if (!/^\d+$/.test(text)) {
    throw new BadRequestException(message);
  }
  return text;
}

function requirePositiveNumber(value: unknown, message: string) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    throw new BadRequestException(message);
  }
  return numberValue;
}

function mapReceiveError(error: unknown): never {
  if (
    error instanceof BadRequestException ||
    error instanceof ConflictException ||
    error instanceof NotFoundException
  ) {
    throw error;
  }

  const pgError = error as { code?: string; message?: string };
  if (pgError.code === '23514' || pgError.code === 'P0001') {
    throw new ConflictException(pgError.message ?? '到货入库冲突');
  }
  if (pgError.code === '23503') {
    throw new ConflictException('到货引用的产品、仓库、库位或订单不存在');
  }
  if (pgError.code === '22P02' || pgError.code === '22007') {
    throw new BadRequestException(pgError.message ?? '到货数据不合法');
  }
  mapPgConcurrencyError(error);
  throw error;
}

function mapOrderError(error: unknown): never {
  if (
    error instanceof BadRequestException ||
    error instanceof ConflictException ||
    error instanceof NotFoundException
  ) {
    throw error;
  }

  const pgError = error as { code?: string; message?: string };
  if (pgError.code === '23503') {
    throw new ConflictException('订单引用的产品或用户不存在');
  }
  if (pgError.code === '23514' || pgError.code === '22P02' || pgError.code === '22007') {
    throw new BadRequestException(pgError.message ?? '订单数据不合法');
  }
  mapPgConcurrencyError(error);
  throw error;
}
