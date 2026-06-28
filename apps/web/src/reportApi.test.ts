import { describe, expect, it } from 'vitest';
import { buildDeadStockUrl, buildExportRequest, buildPeriodReportUrl } from './reportApi';

describe('reportApi helpers', () => {
  it('builds report query urls', () => {
    expect(buildPeriodReportUrl('week')).toBe('/api/v1/reports/period?range=week');
    expect(buildDeadStockUrl()).toBe('/api/v1/reports/dead-stock');
    expect(buildDeadStockUrl(120)).toBe('/api/v1/reports/dead-stock?days=120');
  });

  it('builds Excel export requests with auth headers', () => {
    expect(buildExportRequest('token-1', { type: 'period', range: 'month' })).toEqual({
      url: '/api/v1/export',
      init: {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer token-1',
        },
        body: JSON.stringify({ type: 'period', range: 'month' }),
      },
    });
  });
});
