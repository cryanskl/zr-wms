export interface SqlQuery {
  text: string;
}

export function buildInsertNotificationLogQuery(): SqlQuery {
  return {
    text: `
      INSERT INTO operation_log (entity_type, entity_id, action, detail, operator_id)
      VALUES ('notification', $1::text, $2::text, $3::jsonb, $4::bigint)
      RETURNING log_id::text, entity_type, entity_id, action, detail::text, operator_id::text, created_at::text
    `,
  };
}

export function buildRecentNotificationLogsQuery(): SqlQuery {
  return {
    text: `
      SELECT log_id::text, entity_type, entity_id, action, detail::text, operator_id::text, created_at::text
      FROM operation_log
      WHERE entity_type = 'notification'
      ORDER BY created_at DESC, log_id DESC
      LIMIT $1::int
    `,
  };
}
