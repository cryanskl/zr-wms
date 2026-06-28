import { describe, expect, it } from 'vitest';
import { buildInventoryUrl } from './inventoryApi';

describe('buildInventoryUrl', () => {
  it('builds inventory filter query strings', () => {
    expect(buildInventoryUrl({ product: 'RM-0123', warehouse: 'W1', quality: 'GOOD' })).toBe(
      '/api/v1/inventory?product=RM-0123&warehouse=W1&quality=GOOD',
    );
  });
});
