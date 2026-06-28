export interface SqlQuery {
  text: string;
}

export function buildCreateStocktakeQuery(): SqlQuery {
  return {
    text: `
      INSERT INTO stocktake (warehouse_id, status, created_by)
      VALUES ($1::text, $2::text, $3::bigint)
      RETURNING
        stocktake_id::text,
        warehouse_id,
        status,
        created_by::text,
        created_at::text
    `,
  };
}

export function buildCreateStocktakeLineQuery(): SqlQuery {
  return {
    text: `
      WITH target AS (
        SELECT stocktake_id, warehouse_id
        FROM stocktake
        WHERE stocktake_id = $1::bigint
      ),
      target_slot AS (
        SELECT slot_id, warehouse_id
        FROM slot
        WHERE slot_id = $3::bigint
      ),
      book AS (
        SELECT COALESCE(sum(qty_on_hand), 0)::numeric AS system_qty
        FROM inventory
        WHERE product_id = $2::text
          AND slot_id = $3::bigint
          AND batch_id IS NOT DISTINCT FROM $4::bigint
          AND quality = 'GOOD'
      )
      INSERT INTO stocktake_line (stocktake_id, product_id, slot_id, batch_id, system_qty, counted_qty)
      SELECT target.stocktake_id, $2::text, target_slot.slot_id, $4::bigint, book.system_qty, $5::numeric
      FROM target
      JOIN target_slot ON target.warehouse_id IS NULL OR target.warehouse_id = target_slot.warehouse_id
      CROSS JOIN book
      RETURNING
        stline_id::text,
        stocktake_id::text,
        product_id,
        slot_id::text,
        batch_id::text,
        system_qty::text,
        counted_qty::text,
        diff::text,
        adj_movement_id::text
    `,
  };
}

export function buildApplyStocktakeLineQuery(): SqlQuery {
  return {
    text: `
      SELECT op_apply_stocktake_line($1::bigint, $2::bigint)::text AS movement_id
    `,
  };
}
