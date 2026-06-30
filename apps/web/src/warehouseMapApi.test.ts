import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildCreateRackTemplateRequest,
  buildCreateWarehouseLayoutRequest,
  buildProductVisualLocationsUrl,
  buildRackTemplatesUrl,
  buildSaveWarehouseLayoutRequest,
  buildWarehouseLayoutTemplatesUrl,
  buildWarehouseLayoutUrl,
  createRackTemplate,
  createWarehouseLayout,
  getProductVisualLocations,
  getWarehouseLayout,
  listRackTemplates,
  listWarehouseLayoutTemplates,
  saveWarehouseLayout,
} from './warehouseMapApi';

describe('warehouseMapApi helpers', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('builds warehouse map read URLs', () => {
    expect(buildWarehouseLayoutUrl('W1')).toBe('/api/v1/warehouse-layouts?warehouse=W1');
    expect(buildWarehouseLayoutTemplatesUrl()).toBe('/api/v1/warehouse-layout-templates');
    expect(buildRackTemplatesUrl()).toBe('/api/v1/rack-templates');
    expect(buildProductVisualLocationsUrl('RM-001')).toBe('/api/v1/products/RM-001/visual-locations');
  });

  it('builds create and save requests with expected methods', () => {
    expect(buildCreateRackTemplateRequest({ code: 'RACK', name: '标准货架', bay_count: 2, level_count: 3, positions: ['A'] })).toEqual({
      url: '/api/v1/rack-templates',
      init: {
        method: 'POST',
        body: JSON.stringify({ code: 'RACK', name: '标准货架', bay_count: 2, level_count: 3, positions: ['A'] }),
      },
    });

    expect(buildCreateWarehouseLayoutRequest({
      warehouse_id: 'W1',
      layout_template_id: 1,
      name: '一号仓布局',
      canvas_width: 1200,
      canvas_height: 800,
      grid_size: 20,
    })).toEqual({
      url: '/api/v1/warehouse-layouts',
      init: {
        method: 'POST',
        body: JSON.stringify({
          warehouse_id: 'W1',
          layout_template_id: 1,
          name: '一号仓布局',
          canvas_width: 1200,
          canvas_height: 800,
          grid_size: 20,
        }),
      },
    });

    expect(buildSaveWarehouseLayoutRequest(7, {
      version: 2,
      name: '一号仓布局',
      canvas_width: 1200,
      canvas_height: 800,
      grid_size: 20,
      zones: [],
      racks: [],
    })).toEqual({
      url: '/api/v1/warehouse-layouts/7',
      init: {
        method: 'PUT',
        body: JSON.stringify({
          version: 2,
          name: '一号仓布局',
          canvas_width: 1200,
          canvas_height: 800,
          grid_size: 20,
          zones: [],
          racks: [],
        }),
      },
    });
  });

  it('calls fetch with exact URLs and methods', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => [],
    }));
    vi.stubGlobal('fetch', fetchMock);

    await listWarehouseLayoutTemplates('token');
    await listRackTemplates('token');
    await getWarehouseLayout('token', 'W1');
    await getProductVisualLocations('token', 'RM-001');
    await createRackTemplate('token', { code: 'RACK', name: '标准货架', bay_count: 2, level_count: 3, positions: ['A'] });
    await createWarehouseLayout('token', { warehouse_id: 'W1', name: '一号仓布局', canvas_width: 1200, canvas_height: 800 });
    await saveWarehouseLayout('token', 7, { version: 2, name: '一号仓布局', canvas_width: 1200, canvas_height: 800, zones: [], racks: [] });

    const calls = fetchMock.mock.calls.map((call) => {
      const [url, init] = call as unknown as [string, RequestInit | undefined];
      return [url, init?.method];
    });

    expect(calls).toEqual([
      ['/api/v1/warehouse-layout-templates', undefined],
      ['/api/v1/rack-templates', undefined],
      ['/api/v1/warehouse-layouts?warehouse=W1', undefined],
      ['/api/v1/products/RM-001/visual-locations', undefined],
      ['/api/v1/rack-templates', 'POST'],
      ['/api/v1/warehouse-layouts', 'POST'],
      ['/api/v1/warehouse-layouts/7', 'PUT'],
    ]);
  });
});
