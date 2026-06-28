import { describe, expect, it } from 'vitest';
import { buildProductsUrl, buildCreateProductRequest } from './productApi';

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
});
