export interface SqlQuery {
  text: string;
}

export function buildOrderListQuery(): SqlQuery {
  return {
    text: `
      SELECT
        order_doc.order_id::text,
        order_doc.order_type,
        order_doc.partner,
        order_doc.due_date::text,
        order_doc.status,
        order_doc.created_by::text,
        order_doc.created_at::text,
        count(order_line.order_line_id)::text AS line_count,
        COALESCE(sum(order_line.qty), 0)::text AS total_qty,
        COALESCE(sum(order_line.qty_done), 0)::text AS total_done
      FROM order_doc
      LEFT JOIN order_line ON order_line.order_id = order_doc.order_id
      WHERE ($1::text IS NULL OR order_doc.order_type = $1)
        AND ($2::text IS NULL OR order_doc.status = $2)
      GROUP BY order_doc.order_id
      ORDER BY order_doc.created_at DESC, order_doc.order_id DESC
    `,
  };
}

export function buildCreateOrderQuery(): SqlQuery {
  return {
    text: `
      INSERT INTO order_doc (order_type, partner, due_date, status, created_by)
      VALUES ($1::text, $2::text, $3::date, $4::text, $5::bigint)
      RETURNING
        order_id::text,
        order_type,
        partner,
        due_date::text,
        status,
        created_by::text,
        created_at::text
    `,
  };
}

export function buildInsertOrderLineQuery(): SqlQuery {
  return {
    text: `
      INSERT INTO order_line (order_id, product_id, qty, line_status)
      VALUES ($1::bigint, $2::text, $3::numeric, COALESCE($4::text, 'PENDING'))
      RETURNING
        order_line_id::text,
        order_id::text,
        product_id,
        qty::text,
        qty_done::text,
        line_status
    `,
  };
}

export function buildOrderDetailQuery() {
  return {
    header: {
      text: `
        SELECT
          order_id::text,
          order_type,
          partner,
          due_date::text,
          status,
          created_by::text,
          created_at::text
        FROM order_doc
        WHERE order_id = $1::bigint
      `,
    },
    lines: {
      text: `
        SELECT
          order_line_id::text,
          order_id::text,
          order_line.product_id,
          product.name AS product_name,
          qty::text,
          qty_done::text,
          line_status
        FROM order_line
        JOIN product ON product.product_id = order_line.product_id
        WHERE order_id = $1::bigint
        ORDER BY order_line_id
      `,
    },
  };
}

export function buildUpdateOrderHeaderQuery(): SqlQuery {
  return {
    text: `
      UPDATE order_doc
      SET partner = $2::text,
          due_date = $3::date,
          status = $4::text
      WHERE order_id = $1::bigint
      RETURNING
        order_id::text,
        order_type,
        partner,
        due_date::text,
        status,
        created_by::text,
        created_at::text
    `,
  };
}

export function buildReceiveOrderLineQuery(): SqlQuery {
  return {
    text: `
      SELECT
        order_line.order_line_id::text,
        order_line.order_id::text,
        order_doc.order_type,
        order_line.product_id,
        order_line.qty::text,
        order_line.qty_done::text,
        order_line.line_status
      FROM order_line
      JOIN order_doc ON order_doc.order_id = order_line.order_id
      WHERE order_line.order_id = $1::bigint
        AND order_line.order_line_id = $2::bigint
      FOR UPDATE
    `,
  };
}

export function buildReceiveInboundQuery(): SqlQuery {
  return {
    text: `
      SELECT op_inbound(
        $1::text,
        $2::text,
        $3::numeric,
        $4::bigint,
        $5::bigint,
        $6::text,
        $7::text,
        $8::text,
        $9::bigint,
        $10::bigint
      )::text AS movement_id
    `,
  };
}

export function buildUpdateReceivedOrderLineQuery(): SqlQuery {
  return {
    text: `
      UPDATE order_line
      SET qty_done = $3::numeric,
          line_status = $4::text
      WHERE order_id = $1::bigint
        AND order_line_id = $2::bigint
      RETURNING
        order_line_id::text,
        order_id::text,
        product_id,
        qty::text,
        qty_done::text,
        line_status
    `,
  };
}

export function buildOrderMrpQuery(): SqlQuery {
  return {
    text: `
      SELECT
        product_id,
        ptype,
        lvl::text,
        gross_demand::text,
        on_hand::text,
        net_required::text
      FROM fn_order_mrp($1::bigint)
    `,
  };
}
