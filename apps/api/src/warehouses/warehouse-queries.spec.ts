import { describe, expect, it } from 'vitest';
import {
  buildCreateWarehouseQuery,
  buildInsertSlotQuery,
  buildSlotListQuery,
  buildUpdateSlotQuery,
  buildWarehouseListQuery,
} from './warehouse-queries';

describe('warehouse query builders', () => {
  it('manage structure without touching inventory or stock movement', () => {
    const sql = [
      buildWarehouseListQuery().text,
      buildCreateWarehouseQuery().text,
      buildSlotListQuery().text,
      buildInsertSlotQuery().text,
      buildUpdateSlotQuery().text,
    ].join('\n');

    expect(sql).toContain('warehouse');
    expect(sql).toContain('slot');
    expect(sql).toContain('status_reason');
    expect(sql).not.toMatch(/\b(UPDATE|DELETE\s+FROM)\s+(inventory|stock_movement)\b/i);
    expect(sql).not.toMatch(/\b(inventory|stock_movement)\s+SET\b/i);
  });
});
