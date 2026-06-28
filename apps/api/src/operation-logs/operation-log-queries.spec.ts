import { describe, expect, it } from 'vitest';
import { buildOperationLogsQuery } from './operation-log-queries';

describe('operation log query builders', () => {
  it('reads operation_log without touching stock tables', () => {
    const sql = buildOperationLogsQuery().text;

    expect(sql).toContain('FROM operation_log');
    expect(sql).toContain('operator_user.name');
    expect(sql).not.toMatch(/\binventory\b/i);
    expect(sql).not.toMatch(/\bstock_movement\b/i);
  });
});
