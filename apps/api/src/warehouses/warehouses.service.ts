import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { queryDatabase } from '../database';
import {
  buildCreateWarehouseQuery,
  buildInsertSlotQuery,
  buildSlotListQuery,
  buildUpdateSlotQuery,
  buildWarehouseDetailQuery,
  buildWarehouseListQuery,
} from './warehouse-queries';

type WarehouseType = 'NORMAL' | 'MOLD' | 'OUTSOURCE';
type SlotStatus = 'AVAILABLE' | 'OCCUPIED' | 'UNUSABLE' | 'MERGED';

export interface WarehouseBody {
  warehouse_id?: string;
  name?: string;
  type?: WarehouseType;
  has_slots?: boolean;
}

export interface SlotTemplateBody {
  rows?: number | string;
  cols?: number | string;
  levels?: number | string;
  positions?: string[];
}

export interface SlotPatchBody {
  status?: SlotStatus;
  status_reason?: string | null;
  merged_into?: number | string | null;
}

interface WarehouseRow {
  warehouse_id: string;
  name: string;
  type: WarehouseType;
  has_slots: boolean;
  created_at: string;
}

interface SlotRow {
  slot_id: string;
  warehouse_id: string;
  code: string;
  row_no: number | null;
  col_no: number | null;
  level_no: number | null;
  position: string | null;
  status: SlotStatus;
  status_reason: string | null;
  merged_into: string | null;
}

@Injectable()
export class WarehousesService {
  async listWarehouses() {
    const result = await queryDatabase<WarehouseRow>(buildWarehouseListQuery().text);
    return result.rows.map(mapWarehouseRow);
  }

  async createWarehouse(body: WarehouseBody) {
    const warehouseId = requireText(body.warehouse_id, '仓库 ID 不能为空').toUpperCase();
    const name = requireText(body.name, '仓库名称不能为空');
    const type = requireWarehouseType(body.type);
    const hasSlots = type === 'OUTSOURCE' ? false : body.has_slots ?? true;

    try {
      const result = await queryDatabase<WarehouseRow>(buildCreateWarehouseQuery().text, [
        warehouseId,
        name,
        type,
        hasSlots,
      ]);
      return mapWarehouseRow(result.rows[0]);
    } catch (error) {
      mapWarehouseError(error);
    }
  }

  async listSlots(warehouseId: string, includeUnavailable?: string) {
    const normalizedWarehouseId = warehouseId.toUpperCase();
    await this.getWarehouse(normalizedWarehouseId);
    const result = await queryDatabase<SlotRow>(buildSlotListQuery().text, [
      normalizedWarehouseId,
      includeUnavailable === 'true',
    ]);
    return result.rows.map(mapSlotRow);
  }

  async generateSlotsFromTemplate(warehouseId: string, body: SlotTemplateBody) {
    const normalizedWarehouseId = warehouseId.toUpperCase();
    const warehouse = await this.getWarehouse(normalizedWarehouseId);
    if (!warehouse.has_slots) {
      throw new ConflictException('外协仓不生成库位');
    }

    const rows = requirePositiveInteger(body.rows, '排数必须是正整数');
    const cols = requirePositiveInteger(body.cols, '列数必须是正整数');
    const levels = requirePositiveInteger(body.levels, '层数必须是正整数');
    const positions = normalizePositions(body.positions);
    const created: SlotRow[] = [];

    try {
      for (let rowNo = 1; rowNo <= rows; rowNo += 1) {
        for (let colNo = 1; colNo <= cols; colNo += 1) {
          for (let levelNo = 1; levelNo <= levels; levelNo += 1) {
            for (const position of positions) {
              const code = `${normalizedWarehouseId}-R${pad2(rowNo)}-C${pad2(colNo)}-L${levelNo}-${position}`;
              const result = await queryDatabase<SlotRow>(buildInsertSlotQuery().text, [
                normalizedWarehouseId,
                code,
                rowNo,
                colNo,
                levelNo,
                position,
              ]);
              if (result.rows[0]) {
                created.push(result.rows[0]);
              }
            }
          }
        }
      }

      return { created: created.length, slots: created.map(mapSlotRow) };
    } catch (error) {
      mapWarehouseError(error);
    }
  }

