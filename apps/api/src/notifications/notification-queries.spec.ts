import { describe, expect, it } from 'vitest';
import { buildInsertNotificationLogQuery, buildRecentNotificationLogsQuery } from './notification-queries';

describe('notification query builders', () => {
  it('writes notification events only to operation_log', () => {
    const sql = [buildInsertNotificationLogQuery().text, buildRecentNotificationLogsQuery().text].join('\n');

    expect(sql).toContain('INSERT INTO operation_log');
    expect(sql).toContain("entity_type = 'notification'");
    expect(sql).not.toMatch(/\b(INSERT|UPDATE|DELETE\s+FROM)\s+(inventory|stock_movement)\b/i);
    expect(sql).not.toMatch(/\b(inventory|stock_movement)\s+SET\b/i);
  });
});
