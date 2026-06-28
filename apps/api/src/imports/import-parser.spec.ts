import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { parseBomWorkbook, parseInventoryWorkbook, parseProductsWorkbook } from './import-parser';

describe('import workbook parsers', () => {
  it('parses products by header name', async () => {
    const buffer = await buildWorkbook([
      ['product_id', 'type', 'name', 'safety_stock', 'remark'],
      ['RM-9001', 'RM', '测试原料', 12, '导入'],
    ]);

    await expect(parseProductsWorkbook(buffer)).resolves.toEqual([
      {
        product_id: 'RM-9001',
        type: 'RM',
        name: '测试原料',
        has_tube: false,
        has_alu_plate: false,
        has_dust_cover: false,
        attrs: {},
        safety_stock: 12,
        remark: '导入',
      },
    ]);
  });

  it('parses inventory rows by header name', async () => {
    const buffer = await buildWorkbook([
      ['product_id', 'warehouse_id', 'slot_id', 'qty', 'quality', 'reason'],
      ['RM-9001', 'W1', 1, 100, 'GOOD', '初始导入'],
    ]);

    await expect(parseInventoryWorkbook(buffer)).resolves.toEqual([
      {
        product_id: 'RM-9001',
        warehouse_id: 'W1',
        slot_id: 1,
        batch_id: null,
        qty: 100,
        quality: 'GOOD',
        reason: '初始导入',
      },
    ]);
  });

  it('parses BOM rows by header name', async () => {
    const buffer = await buildWorkbook([
      ['parent_product_id', 'child_product_id', 'qty', 'seq'],
      ['FG-9001', 'RM-9001', 2, 1],
    ]);

    await expect(parseBomWorkbook(buffer)).resolves.toEqual([
      {
        parent_product_id: 'FG-9001',
        child_product_id: 'RM-9001',
        qty: 2,
        seq: 1,
      },
    ]);
  });
});

async function buildWorkbook(rows: unknown[][]) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Sheet1');
  sheet.addRows(rows);
  const raw = await workbook.xlsx.writeBuffer();
  return Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
}
