export interface SqlQuery {
  text: string;
}

export function buildReserveQuery(): SqlQuery {
  return {
    text: `
      SELECT op_reserve(
        $1::bigint,
        $2::text,
        $3::bigint,
        $4::numeric,
        $5::bigint,
        $6::bigint
      )::text AS reservation_id
    `,
  };
}

export function buildFulfillReservationQuery(): SqlQuery {
  return {
    text: `
      SELECT op_fulfill_reservation(
        $1::bigint,
        $2::bigint
      )::text AS movement_id
    `,
  };
}

export function buildReleaseReservationQuery(): SqlQuery {
  return {
    text: `
      SELECT op_release_reservation(
        $1::bigint,
        $2::bigint
      ) AS released
    `,
  };
}

export function buildOrderReservationsQuery(): SqlQuery {
  return {
    text: `
      SELECT
        reservation.reservation_id::text,
        reservation.order_id::text,
        reservation.product_id,
        product.name AS product_name,
        reservation.slot_id::text,
        slot.code AS slot_code,
        slot.warehouse_id,
        reservation.batch_id::text,
        reservation.qty::text,
        reservation.status,
        reservation.version::text,
        reservation.created_at::text
      FROM reservation
      JOIN product ON product.product_id = reservation.product_id
      JOIN slot ON slot.slot_id = reservation.slot_id
      JOIN warehouse ON warehouse.warehouse_id = slot.warehouse_id
      WHERE reservation.order_id = $1::bigint
      ORDER BY reservation.created_at DESC, reservation.reservation_id DESC
    `,
  };
}
