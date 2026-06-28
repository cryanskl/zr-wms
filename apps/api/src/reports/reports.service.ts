import { BadRequestException, Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { queryDatabase } from '../database';
import {
  buildDeadStockQuery,
  buildExportInventoryQuery,
  buildExportMovementsQuery,
  buildPeriodReportQuery,
  buildSlotUtilizationQuery,
  parseReportRange,
  ReportRange,
} from './reports-queries';

interface PeriodReportRow {
  period: string;
  movement_count: string;
  inbound_qty: string;
  outbound_qty: string;
  adjustment_qty: string;
  net_qty: string;
}

interface DeadStockRow {
  product_id: string;
  product_name: string;
  qty_on_hand: string;
  last_movement_at: string | null;
  idle_days: string | null;
}

interface SlotUtilizationRow {
  warehouse_id: string;
  warehouse_name: string;
  total_slots: string;
  occupied_slots: string;
  utilization_rate: string;
}

interface ExportInventoryRow {
  product_id: string;
  product_name: string;
  warehouse_id: string;
  warehouse_name: string;
  slot_id: string | null;
  slot_code: string | null;
  quality: string;
  qty_on_hand: string;
  available: string;
}

interface ExportMovementRow {
  movement_id: string;
  product_id: string;
  product_name: string;
  warehouse_id: string;
  warehouse_name: string;
  slot_id: string | null;
  slot_code: string | null;
  quality: string;
  type: string;
  qty: string;
  reason: string | null;
  operator_id: string | null;
  created_at: string;
}

export interface ExportBody {
  type?: string;
  range?: string;
  days?: number | string;
}

@Injectable()
export class ReportsService {
  async period(rangeInput: unknown) {
    const range = this.parseRange(rangeInput);
    const result = await queryDatabase<PeriodReportRow>(buildPeriodReportQuery(range).text);
    return result.rows.map(mapPeriodReportRow);
  }

  async deadStock(daysInput: unknown) {
    const days = parseDays(daysInput);
    const result = await queryDatabase<DeadStockRow>(buildDeadStockQuery().text, [days]);
    return result.rows.map(mapDeadStockRow);
  }

  async slotUtilization() {
    const result = await queryDatabase<SlotUtilizationRow>(buildSlotUtilizationQuery().text);
    return result.rows.map(mapSlotUtilizationRow);
  }

  async export(body: ExportBody = {}) {
    const type = body.type ?? 'inventory';
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'ZR WMS';
    workbook.created = new Date();

    if (type === 'inventory') {
      const result = await queryDatabase<ExportInventoryRow>(buildExportInventoryQuery().text);
      addWorksheet(workbook, '库存', [
        ['产品ID', 'product_id'],
        ['产品名', 'product_name'],
        ['仓库ID', 'warehouse_id'],
        ['仓库', 'warehouse_name'],
        ['库位ID', 'slot_id'],
        ['库位', 'slot_code'],
        ['质量态', 'quality'],
        ['在库', 'qty_on_hand'],
        ['可用', 'available'],
      ], result.rows.map(mapExportInventoryRow));
      return this.buildExportResult(workbook, 'inventory');
    }

    if (type === 'movements') {
      const result = await queryDatabase<ExportMovementRow>(buildExportMovementsQuery().text);
      addWorksheet(workbook, '库存流水', [
        ['流水ID', 'movement_id'],
        ['产品ID', 'product_id'],
        ['产品名', 'product_name'],
        ['仓库ID', 'warehouse_id'],
        ['仓库', 'warehouse_name'],
        ['库位ID', 'slot_id'],
        ['库位', 'slot_code'],
        ['质量态', 'quality'],
        ['类型', 'type'],
        ['数量', 'qty'],
        ['原因', 'reason'],
        ['操作员ID', 'operator_id'],
        ['时间', 'created_at'],
      ], result.rows.map(mapExportMovementRow));
      return this.buildExportResult(workbook, 'movements');
    }

    if (type === 'period') {
      const rows = await this.period(body.range);
      addWorksheet(workbook, '周期报表', [
        ['周期', 'period'],
        ['流水数', 'movement_count'],
        ['入库数量', 'inbound_qty'],
        ['出库数量', 'outbound_qty'],
        ['调整数量', 'adjustment_qty'],
        ['净变动', 'net_qty'],
      ], rows);
      return this.buildExportResult(workbook, `period-${this.parseRange(body.range)}`);
    }

    if (type === 'dead-stock') {
      const rows = await this.deadStock(body.days);
      addWorksheet(workbook, '呆滞库存', [
        ['产品ID', 'product_id'],
        ['产品名', 'product_name'],
        ['在库', 'qty_on_hand'],
        ['最近流水', 'last_movement_at'],
        ['呆滞天数', 'idle_days'],
      ], rows);
      return this.buildExportResult(workbook, 'dead-stock');
    }

    if (type === 'slot-utilization') {
      const rows = await this.slotUtilization();
      addWorksheet(workbook, '库位利用率', [
        ['仓库ID', 'warehouse_id'],
        ['仓库', 'warehouse_name'],
        ['总库位', 'total_slots'],
        ['占用库位', 'occupied_slots'],
        ['利用率%', 'utilization_rate'],
      ], rows);
      return this.buildExportResult(workbook, 'slot-utilization');
    }

    throw new BadRequestException('导出类型只支持 inventory、movements、period、dead-stock、slot-utilization');
  }

  private parseRange(value: unknown): ReportRange {
    try {
      return parseReportRange(value);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'range 参数无效');
    }
  }

  private async buildExportResult(workbook: ExcelJS.Workbook, name: string) {
    const raw = await workbook.xlsx.writeBuffer();
    const buffer = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
    const timestamp = new Date().toISOString().slice(0, 10);

    return {
      fileName: `zr-wms-${name}-${timestamp}.xlsx`,
      buffer,
    };
  }
}

