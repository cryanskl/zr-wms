import { describe, expect, it } from 'vitest';
import {
  buildInventoryQuery,
  buildInventorySummaryQuery,
  buildLowStockQuery,
  buildProductLocationsQuery,
  buildSlotProductsQuery,
} from './stock-read-queries';

describe('stock read query builders', () => {
  it('are select-only and use fn_available for available quantities', () => {
    const sql = [
      buildInventoryQuery().text,
      buildInventorySummaryQuery().text,
      buildProductLocationsQuery().text,
      buildSlotProductsQuery().text,
      buildLowStockQuery().text,
    ].join('\n');

    expect(sql).toContain('fn_available');
    expect(sql).toContain('product.safety_stock');
    expect(sql).not.toMatch(/\bUPDATE\b/i);
    expect(sql).not.toMatch(/\bDELETE\b/i);
    expect(sql).not.toMatch(/\bINSERT\b/i);
  });
});
