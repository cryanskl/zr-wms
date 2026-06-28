export type SearchMatchedField = 'name' | 'alias' | 'path_alias' | 'remark';

export interface SearchResultRow {
  product_id: string;
  name: string;
  matched: SearchMatchedField;
  snippet: string;
  score: number;
}

export interface BuiltSearchQuery {
  text: string;
  values: [string, string, string];
}

function compactPartNumber(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function buildSearchQuery(rawQuery: string): BuiltSearchQuery {
  const q = rawQuery.trim();
  const containsPattern = `%${q.split(/\s+/).join('%')}%`;
  const compact = compactPartNumber(q);

  return {
    values: [q, containsPattern, compact],
    text: `
      WITH candidates AS (
        SELECT
          product.product_id,
          product.name,
          'name'::text AS matched,
          product.name AS snippet,
          GREATEST(
            similarity(product.name, $1),
            CASE WHEN product.name ILIKE $2 THEN 1 ELSE 0 END,
            CASE
              WHEN $3 <> ''
                AND regexp_replace(lower(product.name), '[^a-z0-9]', '', 'g') LIKE '%' || $3 || '%'
              THEN 0.95
              ELSE 0
            END
          ) AS score
        FROM product
        WHERE product.active
          AND (
            product.name % $1
            OR product.name ILIKE $2
            OR (
              $3 <> ''
              AND regexp_replace(lower(product.name), '[^a-z0-9]', '', 'g') LIKE '%' || $3 || '%'
            )
          )

        UNION ALL

        SELECT
          product.product_id,
          product.name,
          'alias'::text AS matched,
          product_alias.alias_text AS snippet,
          GREATEST(
            similarity(product_alias.alias_text, $1),
            CASE WHEN product_alias.alias_text ILIKE $2 THEN 1 ELSE 0 END,
            CASE
              WHEN $3 <> ''
                AND regexp_replace(lower(product_alias.alias_text), '[^a-z0-9]', '', 'g') LIKE '%' || $3 || '%'
              THEN 0.95
              ELSE 0
            END
          ) AS score
        FROM product_alias
        JOIN product ON product.product_id = product_alias.product_id
        WHERE product.active
          AND (
            product_alias.alias_text % $1
            OR product_alias.alias_text ILIKE $2
            OR (
              $3 <> ''
              AND regexp_replace(lower(product_alias.alias_text), '[^a-z0-9]', '', 'g') LIKE '%' || $3 || '%'
            )
          )

        UNION ALL

        SELECT
          product.product_id,
          product.name,
          'path_alias'::text AS matched,
          bom_path_alias.path_text AS snippet,
          GREATEST(
            similarity(bom_path_alias.path_text, $1),
            CASE WHEN bom_path_alias.path_text ILIKE $2 THEN 1 ELSE 0 END,
            CASE
              WHEN $3 <> ''
                AND regexp_replace(lower(bom_path_alias.path_text), '[^a-z0-9]', '', 'g') LIKE '%' || $3 || '%'
              THEN 0.95
              ELSE 0
            END
          ) AS score
        FROM bom_path_alias
        JOIN product ON product.product_id = bom_path_alias.product_id
        WHERE product.active
          AND (
            bom_path_alias.path_text % $1
            OR bom_path_alias.path_text ILIKE $2
            OR (
              $3 <> ''
              AND regexp_replace(lower(bom_path_alias.path_text), '[^a-z0-9]', '', 'g') LIKE '%' || $3 || '%'
            )
          )

        UNION ALL

        SELECT
          product.product_id,
          product.name,
          'remark'::text AS matched,
          product.remark AS snippet,
          GREATEST(
            similarity(product.remark, $1),
            CASE WHEN product.remark ILIKE $2 THEN 1 ELSE 0 END,
            CASE
              WHEN $3 <> ''
                AND regexp_replace(lower(product.remark), '[^a-z0-9]', '', 'g') LIKE '%' || $3 || '%'
              THEN 0.95
              ELSE 0
            END
          ) AS score
        FROM product
        WHERE product.active
          AND product.remark IS NOT NULL
          AND (
            product.remark % $1
            OR product.remark ILIKE $2
            OR (
              $3 <> ''
              AND regexp_replace(lower(product.remark), '[^a-z0-9]', '', 'g') LIKE '%' || $3 || '%'
            )
          )
      )
      SELECT product_id, name, matched, snippet, score
      FROM candidates
      ORDER BY score DESC, product_id ASC, matched ASC
      LIMIT 50
    `,
  };
}
