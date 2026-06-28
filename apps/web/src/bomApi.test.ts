import { describe, expect, it } from 'vitest';
import { buildBomUrl, buildReplaceBomRequest, buildWhereUsedUrl } from './bomApi';

describe('bomApi helpers', () => {
  it('builds BOM and where-used URLs', () => {
    expect(buildBomUrl('FG-1')).toBe('/api/v1/products/FG-1/bom');
    expect(buildWhereUsedUrl('RM-1', true)).toBe('/api/v1/products/RM-1/where-used?recursive=true');
  });

  it('builds replace BOM requests', () => {
    expect(buildReplaceBomRequest('FG-1', [{ child_product_id: 'RM-1', qty: 2, seq: 1 }])).toEqual({
      url: '/api/v1/products/FG-1/bom',
      init: {
        method: 'PUT',
        body: JSON.stringify({ lines: [{ child_product_id: 'RM-1', qty: 2, seq: 1 }] }),
      },
    });
  });
});
