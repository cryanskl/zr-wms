import { describe, expect, it } from 'vitest';
import type { ProductVisualLocation, RackLayout, RackSlotMap, RackTemplate } from './warehouseMapApi';
import {
  buildElevationCells,
  buildWarehouseLayoutSaveInput,
  getRackHitCount,
  getWarehouseHitCount,
  groupLocationsByWarehouse,
  normalizeCanvasPosition,
} from './warehouseMapModel';

const locations: ProductVisualLocation[] = [
  {
    product_id: 'RM-001',
    warehouse_id: 'W1',
    warehouse_name: '一号仓',
    slot_id: 11,
    slot_code: 'A-01',
    rack_layout_id: 101,
    rack_code: 'R1',
    bay_no: 1,
    level_no: 1,
    position_code: 'A',
    quality: 'GOOD',
    batch_id: 'B1',
    qty_on_hand: 5,
    reserved_qty: 1,
    available_qty: 4,
    highlight_kind: 'GOOD',
  },
  {
    product_id: 'RM-001',
    warehouse_id: 'W1',
    warehouse_name: '一号仓',
    slot_id: 12,
    slot_code: 'A-02',
    rack_layout_id: 102,
    rack_code: 'R2',
    bay_no: 1,
    level_no: 1,
    position_code: 'A',
    quality: 'DEFECTIVE',
    batch_id: null,
    qty_on_hand: 2,
    reserved_qty: 0,
    available_qty: 2,
    highlight_kind: 'DEFECTIVE',
  },
  {
    product_id: 'RM-001',
    warehouse_id: 'W2',
    warehouse_name: '二号仓',
    slot_id: null,
    slot_code: null,
    rack_layout_id: null,
    rack_code: null,
    bay_no: null,
    level_no: null,
    position_code: null,
    quality: 'GOOD',
    batch_id: null,
    qty_on_hand: 3,
    reserved_qty: 0,
    available_qty: 3,
    highlight_kind: 'UNMAPPED',
  },
];

describe('warehouseMapModel helpers', () => {
  it('groups and counts product locations without mutating input', () => {
    const grouped = groupLocationsByWarehouse(locations);

    expect(Array.from(grouped.keys())).toEqual(['W1', 'W2']);
    expect(grouped.get('W1')).toEqual([locations[0], locations[1]]);
    expect(getWarehouseHitCount('W1', locations)).toBe(2);
    expect(getWarehouseHitCount('W3', locations)).toBe(0);
    expect(getRackHitCount(101, locations)).toBe(1);
    expect(getRackHitCount(999, locations)).toBe(0);
  });

  it('builds rack elevation cells from template, mappings, and product hits', () => {
    const rack: RackLayout = {
      rack_layout_id: 101,
      template_id: 1,
      zone_id: null,
      code: 'R1',
      name: 'R1',
      x: 0,
      y: 0,
      rotation: 0,
      seq: 1,
      slot_maps: [],
    };
    const template: RackTemplate = {
      template_id: 1,
      code: 'STD',
      name: '标准',
      bay_count: 2,
      level_count: 2,
      positions: ['A', 'B'],
      created_at: '2026-06-30',
    };
    const mappings: RackSlotMap[] = [
      { map_id: 1, slot_id: 11, slot_code: 'A-01', bay_no: 1, level_no: 1, position: 'A' },
      { map_id: 2, slot_id: 22, slot_code: 'B-22', bay_no: 2, level_no: 2, position: 'B' },
    ];

    const cells = buildElevationCells(rack, template, mappings, locations);

    expect(cells).toHaveLength(8);
    expect(cells[0]).toEqual({
      key: '101:1:1:A',
      rack_layout_id: 101,
      bay_no: 1,
      level_no: 1,
      position: 'A',
      map: mappings[0],
      locations: [locations[0]],
      hit_count: 1,
      highlight_kind: 'GOOD',
    });
    expect(cells.find((cell) => cell.key === '101:2:2:B')).toMatchObject({
      map: mappings[1],
      locations: [],
      hit_count: 0,
      highlight_kind: null,
    });
  });

  it('normalizes canvas positions to the nearest grid step', () => {
    expect(normalizeCanvasPosition(37, 20)).toBe(40);
    expect(normalizeCanvasPosition(10, 20)).toBe(20);
    expect(normalizeCanvasPosition(-4, 20)).toBe(0);
    expect(normalizeCanvasPosition(37, 0)).toBe(37);
  });

  it('builds save input from a warehouse layout draft', () => {
    const layout = {
      layout_id: 7,
      warehouse_id: 'W1',
      layout_template_id: null,
      name: 'W1 layout',
      version: 3,
      canvas_width: 1000,
      canvas_height: 640,
      grid_size: 20,
      created_at: '2026-06-30',
      updated_at: '2026-06-30',
      zones: [
        { zone_id: 1, code: 'A', name: 'A区', x: 20, y: 40, width: 260, height: 180, color: '#edf2ff', seq: 1 },
      ],
      racks: [
        {
          rack_layout_id: 101,
          template_id: 1,
          zone_id: 1,
          code: 'R1',
          name: 'R1',
          x: 80,
          y: 100,
          rotation: 0,
          seq: 1,
          slot_maps: [{ map_id: 5, slot_id: 11, slot_code: 'A-01', bay_no: 1, level_no: 1, position: 'A' }],
        },
      ],
    };

    expect(buildWarehouseLayoutSaveInput(layout)).toEqual({
      version: 3,
      name: 'W1 layout',
      canvas_width: 1000,
      canvas_height: 640,
      grid_size: 20,
      zones: [{ zone_id: 1, code: 'A', name: 'A区', x: 20, y: 40, width: 260, height: 180, color: '#edf2ff', seq: 1 }],
      racks: [
        {
          rack_layout_id: 101,
          template_id: 1,
          zone_id: 1,
          code: 'R1',
          name: 'R1',
          x: 80,
          y: 100,
          rotation: 0,
          seq: 1,
          slot_maps: [{ map_id: 5, slot_id: 11, bay_no: 1, level_no: 1, position: 'A' }],
        },
      ],
    });
  });

  it('keeps rack association with a newly-created zone by code', () => {
    const layout = {
      layout_id: 7,
      warehouse_id: 'W1',
      layout_template_id: null,
      name: 'W1 layout',
      version: 3,
      canvas_width: 1000,
      canvas_height: 640,
      grid_size: 20,
      created_at: '2026-06-30',
      updated_at: '2026-06-30',
      zones: [
        { zone_id: -1001, code: 'TEMP-A', name: '临时A区', x: 20, y: 40, width: 260, height: 180, color: '#edf2ff', seq: 1 },
      ],
      racks: [
        {
          rack_layout_id: -2001,
          template_id: 1,
          zone_id: -1001,
          code: 'R-TEMP-1',
          name: '临时货架1',
          x: 80,
          y: 100,
          rotation: 0,
          seq: 1,
          slot_maps: [],
        },
      ],
    };

    expect(buildWarehouseLayoutSaveInput(layout).racks[0]).toMatchObject({
      rack_layout_id: undefined,
      zone_id: null,
      zone_code: 'TEMP-A',
    });
    expect(buildWarehouseLayoutSaveInput(layout).zones[0].zone_id).toBeUndefined();
  });
});
