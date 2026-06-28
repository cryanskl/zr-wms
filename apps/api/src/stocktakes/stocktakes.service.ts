import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { queryDatabase } from '../database';
import { mapPgConcurrencyError } from '../db-errors';
import {
  buildApplyStocktakeLineQuery,
  buildCreateStocktakeLineQuery,
  buildCreateStocktakeQuery,
} from './stocktake-queries';

export interface CreateStocktakeBody {
  warehouse_id?: string | null;
  status?: string;
  created_by?: unknown;
}

export interface CreateStocktakeLineBody {
  product_id?: string;
  slot_id?: number | string | null;
  batch_id?: number | string | null;
  counted_qty?: number | string;
}

interface StocktakeRow {
  stocktake_id: string;
  warehouse_id: string | null;
  status: string;
  created_by: string | null;
  created_at: string;
}

interface StocktakeLineRow {
  stline_id: string;
  stocktake_id: string;
  product_id: string;
  slot_id: string | null;
  batch_id: string | null;
  system_qty: string | null;
  counted_qty: string | null;
  diff: string | null;
  adj_movement_id: string | null;
}

interface ApplyStocktakeLineRow {
  movement_id: string | null;
}

@Injectable()
export class StocktakesService {
  async create(body: CreateStocktakeBody, operatorId: number) {
    const warehouseId = nullableUpperText(body.warehouse_id);
    const status = optionalText(body.status, 'COUNTING');

    try {
      const result = await queryDatabase<StocktakeRow>(buildCreateStocktakeQuery().text, [warehouseId, status, operatorId]);
      return {
        ...mapStocktakeRow(result.rows[0]),
        lines: [],
      };
    } catch (error) {
      mapStocktakeError(error);
    }
  }

  async addLine(stocktakeId: string, body: CreateStocktakeLineBody) {
    const normalizedStocktakeId = requireId(stocktakeId);
    const productId = requireText(body.product_id, '盘点产品不能为空').toUpperCase();
    const slotId = requireId(body.slot_id, '盘点库位不能为空');
    const batchId = nullableId(body.batch_id);
    const countedQty = requireNonNegativeNumber(body.counted_qty, '实盘数量不能小于 0');

    try {
      const result = await queryDatabase<StocktakeLineRow>(buildCreateStocktakeLineQuery().text, [
        normalizedStocktakeId,
        productId,
        slotId,
        batchId,
        countedQty,
      ]);
      const row = result.rows[0];
      if (!row) {
        throw new NotFoundException('盘点单或库位不存在');
      }
      return mapStocktakeLineRow(row);
    } catch (error) {
      mapStocktakeError(error);
    }
  }

  async applyLine(stlineId: string, operatorId: number) {
    const normalizedStlineId = requireId(stlineId);

    try {
      const result = await queryDatabase<ApplyStocktakeLineRow>(buildApplyStocktakeLineQuery().text, [
        normalizedStlineId,
        operatorId,
      ]);
      const movementId = result.rows[0]?.movement_id ?? null;
      return {
        stline_id: Number(normalizedStlineId),
        movement_id: movementId === null ? null : Number(movementId),
      };
    } catch (error) {
      mapStocktakeError(error);
    }
  }
}

function mapStocktakeRow(row: StocktakeRow) {
  return {
    stocktake_id: Number(row.stocktake_id),
    warehouse_id: row.warehouse_id,
    status: row.status,
    created_by: row.created_by === null ? null : Number(row.created_by),
    created_at: row.created_at,
  };
}

function mapStocktakeLineRow(row: StocktakeLineRow) {
  return {
    stline_id: Number(row.stline_id),
    stocktake_id: Number(row.stocktake_id),
    product_id: row.product_id,
    slot_id: row.slot_id === null ? null : Number(row.slot_id),
    batch_id: row.batch_id === null ? null : Number(row.batch_id),
    system_qty: row.system_qty === null ? null : Number(row.system_qty),
    counted_qty: row.counted_qty === null ? null : Number(row.counted_qty),
    diff: row.diff === null ? null : Number(row.diff),
    adj_movement_id: row.adj_movement_id === null ? null : Number(row.adj_movement_id),
  };
}

function requireText(value: unknown, message: string) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new BadRequestException(message);
  }
  return value.trim();
}

function nullableUpperText(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  return requireText(value, '仓库不能为空').toUpperCase();
}

function optionalText(value: unknown, fallback: string) {
  if (typeof value !== 'string' || !value.trim()) {
    return fallback;
  }
  return value.trim();
}

function requireId(value: unknown, message = '记录不存在') {
  const text = String(value);
  if (!/^\d+$/.test(text)) {
    throw new NotFoundException(message);
  }
  return text;
}

function nullableId(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  return requireId(value, 'ID 必须是正整数');
}

function requireNonNegativeNumber(value: unknown, message: string) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue < 0) {
    throw new BadRequestException(message);
  }
  return numberValue;
}

function mapStocktakeError(error: unknown): never {
  if (error instanceof BadRequestException || error instanceof ConflictException || error instanceof NotFoundException) {
    throw error;
  }

  const pgError = error as { code?: string; message?: string };
  if (pgError.code === 'P0001' || pgError.code === '23514') {
    throw new ConflictException(pgError.message ?? '盘点操作冲突');
  }
  if (pgError.code === '23503') {
    throw new ConflictException('盘点引用的仓库、产品、库位或批次不存在');
  }
  if (pgError.code === '22P02') {
    throw new BadRequestException(pgError.message ?? '盘点数据不合法');
  }
  mapPgConcurrencyError(error);
  throw error;
}
