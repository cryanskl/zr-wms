export interface SqlQuery {
  text: string;
}

export function buildWarehouseLayoutTemplatesQuery(): SqlQuery {
  return {
    text: `
      SELECT
        template_id::text,
        code,
        name,
        description,
        default_config,
        created_at::text
      FROM warehouse_layout_template
      ORDER BY code
    `,
  };
}

export function buildRackTemplatesQuery(): SqlQuery {
  return {
    text: `
      SELECT
        template_id::text,
        code,
        name,
        bay_count,
        level_count,
        positions,
        created_at::text
      FROM rack_template
      ORDER BY code
    `,
  };
}

export function buildCreateRackTemplateQuery(): SqlQuery {
  return {
    text: `
      INSERT INTO rack_template (code, name, bay_count, level_count, positions)
      VALUES ($1::text, $2::text, $3::integer, $4::integer, $5::text[])
      RETURNING template_id::text, code, name, bay_count, level_count, positions, created_at::text
    `,
  };
}

export function buildActiveLayoutQuery(): SqlQuery {
  return {
    text: `
      SELECT
        wl.layout_id::text,
        wl.warehouse_id,
        wl.layout_template_id::text,
        wl.name,
        wl.version,
        wl.canvas_width::text,
        wl.canvas_height::text,
        wl.grid_size::text,
        lz.zone_id::text,
        lz.code AS zone_code,
        lz.name AS zone_name,
        lz.x::text AS zone_x,
        lz.y::text AS zone_y,
        lz.width::text AS zone_width,
        lz.height::text AS zone_height,
        lz.color AS zone_color,
        lz.seq AS zone_seq,
        rl.rack_layout_id::text,
        rl.template_id::text AS rack_template_id,
        rl.zone_id::text AS rack_zone_id,
        rl.code AS rack_code,
        rl.name AS rack_name,
        rl.x::text AS rack_x,
        rl.y::text AS rack_y,
        rl.rotation::text AS rack_rotation,
        rl.seq AS rack_seq,
        rsm.map_id::text,
        rsm.slot_id::text,
        slot.code AS slot_code,
        rsm.bay_no,
        rsm.level_no,
        rsm.position
      FROM warehouse_layout wl
      LEFT JOIN layout_zone lz ON lz.layout_id = wl.layout_id
      LEFT JOIN rack_layout rl ON rl.layout_id = wl.layout_id
      LEFT JOIN rack_slot_map rsm ON rsm.rack_layout_id = rl.rack_layout_id
      LEFT JOIN slot ON slot.slot_id = rsm.slot_id
      WHERE wl.warehouse_id = $1::text
        AND wl.is_active = true
      ORDER BY lz.zone_id NULLS LAST, rl.code NULLS LAST, rsm.bay_no NULLS LAST
    `,
  };
}

export function buildCreateLayoutQuery(): SqlQuery {
  return {
    text: `
      INSERT INTO warehouse_layout (
        warehouse_id,
        layout_template_id,
        name,
        canvas_width,
        canvas_height,
        grid_size,
        created_by,
        updated_by
      )
      VALUES (
        $1::text,
        $2::bigint,
        $3::text,
        $4::numeric,
        $5::numeric,
        $6::numeric,
        $7::bigint,
        $7::bigint
      )
      RETURNING
        layout_id::text,
        warehouse_id,
        layout_template_id::text,
        name,
        version,
        canvas_width::text,
        canvas_height::text,
        grid_size::text,
        created_at::text,
        updated_at::text
    `,
  };
}

export function buildDeactivateWarehouseLayoutsQuery(): SqlQuery {
  return {
    text: `
      UPDATE warehouse_layout
      SET is_active = false,
          updated_by = $2::bigint
      WHERE warehouse_id = $1::text
        AND is_active = true
      RETURNING layout_id::text, warehouse_id, name, version, is_active, updated_at::text
    `,
  };
}

export function buildUpdateLayoutHeaderQuery(): SqlQuery {
  return {
    text: `
      UPDATE warehouse_layout
      SET name = $2::text,
          canvas_width = $3::numeric,
          canvas_height = $4::numeric,
          grid_size = $5::numeric,
          version = version + 1,
          updated_by = $6::bigint
      WHERE layout_id = $1::bigint
        AND version = $7::integer
      RETURNING
        layout_id::text,
        warehouse_id,
        layout_template_id::text,
        name,
        version,
        canvas_width::text,
        canvas_height::text,
        grid_size::text,
        updated_at::text
    `,
  };
}

export function buildDeleteLayoutZonesQuery(): SqlQuery {
  return {
    text: `
      DELETE FROM layout_zone
      WHERE layout_id = $1::bigint
    `,
  };
}

export function buildInsertLayoutZoneQuery(): SqlQuery {
  return {
    text: `
      INSERT INTO layout_zone (
        layout_id,
        code,
        name,
        x,
        y,
        width,
        height,
        color,
        seq,
        created_by,
        updated_by
      )
      VALUES (
        $1::bigint,
        $2::text,
        $3::text,
        $4::numeric,
        $5::numeric,
        $6::numeric,
        $7::numeric,
        $8::text,
        $9::integer,
        $10::bigint,
        $10::bigint
      )
      RETURNING zone_id::text, layout_id::text, code, name, x::text, y::text, width::text, height::text, color, seq
    `,
  };
}

export function buildDeleteRackLayoutsQuery(): SqlQuery {
  return {
    text: `
      DELETE FROM rack_layout
      WHERE layout_id = $1::bigint
    `,
  };
}

export function buildInsertRackLayoutQuery(): SqlQuery {
  return {
    text: `
      INSERT INTO rack_layout (
        layout_id,
        template_id,
        zone_id,
        code,
        name,
        x,
        y,
        rotation,
        seq,
        created_by,
        updated_by
      )
      VALUES (
        $1::bigint,
        $2::bigint,
        $3::bigint,
        $4::text,
        $5::text,
        $6::numeric,
        $7::numeric,
        $8::numeric,
        $9::integer,
        $10::bigint,
        $10::bigint
      )
      RETURNING
        rack_layout_id::text,
        layout_id::text,
        template_id::text,
        zone_id::text,
        code,
        name,
        x::text,
        y::text,
        rotation::text,
        seq
    `,
  };
}

export function buildInsertRackSlotMapQuery(): SqlQuery {
  return {
    text: `
      INSERT INTO rack_slot_map (
        rack_layout_id,
        layout_id,
        slot_id,
        bay_no,
        level_no,
        position,
        created_by,
        updated_by
      )
      VALUES (
        $1::bigint,
        $2::bigint,
        $3::bigint,
        $4::integer,
        $5::integer,
        $6::text,
        $7::bigint,
        $7::bigint
      )
      RETURNING map_id::text, rack_layout_id::text, layout_id::text, slot_id::text, bay_no, level_no, position
    `,
  };
}

export function buildSlotWarehouseValidationQuery(): SqlQuery {
  return {
    text: `
      SELECT slot.slot_id::text, slot.warehouse_id, slot.code
      FROM slot
      WHERE slot.slot_id = $1::bigint
        AND slot.warehouse_id = $2::text
    `,
  };
}