function parseDays(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return 90;
  }

  const days = Number(value);
  if (!Number.isInteger(days) || days < 1 || days > 3650) {
    throw new BadRequestException('days 必须是 1 到 3650 之间的整数');
  }

  return days;
}

function addWorksheet(workbook: ExcelJS.Workbook, name: string, columns: Array<[string, string]>, rows: Array<Record<string, unknown>>) {
  const worksheet = workbook.addWorksheet(name);
  worksheet.columns = columns.map(([header, key]) => ({ header, key, width: Math.max(header.length * 2, 14) }));
  worksheet.addRows(rows);
  worksheet.getRow(1).font = { bold: true };
}

function mapPeriodReportRow(row: PeriodReportRow) {
  return {
    period: row.period,
    movement_count: Number(row.movement_count),
    inbound_qty: Number(row.inbound_qty),
    outbound_qty: Number(row.outbound_qty),
    adjustment_qty: Number(row.adjustment_qty),
    net_qty: Number(row.net_qty),
  };
}

function mapDeadStockRow(row: DeadStockRow) {
  return {
    product_id: row.product_id,
    product_name: row.product_name,
    qty_on_hand: Number(row.qty_on_hand),
    last_movement_at: row.last_movement_at,
    idle_days: row.idle_days === null ? null : Number(row.idle_days),
  };
}

function mapSlotUtilizationRow(row: SlotUtilizationRow) {
  return {
    warehouse_id: row.warehouse_id,
    warehouse_name: row.warehouse_name,
    total_slots: Number(row.total_slots),
    occupied_slots: Number(row.occupied_slots),
    utilization_rate: Number(row.utilization_rate),
  };
}

function mapExportInventoryRow(row: ExportInventoryRow) {
  return {
    ...row,
    qty_on_hand: Number(row.qty_on_hand),
    available: Number(row.available),
  };
}

function mapExportMovementRow(row: ExportMovementRow) {
  return {
    ...row,
    movement_id: Number(row.movement_id),
    slot_id: row.slot_id === null ? null : Number(row.slot_id),
    qty: Number(row.qty),
    operator_id: row.operator_id === null ? null : Number(row.operator_id),
  };
}
