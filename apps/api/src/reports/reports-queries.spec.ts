import { describe, expect, it } from 'vitest';
import {
  buildDeadStockQuery,
  buildExportInventoryQuery,
  buildExportMovementsQuery,
  buildPeriodReportQuery,
  buildSlotUtilizationQuery,
  parseReportRange,
} from './reports-queries';

describe('reports query builders', () => {
  it('accepts only the supported period ranges', () => {
    expect(parseReportRange('day')).toBe('day');
    expect(parseReportRange('week')).toBe('week');
    expect(parseReportRange('month')).toBe('month');
    expect(parseReportRange(undefined)).toBe('day');
    expect(() => parseReportRange('year')).toThrow('range 只支持 day、week、month');
  });

  it('builds select-only report and export queries', () => {
    const sql = [
      buildPeriodReportQuery('day').text,
      buildPeriodReportQuery('week').text,
      buildPeriodReportQuery('month').text,
      buildDeadStockQuery().text,
      buildSlotUtilizationQuery().text,
      buildExportInventoryQuery().text,
      buildExportMovementsQuery().text,
    ].join('\n');

    expect(sql).toContain('stock_movement');
    expect(sql).toContain('inventory');
    expect(sql).toContain('date_trunc');
    expect(sql).not.toMatch(/\bUPDATE\s+(inventory|stock_movement)\b/i);
    expect(sql).not.toMatch(/\bDELETE\s+FROM\s+(inventory|stock_movement)\b/i);
    expect(sql).not.toMatch(/\bINSERT\s+INTO\s+(inventory|stock_movement)\b/i);
  });
});
