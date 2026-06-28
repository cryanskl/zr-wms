import { Injectable } from '@nestjs/common';
import { queryDatabase } from '../database';
import { buildOperationLogsQuery } from './operation-log-queries';

interface OperationLogRow {
  log_id: string;
  entity_type: string;
  entity_id: string | null;
  action: string;
  detail: string | null;
  operator_id: string | null;
  operator_name: string | null;
  created_at: string;
}

@Injectable()
export class OperationLogsService {
  async list(filters: { entityType?: string; action?: string; limit?: string }) {
    const limit = parseLimit(filters.limit);
    const result = await queryDatabase<OperationLogRow>(buildOperationLogsQuery().text, [
      filters.entityType || null,
      filters.action || null,
      limit,
    ]);

    return result.rows.map((row) => ({
      log_id: Number(row.log_id),
      entity_type: row.entity_type,
      entity_id: row.entity_id,
      action: row.action,
      detail: row.detail ? (JSON.parse(row.detail) as Record<string, unknown>) : null,
      operator_id: row.operator_id === null ? null : Number(row.operator_id),
      operator_name: row.operator_name,
      created_at: row.created_at,
    }));
  }
}

function parseLimit(value: string | undefined) {
  if (!value) return 100;
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1) return 100;
  return Math.min(limit, 500);
}
