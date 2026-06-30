import { describe, expect, it } from 'vitest';
import { buildProductVisualLocationsQuery } from './visual-location-queries';

const normalized = (sql: string): string => sql.replace(/\s+/g, ' ').trim();

describe('product visual location query builder', () => {
  it('reads all non-zero product stock rows with optional visual rack mapping', () => {
    const sql = normalized(buildProductVisualLocationsQuery().text);

    expect(sql).toContain('FROM inventory i');
    expect(sql).toContain('JOIN warehouse w ON w.warehouse_id = i.warehouse_id');
    expect(sql).toContain('LEFT JOIN slot s ON s.slot_id = i.slot_id');
    expect(sql).toContain(
      'LEFT JOIN warehouse_layout wl ON wl.warehouse_id = i.warehouse_id AND wl.is_active = true',
    );
    expect(sql).toContain('LEFT JOIN rack_slot_map rsm ON rsm.slot_id = i.slot_id AND rsm.layout_id = wl.layout_id');
    expect(sql).toContain(
      'LEFT JOIN rack_layout rl ON rl.rack_layout_id = rsm.rack_layout_id AND rl.layout_id = wl.layout_id',
    );
    expect(sql).toContain('WHERE i.product_id = $1::text AND (i.qty_on_hand <> 0 OR i.reserved_qty <> 0)');
    expect(sql).toContain('(i.qty_on_hand - i.reserved_qty)::text AS available_qty');
  });

  it('computes highlight kind in SQL and never mutates inventory or stock movement', () => {
    const sql = normalized(buildProductVisualLocationsQuery().text);

    expect(sql).toContain("WHEN i.slot_id IS NOT NULL AND rsm.map_id IS NULL THEN 'UNMAPPED'");
    expect(sql).toContain("WHEN i.quality = 'GOOD' THEN 'GOOD'");
    expect(sql).toContain("WHEN i.quality = 'DEFECTIVE' THEN 'DEFECTIVE'");
    expect(sql).toContain("ELSE 'UNAVAILABLE'");
    expect(sql).toContain(
      'ORDER BY i.warehouse_id, rl.rack_code NULLS LAST, s.code NULLS LAST, i.quality',
    );
    expect(sql).not.toMatch(/\b(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+(inventory|stock_movement)\b/i);
    expect(sql).not.toMatch(/\b(inventory|stock_movement)\s+SET\b/i);
  });
});
