import { describe, expect, it } from 'vitest';
import { buildCreateWarehouseRequest, buildSlotsUrl, buildTemplateSlotsRequest } from './warehouseApi';

describe('warehouseApi helpers', () => {
  it('builds slot list URLs', () => {
    expect(buildSlotsUrl('W1')).toBe('/api/v1/warehouses/W1/slots');
    expect(buildSlotsUrl('W1', true)).toBe('/api/v1/warehouses/W1/slots?includeUnavailable=true');
  });

  it('builds create and template requests', () => {
    expect(buildCreateWarehouseRequest({ warehouse_id: 'W4', name: '四号仓', type: 'NORMAL', has_slots: true })).toEqual({
      url: '/api/v1/warehouses',
      init: {
        method: 'POST',
        body: JSON.stringify({ warehouse_id: 'W4', name: '四号仓', type: 'NORMAL', has_slots: true }),
      },
    });

    expect(buildTemplateSlotsRequest('W4', { rows: 1, cols: 2, levels: 1, positions: ['A', 'B'] })).toEqual({
      url: '/api/v1/warehouses/W4/slots:template',
      init: {
        method: 'POST',
        body: JSON.stringify({ rows: 1, cols: 2, levels: 1, positions: ['A', 'B'] }),
      },
    });
  });
});
