import { describe, expect, it } from 'vitest';
import { buildSearchUrl } from './searchApi';

describe('buildSearchUrl', () => {
  it('encodes the search query for the API contract', () => {
    expect(buildSearchUrl('399 151')).toBe('/api/v1/search?q=399+151');
    expect(buildSearchUrl('带管子')).toBe('/api/v1/search?q=%E5%B8%A6%E7%AE%A1%E5%AD%90');
  });
});
