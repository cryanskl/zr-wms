export interface SqlCall {
  text: string;
}

export function buildInboundQuery(): SqlCall {
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

export function buildOutboundQuery(): SqlCall {
  return {
    text: `
      SELECT op_outbound(
        $1::text,
        $2::text,
        $3::numeric,
        $4::bigint,
        $5::bigint,
        $6::text,
        $7::text,
        $8::text,
        $9::bigint,
        $10::bigint,
        $11::boolean
      )::text AS movement_id
    `,
  };
}

export function buildTransferQuery(): SqlCall {
  return {
    text: `
      SELECT op_transfer(
        $1::text,
        $2::numeric,
        $3::text,
        $4::bigint,
        $5::text,
        $6::bigint,
        $7::bigint,
        $8::text,
        $9::text,
        $10::bigint
      )::text[] AS movement_ids
    `,
  };
}