  async updateSlot(slotId: string, body: SlotPatchBody) {
    const status = requireSlotStatus(body.status);
    const statusReason = nullableText(body.status_reason);
    const mergedInto = nullableNumber(body.merged_into);

    if (status === 'MERGED' && mergedInto === null) {
      throw new BadRequestException('合并库位必须选择目标库位');
    }

    try {
      const result = await queryDatabase<SlotRow>(buildUpdateSlotQuery().text, [slotId, status, statusReason, mergedInto]);
      if (!result.rows[0]) {
        throw new NotFoundException('库位不存在');
      }
      return mapSlotRow(result.rows[0]);
    } catch (error) {
      mapWarehouseError(error);
    }
  }

  private async getWarehouse(warehouseId: string) {
    const result = await queryDatabase<WarehouseRow>(buildWarehouseDetailQuery().text, [warehouseId]);
    if (!result.rows[0]) {
      throw new NotFoundException('仓库不存在');
    }
    return mapWarehouseRow(result.rows[0]);
  }
}

function mapWarehouseRow(row: WarehouseRow) {
  return {
    warehouse_id: row.warehouse_id,
    name: row.name,
    type: row.type,
    has_slots: row.has_slots,
    created_at: row.created_at,
  };
}

function mapSlotRow(row: SlotRow) {
  return {
    slot_id: Number(row.slot_id),
    warehouse_id: row.warehouse_id,
    code: row.code,
    row_no: row.row_no,
    col_no: row.col_no,
    level_no: row.level_no,
    position: row.position,
    status: row.status,
    status_reason: row.status_reason,
    merged_into: row.merged_into ? Number(row.merged_into) : null,
  };
}

function requireText(value: unknown, message: string) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new BadRequestException(message);
  }
  return value.trim();
}

function nullableText(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }
  return value.trim();
}

function nullableNumber(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  return Number(value);
}

function requireWarehouseType(value: unknown): WarehouseType {
  if (value === 'NORMAL' || value === 'MOLD' || value === 'OUTSOURCE') {
    return value;
  }
  throw new BadRequestException('仓库类型必须是 NORMAL/MOLD/OUTSOURCE');
}

function requireSlotStatus(value: unknown): SlotStatus {
  if (value === 'AVAILABLE' || value === 'OCCUPIED' || value === 'UNUSABLE' || value === 'MERGED') {
    return value;
  }
  throw new BadRequestException('库位状态必须是 AVAILABLE/OCCUPIED/UNUSABLE/MERGED');
}

function requirePositiveInteger(value: unknown, message: string) {
  const numberValue = Number(value);
  if (!Number.isInteger(numberValue) || numberValue <= 0) {
    throw new BadRequestException(message);
  }
  return numberValue;
}

function normalizePositions(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new BadRequestException('位置必须至少包含 A/B/C 中的一个');
  }
  const positions = value.map((item) => String(item).toUpperCase());
  if (positions.some((item) => !['A', 'B', 'C'].includes(item))) {
    throw new BadRequestException('位置只能是 A/B/C');
  }
  return Array.from(new Set(positions));
}

function pad2(value: number) {
  return value.toString().padStart(2, '0');
}

function mapWarehouseError(error: unknown): never {
  const pgError = error as { code?: string; message?: string };
  if (pgError.code === '23505') {
    throw new ConflictException('仓库或库位编码重复');
  }
  if (pgError.code === '23503') {
    throw new ConflictException('引用的仓库或库位不存在');
  }
  if (pgError.code === '23514' || pgError.code === '22P02') {
    throw new BadRequestException(pgError.message ?? '仓库或库位数据不合法');
  }
  throw error;
}
