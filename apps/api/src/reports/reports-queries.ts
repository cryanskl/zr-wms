export interface SqlQuery {
  text: string;
}

export type ReportRange = 'day' | 'week' | 'month';

const rangeUnits: Record<ReportRange, { datePart: string; interval: string }> = {
  day: { datePart: 'day', interval: '30 days' },
  week: { datePart: 'week', interval: '12 weeks' },
  month: { datePart: 'month', interval: '12 months' },
};

export function parseReportRange(value: unknown): ReportRange {
  if (value === undefined || value === null || value === '') {
    return 'day';
  }

  if (value === 'day' || value === 'week' || value === 'month') {
    return value;
  }

  throw new Error('range 只支持 day、week、month');
}

export function buildPeriodReportQuery(range: ReportRange): SqlQuery {
  const unit = rangeUnits[range];

  return {
    text: `
      SELECT
        date_trunc('${unit.datePart}', stock_movement.created_at)::date::text AS period,
        count(*)::text AS movement_count,
        COALESCE(sum(CASE WHEN stock_movement.qty > 0 THEN stock_movement.qty ELSE 0 END), 0)::text AS inbound_qty,
        COALESCE(sum(CASE WHEN stock_movement.qty < 0 THEN abs(stock_movement.qty) ELSE 0 END), 0)::text AS outbound_qty,
        COALESCE(sum(CASE WHEN stock_movement.type = 'ADJUST' THEN stock_movement.qty ELSE 0 END), 0)::text AS adjustment_qty,
        COALESCE(sum(stock_movement.qty), 0)::text AS net_qty
      FROM stock_movement
      WHERE stock_movement.voided = false
        AND stock_movement.created_at >= date_trunc('${unit.datePart}', now() - interval '${unit.interval}')
      GROUP BY date_trunc('${unit.datePart}', stock_movement.created_at)::date
      ORDER BY period DESC
    `,
  };
}

export function buildDeadStockQuery(): SqlQuery {
  return {
    text: `
      WITH inventory_total AS (
        SELECT
          inventory.product_id,
          COALESCE(sum(inventory.qty_on_hand), 0) AS qty_on_hand
        FROM inventory
        GROUP BY inventory.product_id
      ),
      latest_movement AS (
        SELECT
          stock_movement.product_id,
          max(stock_movement.created_at) AS last_movement_at
        FROM stock_movement
        WHERE stock_movement.voided = false
        GROUP BY stock_movement.product_id
      )
      SELECT
        product.product_id,
        product.name AS product_name,
        inventory_total.qty_on_hand::text,
        latest_movement.last_movement_at::text,
        CASE
          WHEN latest_movement.last_movement_at IS NULL THEN NULL
          ELSE floor(extract(epoch FROM (now() - latest_movement.last_movement_at)) / 86400)::int
        END::text AS idle_days
      FROM inventory_total
      JOIN product ON product.product_id = inventory_total.product_id
      LEFT JOIN latest_movement ON latest_movement.product_id = inventory_total.product_id
      WHERE inventory_total.qty_on_hand <> 0
        AND (
          latest_movement.last_movement_at IS NULL
          OR latest_movement.last_movement_at < now() - make_interval(days => $1::int)
        )
      ORDER BY latest_movement.last_movement_at NULLS FIRST, product.product_id
    `,
  };
}

export function buildSlotUtilizationQuery(): SqlQuery {
  return {
    text: `
      WITH total_slots AS (
        SELECT
          warehouse.warehouse_id,
          warehouse.name AS warehouse_name,
          count(slot.slot_id) AS total_slots
        FROM warehouse
        LEFT JOIN slot ON slot.warehouse_id = warehouse.warehouse_id
        WHERE warehouse.has_slots = true
        GROUP BY warehouse.warehouse_id, warehouse.name
      ),
      occupied_slots AS (
        SELECT
          slot.warehouse_id,
          count(DISTINCT slot.slot_id) AS occupied_slots
        FROM slot
        JOIN inventory ON inventory.slot_id = slot.slot_id
        WHERE inventory.qty_on_hand <> 0
        GROUP BY slot.warehouse_id
      )
      SELECT
        total_slots.warehouse_id,
        total_slots.warehouse_name,
        total_slots.total_slots::text,
        COALESCE(occupied_slots.occupied_slots, 0)::text AS occupied_slots,
        CASE
          WHEN total_slots.total_slots = 0 THEN 0
          ELSE round(COALESCE(occupied_slots.occupied_slots, 0)::numeric / total_slots.total_slots::numeric * 100, 2)
        END::text AS utilization_rate
      FROM total_slots
      LEFT JOIN occupied_slots ON occupied_slots.warehouse_id = total_slots.warehouse_id
      ORDER BY total_slots.warehouse_id
    `,
  };
}

export function buildExportInventoryQuery(): SqlQuery {
  return {
    text: `
      SELECT
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
        )::text AS available
      FROM inventory
      JOIN product ON product.product_id = inventory.product_id
      JOIN warehouse ON warehouse.warehouse_id = inventory.warehouse_id
      LEFT JOIN slot ON slot.slot_id = inventory.slot_id
      ORDER BY inventory.product_id, inventory.warehouse_id, inventory.slot_id, inventory.quality
    `,
  };
}

export function buildExportMovementsQuery(): SqlQuery {
  return {
    text: `
      SELECT
        stock_movement.movement_id::text,
        stock_movement.product_id,
        product.name AS product_name,
        stock_movement.warehouse_id,
        warehouse.name AS warehouse_name,
        stock_movement.slot_id::text,
        slot.code AS slot_code,
        stock_movement.quality,
        stock_movement.type,
        stock_movement.qty::text,
        stock_movement.reason,
        stock_movement.operator_id::text,
        stock_movement.created_at::text
      FROM stock_movement
      JOIN product ON product.product_id = stock_movement.product_id
      JOIN warehouse ON warehouse.warehouse_id = stock_movement.warehouse_id
      LEFT JOIN slot ON slot.slot_id = stock_movement.slot_id
      WHERE stock_movement.voided = false
      ORDER BY stock_movement.created_at DESC, stock_movement.movement_id DESC
    `,
  };
}
