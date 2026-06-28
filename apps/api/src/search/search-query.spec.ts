import { describe, expect, it } from 'vitest';
import { buildSearchQuery } from './search-query';

describe('buildSearchQuery', () => {
  it('searches product name, aliases, path aliases, and remarks', () => {
    const query = buildSearchQuery('399 151');

    expect(query.text).toContain('product.name');
    expect(query.text).toContain('product_alias');
    expect(query.text).toContain('bom_path_alias');
    expect(query.text).toContain('product.remark');
    expect(query.text).toContain('similarity');
    expect(query.values).toEqual(['399 151', '%399%151%', '399151']);
  });
});
