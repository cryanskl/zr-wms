import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { pool, queryDatabase } from '../database';
import {
  buildCreateOrderQuery,
  buildInsertOrderLineQuery,
  buildOrderDetailQuery,
  buildOrderListQuery,
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

function nullableText(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }
  return value.trim();
}

function requirePositiveNumber(value: unknown, message: string) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    throw new BadRequestException(message);
  }
  return numberValue;
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
  throw error;
}
