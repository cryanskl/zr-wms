import { describe, expect, it } from 'vitest';
import { buildOperationLogsUrl } from './operationLogApi';

describe('operationLogApi helpers', () => {
  it('builds operation log filter URLs', () => {
    expect(buildOperationLogsUrl({ entity_type: 'notification', action: 'LOW_STOCK_NOTIFICATION', limit: 50 })).toBe(
      '/api/v1/operation-logs?entity_type=notification&action=LOW_STOCK_NOTIFICATION&limit=50',
    );
  });
});
