import { describe, expect, it } from 'vitest';
import { buildCreateProductRequest, buildProductPriceUrl, buildProductsUrl, buildUpdateProductPriceRequest } from './productApi';

describe('productApi helpers', () => {
  it('builds product filter URLs', () => {
    expect(buildProductsUrl({ type: 'RM', active: true })).toBe('/api/v1/products?type=RM&active=true');
  });

  it('builds create product requests', () => {
    expect(buildCreateProductRequest({ type: 'RM', name: '胶料' })).toEqual({
      url: '/api/v1/products',
      init: {
        method: 'POST',
        body: JSON.stringify({ type: 'RM', name: '胶料' }),
      },
    });
  });

  it('builds price endpoints and update requests', () => {
    expect(buildProductPriceUrl('RM-001')).toBe('/api/v1/products/RM-001/price');
    expect(buildUpdateProductPriceRequest({ cost_in: 1, cost_process: null, cost_loss: 0.5, price_out: 3 })).toEqual({
      method: 'PUT',
      body: JSON.stringify({ cost_in: 1, cost_process: null, cost_loss: 0.5, price_out: 3 }),
    });
  });
});
