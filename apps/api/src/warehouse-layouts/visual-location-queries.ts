export interface SqlQuery {
  text: string;
}

export function buildProductVisualLocationsQuery(): SqlQuery {
  return {
    text: `
      SELECT
        i.product_id,
        i.warehouse_id,
        w.name AS warehouse_name,
        i.slot_id::text,
        s.code AS slot_code,
        rl.rack_layout_id::text,
        rl.code AS rack_code,
        rsm.bay_no,
        rsm.level_no,
        rsm.position AS position_code,
        i.quality,
        i.batch_id::text,
        i.qty_on_hand::text,
        i.reserved_qty::text,
        (i.qty_on_hand - i.reserved_qty)::text AS available_qty,
        CASE
          WHEN i.slot_id IS NOT NULL AND rsm.map_id IS NULL THEN 'UNMAPPED'
          WHEN i.quality = 'GOOD' THEN 'GOOD'
          WHEN i.quality = 'DEFECTIVE' THEN 'DEFECTIVE'
          ELSE 'UNAVAILABLE'
        END AS highlight_kind
      FROM inventory i
      JOIN warehouse w ON w.warehouse_id = i.warehouse_id
      LEFT JOIN slot s ON s.slot_id = i.slot_id
      LEFT JOIN warehouse_layout wl ON wl.warehouse_id = i.warehouse_id AND wl.is_active = true
      LEFT JOIN rack_slot_map rsm ON rsm.slot_id = i.slot_id AND rsm.layout_id = wl.layout_id
      LEFT JOIN rack_layout rl ON rl.rack_layout_id = rsm.rack_layout_id AND rl.layout_id = wl.layout_id
      WHERE i.product_id = $1::text
        AND (i.qty_on_hand <> 0 OR i.reserved_qty <> 0)
      ORDER BY i.warehouse_id, rl.rack_code NULLS LAST, s.code NULLS LAST, i.quality
    `,
  };
}
