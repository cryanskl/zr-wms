import { describe, expect, it } from 'vitest';
import { buildCreateOrderRequest, buildOrdersUrl, buildPatchOrderRequest, isOrderDetail } from './orderApi';

describe('orderApi helpers', () => {
  it('builds order list URLs with filters', () => {
    expect(buildOrdersUrl()).toBe('/api/v1/orders');
    expect(buildOrdersUrl({ type: 'PURCHASE' })).toBe('/api/v1/orders?type=PURCHASE');
    expect(buildOrdersUrl({ type: 'PRODUCTION', status: 'PENDING' })).toBe(
      '/api/v1/orders?type=PRODUCTION&status=PENDING',
    );
  });

  it('builds create and patch requests', () => {
    expect(
      buildCreateOrderRequest({
        order_type: 'PRODUCTION',
        partner: '客户A',
        due_date: '2026-07-01',
        lines: [{ product_id: 'FG-TEST', qty: 2 }],
      }),
    ).toEqual({
      url: '/api/v1/orders',
      init: {
        method: 'POST',
        body: JSON.stringify({
          order_type: 'PRODUCTION',
          partner: '客户A',
          due_date: '2026-07-01',
          lines: [{ product_id: 'FG-TEST', qty: 2 }],
        }),
      },
    });

    expect(buildPatchOrderRequest(12, { status: 'IN_PRODUCTION' })).toEqual({
      url: '/api/v1/orders/12',
      init: {
        method: 'PATCH',
        body: JSON.stringify({ status: 'IN_PRODUCTION' }),
      },
    });
  });

  it('identifies detail responses by the presence of lines', () => {
    expect(isOrderDetail({ order_id: 1, lines: [] })).toBe(true);
    expect(isOrderDetail({ order_id: 1 })).toBe(false);
  });
});
