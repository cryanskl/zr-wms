import { describe, expect, it } from 'vitest';
import {
  buildAddAliasQuery,
  buildAddImageQuery,
  buildCreateProductQuery,
  buildProductDetailQuery,
  buildProductListQuery,
  buildSoftDeleteProductQuery,
  buildUpdateProductQuery,
} from './product-queries';

describe('product query builders', () => {
  it('keep inventory and stock movement untouched', () => {
    const sql = [
      buildProductListQuery().text,
      buildProductDetailQuery().product.text,
      buildCreateProductQuery().text,
      buildUpdateProductQuery().text,
      buildSoftDeleteProductQuery().text,
      buildAddAliasQuery().text,
      buildAddImageQuery().text,
    ].join('\n');

    expect(sql).toContain('active = false');
    expect(sql).not.toMatch(/\b(UPDATE|DELETE\s+FROM)\s+(inventory|stock_movement)\b/i);
    expect(sql).not.toMatch(/\b(inventory|stock_movement)\s+SET\b/i);
  });
});
