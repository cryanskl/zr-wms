import { describe, expect, it } from 'vitest';
import {
  buildActiveLayoutQuery,
  buildCreateLayoutQuery,
  buildCreateRackTemplateQuery,
  buildDeactivateWarehouseLayoutsQuery,
  buildDeleteLayoutZonesQuery,
  buildDeleteRackLayoutsQuery,
  buildInsertLayoutZoneQuery,
  buildInsertRackLayoutQuery,
  buildInsertRackSlotMapQuery,
  buildRackTemplatesQuery,
  buildSlotWarehouseValidationQuery,
  buildUpdateLayoutHeaderQuery,
  buildWarehouseLayoutTemplatesQuery,
} from './warehouse-layout-queries';
import { buildProductLocationsQuery, buildSlotProductsQuery } from '../stock/stock-read-queries';

const normalized = (sql: string): string => sql.replace(/\s+/g, ' ').trim();

const mutatedTables = (sql: string): string[] =>
  Array.from(sql.matchAll(/\b(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+([a-z_]+)/gi)).map(
    (match) => match[1],
  );

describe('warehouse layout query builders', () => {
  it('read layout templates and active layout without mutating inventory or stock movement', () => {
    const sql = [
      buildProductLocationsQuery().text,
      buildSlotProductsQuery().text,
      buildWarehouseLayoutTemplatesQuery().text,
      buildRackTemplatesQuery().text,
      buildActiveLayoutQuery().text,
      buildSlotWarehouseValidationQuery().text,
    ].join('\n');

    expect(sql).toContain('warehouse_layout_template');
    expect(sql).toContain('rack_template');
    expect(sql).toContain('rack_slot_map');
    expect(sql).not.toMatch(/\b(UPDATE|DELETE\s+FROM)\s+(inventory|stock_movement)\b/i);
    expect(sql).not.toMatch(/\b(inventory|stock_movement)\s+SET\b/i);
  });

  it('save helpers only mutate warehouse visualization tables', () => {
    const sql = [
      buildCreateRackTemplateQuery().text,
      buildCreateLayoutQuery().text,
      buildDeactivateWarehouseLayoutsQuery().text,
      buildUpdateLayoutHeaderQuery().text,
      buildDeleteLayoutZonesQuery().text,
      buildInsertLayoutZoneQuery().text,
      buildDeleteRackLayoutsQuery().text,
      buildInsertRackLayoutQuery().text,
      buildInsertRackSlotMapQuery().text,
    ].join('\n');

    expect(new Set(mutatedTables(sql))).toEqual(
      new Set([
        'rack_template',
        'warehouse_layout',
        'layout_zone',
        'rack_layout',
        'rack_slot_map',
      ]),
    );
    expect(sql).not.toMatch(/\b(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+inventory\b/i);
    expect(sql).not.toMatch(/\b(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+stock_movement\b/i);
  });

  it('active layout query returns nested-ready text IDs and ordered child rows', () => {
    const sql = normalized(buildActiveLayoutQuery().text);

    expect(sql).toContain('wl.layout_id::text');
    expect(sql).toContain('lz.zone_id::text');
    expect(sql).toContain('rl.rack_layout_id::text');
    expect(sql).toContain('rsm.map_id::text');
    expect(sql).toContain('rsm.slot_id::text');
    expect(sql).toContain('WHERE wl.warehouse_id = $1::text AND wl.is_active = true');
    expect(sql).toContain(
      'ORDER BY lz.zone_id NULLS LAST, rl.code NULLS LAST, rsm.bay_no NULLS LAST',
    );
  });

  it('slot warehouse validation checks slot belongs to the requested warehouse', () => {
    const sql = normalized(buildSlotWarehouseValidationQuery().text);

    expect(sql).toContain('FROM slot');
    expect(sql).toContain('slot.slot_id = $1::bigint');
    expect(sql).toContain('slot.warehouse_id = $2::text');
  });
});
