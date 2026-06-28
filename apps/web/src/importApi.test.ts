import { describe, expect, it } from 'vitest';
import { buildImportRequest, buildImportUrl } from './importApi';

describe('importApi helpers', () => {
  it('builds import endpoint urls', () => {
    expect(buildImportUrl('products')).toBe('/api/v1/import/products');
    expect(buildImportUrl('inventory')).toBe('/api/v1/import/inventory');
    expect(buildImportUrl('bom')).toBe('/api/v1/import/bom');
  });

  it('builds multipart import requests without forcing content type', () => {
    const file = new File(['data'], 'inventory.xlsx');
    const request = buildImportRequest('token-1', 'inventory', file);

    expect(request.url).toBe('/api/v1/import/inventory');
    expect(request.init.method).toBe('POST');
    expect(request.init.headers).toEqual({ Authorization: 'Bearer token-1' });
    expect(request.init.body).toBeInstanceOf(FormData);
  });
});
