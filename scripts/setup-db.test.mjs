import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const setupPath = new URL('./setup-db.ts', import.meta.url);
const warehouseVisualizationPath = new URL('./sql/warehouse-visualization.sql', import.meta.url);

test('setup-db runs warehouse visualization after authoritative and foundation SQL files', async () => {
  const setup = await readFile(setupPath, 'utf8');
  const orderedFiles = [
    'docs/wms_schema_v1.7.sql',
    'docs/wms_procedures_v1.7.sql',
    'docs/wms_logic_v1.7.sql',
    'scripts/sql/app-auth.sql',
    'scripts/sql/seed-foundation.sql',
    'scripts/sql/warehouse-visualization.sql',
  ];

  let previousIndex = -1;
  for (const file of orderedFiles) {
    const index = setup.indexOf(file);
    assert.notEqual(index, -1, `${file} should be included in setup-db order`);
    assert.ok(index > previousIndex, `${file} should run after previous setup file`);
    previousIndex = index;
  }
});

test('warehouse visualization SQL constrains cross-layout zones and cross-warehouse slots', async () => {
  const sql = await readFile(warehouseVisualizationPath, 'utf8');

  assert.match(sql, /UNIQUE \(zone_id,\s*layout_id\)/);
  assert.match(sql, /FOREIGN KEY \(zone_id,\s*layout_id\)\s+REFERENCES layout_zone\(zone_id,\s*layout_id\)/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION validate_rack_slot_map_warehouse\(\)/);
  assert.match(sql, /CREATE TRIGGER trg_rack_slot_map_warehouse BEFORE INSERT OR UPDATE ON rack_slot_map/);
  assert.match(sql, /layout_warehouse_id IS DISTINCT FROM slot_warehouse_id/);
});

test('warehouse visualization trigger guards are table-scoped', async () => {
  const sql = await readFile(warehouseVisualizationPath, 'utf8');

  assert.match(sql, /tgname = 'trg_warehouse_layout_updated'[\s\S]+tgrelid = 'warehouse_layout'::regclass/);
  assert.match(sql, /tgname = 'trg_layout_zone_updated'[\s\S]+tgrelid = 'layout_zone'::regclass/);
  assert.match(sql, /tgname = 'trg_rack_layout_updated'[\s\S]+tgrelid = 'rack_layout'::regclass/);
  assert.match(sql, /tgname = 'trg_rack_slot_map_updated'[\s\S]+tgrelid = 'rack_slot_map'::regclass/);
  assert.match(sql, /tgname = 'trg_rack_slot_map_warehouse'[\s\S]+tgrelid = 'rack_slot_map'::regclass/);
});
