export interface SqlQuery {
  text: string;
}

export function buildBomQuery(): SqlQuery {
  return {
    text: `
      SELECT
        bom_line.bom_line_id::text,
        bom_line.parent_product_id,
        bom_line.child_product_id,
        child.name AS child_name,
        child.type AS child_type,
        bom_line.qty::text,
        bom_line.seq
      FROM bom_line
      JOIN product child ON child.product_id = bom_line.child_product_id
      WHERE bom_line.parent_product_id = $1::text
      ORDER BY bom_line.seq, bom_line.child_product_id
    `,
  };
}

export function buildDeleteBomLinesQuery(): SqlQuery {
  return {
    text: 'DELETE FROM bom_line WHERE parent_product_id = $1::text',
  };
}

export function buildInsertBomLineQuery(): SqlQuery {
  return {
    text: `
      INSERT INTO bom_line (parent_product_id, child_product_id, qty, seq)
      VALUES ($1::text, $2::text, $3::numeric, $4::smallint)
    `,
  };
}

export function buildRegeneratePathAliasesQuery(): SqlQuery {
  return {
    text: 'SELECT fn_regen_path_aliases()::int AS regenerated_aliases',
  };
}

export function buildWhereUsedQuery(): SqlQuery {
  return {
    text: `
      SELECT
        where_used.parent_product_id,
        product.name AS parent_name,
        where_used.ptype,
        where_used.lvl
      FROM fn_where_used($1::text, $2::boolean) AS where_used
      JOIN product ON product.product_id = where_used.parent_product_id
      ORDER BY where_used.lvl, where_used.parent_product_id
    `,
  };
}

export function buildPathAliasesQuery(): SqlQuery {
  return {
    text: `
      SELECT path_alias_id::text, product_id, root_product_id, path_text, generated_at::text
      FROM bom_path_alias
      WHERE product_id = $1::text
      ORDER BY path_text
    `,
  };
}
