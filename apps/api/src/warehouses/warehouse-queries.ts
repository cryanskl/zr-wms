export interface SqlQuery {
  text: string;
}

export function buildWarehouseListQuery(): SqlQuery {
  return {
    text: `
      SELECT warehouse_id, name, type, has_slots, created_at::text
      FROM warehouse
      ORDER BY warehouse_id
    `,
  };
}

export function buildCreateWarehouseQuery(): SqlQuery {
  return {
    text: `
      INSERT INTO warehouse (warehouse_id, name, type, has_slots)
      VALUES ($1::text, $2::text, $3::text, $4::boolean)
      RETURNING warehouse_id, name, type, has_slots, created_at::text
    `,
  };
}

export function buildWarehouseDetailQuery(): SqlQuery {
  return {
    text: `
      SELECT warehouse_id, name, type, has_slots, created_at::text
      FROM warehouse
      WHERE warehouse_id = $1::text
    `,
  };
}

export function buildSlotListQuery(): SqlQuery {
  return {
    text: `
      SELECT
        slot_id::text,
        warehouse_id,
        code,
        row_no,
        col_no,
        level_no,
        position,
        status,
        status_reason,
        merged_into::text
      FROM slot
      WHERE warehouse_id = $1::text
        AND ($2::boolean = true OR status = 'AVAILABLE')
      ORDER BY row_no NULLS LAST, col_no NULLS LAST, level_no NULLS LAST, position NULLS LAST, code
    `,
  };
}

export function buildInsertSlotQuery(): SqlQuery {
  return {
    text: `
      INSERT INTO slot (warehouse_id, code, row_no, col_no, level_no, position, status)
      VALUES ($1::text, $2::text, $3::smallint, $4::smallint, $5::smallint, $6::char(1), 'AVAILABLE')
      ON CONFLICT (code) DO NOTHING
      RETURNING slot_id::text, warehouse_id, code, row_no, col_no, level_no, position, status, status_reason, merged_into::text
    `,
  };
}

export function buildUpdateSlotQuery(): SqlQuery {
  return {
    text: `
      UPDATE slot
      SET status = $2::text,
          status_reason = $3::text,
          merged_into = $4::bigint
      WHERE slot_id = $1::bigint
      RETURNING slot_id::text, warehouse_id, code, row_no, col_no, level_no, position, status, status_reason, merged_into::text
    `,
  };
}
