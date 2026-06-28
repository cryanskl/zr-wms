export interface SqlQuery {
  text: string;
}

export function buildImportProductUpsertQuery(): SqlQuery {
  return {
    text: `
      INSERT INTO product (
        product_id,
        type,
        name,
        has_tube,
        has_alu_plate,
        has_dust_cover,
        attrs,
        safety_stock,
        remark,
        created_by,
        updated_by
      )
      VALUES (
        $1::text,
        $2::text,
        $3::text,
        $4::boolean,
        $5::boolean,
        $6::boolean,
        COALESCE($7::jsonb, '{}'::jsonb),
        $8::numeric,
        $9::text,
        $10::bigint,
        $10::bigint
      )
      ON CONFLICT (product_id) DO UPDATE
      SET
        type = EXCLUDED.type,
        name = EXCLUDED.name,
        has_tube = EXCLUDED.has_tube,
        has_alu_plate = EXCLUDED.has_alu_plate,
        has_dust_cover = EXCLUDED.has_dust_cover,
        attrs = EXCLUDED.attrs,
        safety_stock = EXCLUDED.safety_stock,
        remark = EXCLUDED.remark,
        active = true,
        updated_by = EXCLUDED.updated_by
      RETURNING product_id
    `,
  };
}

export function buildImportInventoryInboundQuery(): SqlQuery {
  return {
    text: `
      SELECT op_inbound(
        $1::text,
        $2::text,
        $3::numeric,
        $4::bigint,
        $5::bigint,
        $6::text,
        'IN',
        $7::text,
        NULL::bigint,
        $8::bigint
      )::text AS movement_id
    `,
  };
}

export function buildDeleteImportedBomLinesQuery(): SqlQuery {
  return {
    text: 'DELETE FROM bom_line WHERE parent_product_id = ANY($1::text[])',
  };
}

export function buildInsertImportedBomLineQuery(): SqlQuery {
  return {
    text: `
      INSERT INTO bom_line (parent_product_id, child_product_id, qty, seq)
      VALUES ($1::text, $2::text, $3::numeric, $4::smallint)
    `,
  };
}

export function buildRegenerateImportedPathAliasesQuery(): SqlQuery {
  return {
    text: 'SELECT fn_regen_path_aliases()::int AS regenerated_aliases',
  };
}
