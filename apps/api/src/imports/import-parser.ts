import { BadRequestException } from '@nestjs/common';
import ExcelJS from 'exceljs';

type ProductType = 'RM' | 'SF' | 'FG' | 'ACC';
type Quality = 'GOOD' | 'DEFECTIVE' | 'UNUSABLE';
type ExcelLoadBuffer = Parameters<ExcelJS.Workbook['xlsx']['load']>[0];

export interface ImportedProductRow {
  product_id: string;
  type: ProductType;
  name: string;
  has_tube: boolean;
  has_alu_plate: boolean;
  has_dust_cover: boolean;
  attrs: Record<string, unknown>;
  safety_stock: number | null;
  remark: string | null;
}

export interface ImportedInventoryRow {
  product_id: string;
  warehouse_id: string;
  slot_id: number | null;
  batch_id: number | null;
  qty: number;
  quality: Quality;
  reason: string | null;
}

export interface ImportedBomRow {
  parent_product_id: string;
  child_product_id: string;
  qty: number;
  seq: number;
}

export async function parseProductsWorkbook(buffer: Buffer): Promise<ImportedProductRow[]> {
  const rows = await readRows(buffer, ['product_id', 'type', 'name']);
  return rows.map((row, index) => ({
    product_id: requiredText(row, 'product_id', index),
    type: parseProductType(requiredText(row, 'type', index), index),
    name: requiredText(row, 'name', index),
    has_tube: optionalBoolean(row, 'has_tube'),
    has_alu_plate: optionalBoolean(row, 'has_alu_plate'),
    has_dust_cover: optionalBoolean(row, 'has_dust_cover'),
    attrs: optionalJsonObject(row, 'attrs', index),
    safety_stock: optionalNumber(row, 'safety_stock', index),
    remark: optionalText(row, 'remark'),
  }));
}

export async function parseInventoryWorkbook(buffer: Buffer): Promise<ImportedInventoryRow[]> {
  const rows = await readRows(buffer, ['product_id', 'warehouse_id', 'qty']);
  return rows.map((row, index) => ({
    product_id: requiredText(row, 'product_id', index),
    warehouse_id: requiredText(row, 'warehouse_id', index),
    slot_id: optionalInteger(row, 'slot_id', index),
    batch_id: optionalInteger(row, 'batch_id', index),
    qty: positiveNumber(row, 'qty', index),
    quality: parseQuality(optionalText(row, 'quality') ?? 'GOOD', index),
    reason: optionalText(row, 'reason') ?? '初始库存导入',
  }));
}

export async function parseBomWorkbook(buffer: Buffer): Promise<ImportedBomRow[]> {
  const rows = await readRows(buffer, ['parent_product_id', 'child_product_id', 'qty', 'seq']);
  return rows.map((row, index) => ({
    parent_product_id: requiredText(row, 'parent_product_id', index),
    child_product_id: requiredText(row, 'child_product_id', index),
    qty: positiveNumber(row, 'qty', index),
    seq: positiveInteger(row, 'seq', index),
  }));
}

async function readRows(buffer: Buffer, requiredHeaders: string[]) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(toExcelLoadBuffer(buffer));
  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new BadRequestException('Excel 文件没有工作表');
  }

  const headers = new Map<string, number>();
  worksheet.getRow(1).eachCell((cell, colNumber) => {
    const header = cellText(cell).trim();
    if (header) {
      headers.set(header, colNumber);
    }
  });

  for (const header of requiredHeaders) {
    if (!headers.has(header)) {
      throw new BadRequestException(`Excel 缺少必填列：${header}`);
    }
  }

  const rows: Array<Record<string, unknown>> = [];
  worksheet.eachRow((excelRow, rowNumber) => {
    if (rowNumber === 1) return;
    const row: Record<string, unknown> = {};
    for (const [header, colNumber] of headers.entries()) {
      row[header] = excelRow.getCell(colNumber).value;
    }
    if (Object.values(row).some((value) => cellText({ value }).trim())) {
      rows.push(row);
    }
  });

  if (rows.length === 0) {
    throw new BadRequestException('Excel 没有可导入的数据行');
  }

  return rows;
}

function toExcelLoadBuffer(buffer: Buffer): ExcelLoadBuffer {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ExcelLoadBuffer;
}

function requiredText(row: Record<string, unknown>, field: string, index: number) {
  const value = optionalText(row, field);
  if (!value) {
    throw new BadRequestException(`第 ${index + 2} 行缺少 ${field}`);
  }
  return value;
}

function optionalText(row: Record<string, unknown>, field: string) {
  const text = cellText({ value: row[field] }).trim();
  return text || null;
}

function optionalBoolean(row: Record<string, unknown>, field: string) {
  const value = optionalText(row, field);
  if (!value) return false;
  return ['true', '1', 'yes', 'y', '是'].includes(value.toLowerCase());
}

function optionalNumber(row: Record<string, unknown>, field: string, index: number) {
  const value = optionalText(row, field);
  if (!value) return null;
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new BadRequestException(`第 ${index + 2} 行 ${field} 必须是数字`);
  }
  return number;
}

function positiveNumber(row: Record<string, unknown>, field: string, index: number) {
  const number = optionalNumber(row, field, index);
  if (number === null || number <= 0) {
    throw new BadRequestException(`第 ${index + 2} 行 ${field} 必须大于 0`);
  }
  return number;
}

function optionalInteger(row: Record<string, unknown>, field: string, index: number) {
  const number = optionalNumber(row, field, index);
  if (number === null) return null;
  if (!Number.isInteger(number) || number < 1) {
    throw new BadRequestException(`第 ${index + 2} 行 ${field} 必须是正整数`);
  }
  return number;
}

function positiveInteger(row: Record<string, unknown>, field: string, index: number) {
  const number = optionalInteger(row, field, index);
  if (number === null) {
    throw new BadRequestException(`第 ${index + 2} 行缺少 ${field}`);
  }
  return number;
}

function optionalJsonObject(row: Record<string, unknown>, field: string, index: number) {
  const value = optionalText(row, field);
  if (!value) return {};

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
      throw new Error('not object');
    }
    return parsed as Record<string, unknown>;
  } catch {
    throw new BadRequestException(`第 ${index + 2} 行 ${field} 必须是 JSON 对象`);
  }
}

function parseProductType(value: string, index: number): ProductType {
  if (value === 'RM' || value === 'SF' || value === 'FG' || value === 'ACC') {
    return value;
  }
  throw new BadRequestException(`第 ${index + 2} 行 type 必须是 RM/SF/FG/ACC`);
}

function parseQuality(value: string, index: number): Quality {
  if (value === 'GOOD' || value === 'DEFECTIVE' || value === 'UNUSABLE') {
    return value;
  }
  throw new BadRequestException(`第 ${index + 2} 行 quality 必须是 GOOD/DEFECTIVE/UNUSABLE`);
}

function cellText(cell: { value: unknown }): string {
  const value = cell.value;
  if (value === null || value === undefined) return '';
  if (typeof value === 'object' && 'text' in value && typeof value.text === 'string') return value.text;
  if (typeof value === 'object' && 'result' in value) return String(value.result ?? '');
  return String(value);
}
