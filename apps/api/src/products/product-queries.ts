export interface SqlQuery {
  text: string;
}

export function buildProductListQuery(): SqlQuery {
  return {
    text: `
      SELECT
        product.product_id,
        product.type,
        product.name,
        product.has_tube,
        product.has_alu_plate,
        product.has_dust_cover,
        product.attrs::text,
        product.safety_stock::text,
        product.remark,
        product.active,
        product.created_at::text,
        product.updated_at::text
      FROM product
      WHERE ($1::text IS NULL OR product.type = $1)
        AND ($2::boolean IS NULL OR product.active = $2)
      ORDER BY product.created_at DESC, product.product_id
    `,
  };
}

export function buildProductDetailQuery() {
  return {
    product: {
      text: `
        SELECT
          product.product_id,
          product.type,
          product.name,
          product.has_tube,
          product.has_alu_plate,
          product.has_dust_cover,
          product.attrs::text,
          product.safety_stock::text,
          product.remark,
          product.active,
          product.created_at::text,
          product.updated_at::text
        FROM product
        WHERE product.product_id = $1
      `,
    },
    aliases: {
      text: `
        SELECT alias_id::text, product_id, alias_text, created_at::text
        FROM product_alias
        WHERE product_id = $1
        ORDER BY alias_id
      `,
    },
    images: {
      text: `
        SELECT image_id::text, product_id, url, seq
        FROM product_image
        WHERE product_id = $1
        ORDER BY seq
      `,
    },
    pathAliases: {
      text: `
        SELECT path_alias_id::text, product_id, root_product_id, path_text, generated_at::text
        FROM bom_path_alias
        WHERE product_id = $1
        ORDER BY path_text
      `,
    },
  };
}

export function buildCreateProductQuery(): SqlQuery {
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
      RETURNING product_id
    `,
  };
}

export function buildUpdateProductQuery(): SqlQuery {
  return {
    text: `
      UPDATE product
      SET
        product_id = $2::text,
        type = $3::text,
        name = $4::text,
        has_tube = $5::boolean,
        has_alu_plate = $6::boolean,
        has_dust_cover = $7::boolean,
        attrs = COALESCE($8::jsonb, '{}'::jsonb),
        safety_stock = $9::numeric,
        remark = $10::text,
        updated_by = $11::bigint
      WHERE product_id = $1::text
      RETURNING product_id
    `,
  };
}

export function buildSoftDeleteProductQuery(): SqlQuery {
  return {
    text: `
      UPDATE product
      SET active = false, updated_by = $2::bigint
      WHERE product_id = $1::text
      RETURNING product_id
    `,
  };
}

export function buildAddAliasQuery(): SqlQuery {
  return {
    text: `
      INSERT INTO product_alias (product_id, alias_text, created_by)
      VALUES ($1::text, $2::text, $3::bigint)
      RETURNING alias_id::text, product_id, alias_text, created_at::text
    `,
  };
}

export function buildDeleteAliasQuery(): SqlQuery {
  return {
    text: `
      DELETE FROM product_alias
      WHERE product_id = $1::text AND alias_id = $2::bigint
      RETURNING alias_id::text
    `,
  };
}

export function buildAddImageQuery(): SqlQuery {
  return {
    text: `
      INSERT INTO product_image (product_id, url, seq)
      VALUES ($1::text, $2::text, $3::smallint)
      RETURNING image_id::text, product_id, url, seq
    `,
  };
}
