export interface SqlQuery {
  text: string;
}

export function buildOperationLogsQuery(): SqlQuery {
  return {
    text: `
      SELECT
        operation_log.log_id::text,
        operation_log.entity_type,
        operation_log.entity_id,
        operation_log.action,
        operation_log.detail::text,
        operation_log.operator_id::text,
        operator_user.name AS operator_name,
        operation_log.created_at::text
      FROM operation_log
      LEFT JOIN app_user operator_user ON operator_user.user_id = operation_log.operator_id
      WHERE ($1::text IS NULL OR operation_log.entity_type = $1::text)
        AND ($2::text IS NULL OR operation_log.action = $2::text)
      ORDER BY operation_log.created_at DESC, operation_log.log_id DESC
      LIMIT $3::int
    `,
  };
}
