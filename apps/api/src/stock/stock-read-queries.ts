export interface SqlQuery {
  text: string;
}

export function buildInventoryQuery(): SqlQuery {
  return {
    text: `
      SELECT
        inventory.inventory_id::text,
        inventory.product_id,
        product.name AS product_name,
        inventory.warehouse_id,
        warehouse.name AS warehouse_name,
        inventory.slot_id::text,
        slot.code AS slot_code,
        inventory.quality,
        inventory.qty_on_hand::text,
        fn_available(
          inventory.product_id,
          inventory.warehouse_id,
          inventory.slot_id,
          inventory.batch_id,
          inventory.quality
        )::text AS available,
        (
          inventory.qty_on_hand - fn_available(
            inventory.product_id,
            inventory.warehouse_id,
            inventory.slot_id,
            inventory.batch_id,
            inventory.quality
          )
        )::text AS frozen
      FROM inventory
      JOIN product ON product.product_id = inventory.product_id
      JOIN warehouse ON warehouse.warehouse_id = inventory.warehouse_id
      LEFT JOIN slot ON slot.slot_id = inventory.slot_id
      WHERE ($1::text IS NULL OR inventory.product_id = $1)
        AND ($2::text IS NULL OR inventory.warehouse_id = $2)
        AND ($3::bigint IS NULL OR inventory.slot_id = $3::bigint)
        AND ($4::text IS NULL OR inventory.quality = $4)
      ORDER BY inventory.product_id, inventory.warehouse_id, inventory.slot_id, inventory.quality
    `,
  };
}

export function buildInventorySummaryQuery(): SqlQuery {
  return {
    text: `
      WITH bucket AS (
        SELECT
          inventory.qty_on_hand,
          fn_available(
            inventory.product_id,
            inventory.warehouse_id,
            inventory.slot_id,
            inventory.batch_id,
            inventory.quality
          ) AS available
        FROM inventory
        WHERE ($1::text IS NULL OR inventory.product_id = $1)
      )
      SELECT
        COALESCE(sum(bucket.qty_on_hand), 0)::text AS total,
        COALESCE(sum(bucket.available), 0)::text AS available,
        COALESCE(sum(bucket.qty_on_hand - bucket.available), 0)::text AS frozen
      FROM bucket
    `,
  };
}

export function buildProductLocationsQuery(): SqlQuery {
  return {
    text: `
      SELECT
        inventory.inventory_id::text,
        inventory.product_id,
        product.name AS product_name,
        inventory.warehouse_id,
        warehouse.name AS warehouse_name,
        inventory.slot_id::text,
        slot.code AS slot_code,
        inventory.quality,
        inventory.qty_on_hand::text,
        fn_available(
          inventory.product_id,
          inventory.warehouse_id,
          inventory.slot_id,
          inventory.batch_id,
          inventory.quality
        )::text AS available,
        (
          inventory.qty_on_hand - fn_available(
            inventory.product_id,
            inventory.warehouse_id,
            inventory.slot_id,
            inventory.batch_id,
            inventory.quality
          )
        )::text AS frozen
      FROM inventory
      JOIN product ON product.product_id = inventory.product_id
      JOIN warehouse ON warehouse.warehouse_id = inventory.warehouse_id
      LEFT JOIN slot ON slot.slot_id = inventory.slot_id
      WHERE inventory.product_id = $1
      ORDER BY inventory.warehouse_id, inventory.slot_id, inventory.quality
    `,
  };
}

export function buildSlotProductsQuery(): SqlQuery {
  return {
    text: `
      SELECT
        inventory.inventory_id::text,
        inventory.product_id,
        product.name AS product_name,
        inventory.warehouse_id,
        warehouse.name AS warehouse_name,
        inventory.slot_id::text,
        slot.code AS slot_code,
        inventory.quality,
        inventory.qty_on_hand::text,
        fn_available(
          inventory.product_id,
          inventory.warehouse_id,
          inventory.slot_id,
          inventory.batch_id,
          inventory.quality
        )::text AS available,
        (
          inventory.qty_on_hand - fn_available(
            inventory.product_id,
            inventory.warehouse_id,
            inventory.slot_id,
            inventory.batch_id,
            inventory.quality
          )
        )::text AS frozen
      FROM inventory
      JOIN product ON product.product_id = inventory.product_id
      JOIN warehouse ON warehouse.warehouse_id = inventory.warehouse_id
      LEFT JOIN slot ON slot.slot_id = inventory.slot_id
      WHERE inventory.slot_id = $1
      ORDER BY inventory.product_id, inventory.quality
    `,
  };
}

export function buildLowStockQuery(): SqlQuery {
  return {
    text: `
      SELECT
        product.product_id,
        product.name AS product_name,
        product.safety_stock::text,
        COALESCE(sum(inventory.qty_on_hand), 0)::text AS qty_on_hand,
        (product.safety_stock - COALESCE(sum(inventory.qty_on_hand), 0))::text AS shortage
      FROM product
      LEFT JOIN inventory ON inventory.product_id = product.product_id
      WHERE product.active = true
        AND product.safety_stock IS NOT NULL
      GROUP BY product.product_id, product.name, product.safety_stock
      HAVING COALESCE(sum(inventory.qty_on_hand), 0) < product.safety_stock
      ORDER BY shortage DESC, product.product_id
    `,
  };
}
