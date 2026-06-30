import 'reflect-metadata';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ROLES_KEY } from '../auth/roles.decorator';
import { WarehouseLayoutsService } from './warehouse-layouts.service';

const { queryMock, txMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
  txMock: vi.fn(),
}));

vi.mock('../database', () => ({
  queryDatabase: queryMock,
  withDatabaseTransaction: txMock,
}));

beforeEach(() => {
  queryMock.mockReset();
  txMock.mockReset();
  txMock.mockImplementation((callback) => callback(queryMock));
});

describe('WarehouseLayoutsService', () => {
  it('maps active layout rows into zones, racks, and slot maps without duplicates', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [
        activeLayoutRow({ map_id: '301', slot_id: '401', slot_code: 'W1-R01-C01-L1-A', bay_no: 1 }),
        activeLayoutRow({ map_id: '302', slot_id: '402', slot_code: 'W1-R01-C01-L1-B', bay_no: 2 }),
        activeLayoutRow({ map_id: '302', slot_id: '402', slot_code: 'W1-R01-C01-L1-B', bay_no: 2 }),
      ],
    });

    await expect(new WarehouseLayoutsService().getActiveLayout('w1')).resolves.toEqual({
      layout_id: 11,
      warehouse_id: 'W1',
      layout_template_id: 2,
      name: 'W1 平面图',
      version: 3,
      canvas_width: 1200,
      canvas_height: 720,
      grid_size: 20,
      zones: [
        {
          zone_id: 101,
          code: 'A',
          name: 'A 区',
          x: 10,
          y: 20,
          width: 300,
          height: 200,
          color: '#eef',
          seq: 1,
        },
      ],
      racks: [
        {
          rack_layout_id: 201,
          template_id: 5,
          zone_id: 101,
          code: 'R01',
          name: '一号货架',
          x: 30,
          y: 40,
          rotation: 0,
          seq: 1,
          slot_maps: [
            {
              map_id: 301,
              slot_id: 401,
              slot_code: 'W1-R01-C01-L1-A',
              bay_no: 1,
              level_no: 1,
              position: 'A',
            },
            {
              map_id: 302,
              slot_id: 402,
              slot_code: 'W1-R01-C01-L1-B',
              bay_no: 2,
              level_no: 1,
              position: 'A',
            },
          ],
        },
      ],
    });

    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining('FROM warehouse_layout wl'), ['W1']);
  });

  it('creates a layout in a transaction and stores the current JWT user id', async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ warehouse_id: 'W1', has_slots: true }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            layout_id: '11',
            warehouse_id: 'W1',
            layout_template_id: null,
            name: 'W1 默认平面图',
            version: 1,
            canvas_width: '1200',
            canvas_height: '720',
            grid_size: '20',
            created_at: '2026-06-30T00:00:00.000Z',
            updated_at: '2026-06-30T00:00:00.000Z',
          },
        ],
      });

    await expect(
      new WarehouseLayoutsService().createLayout(42, {
        warehouse_id: 'w1',
        name: 'W1 默认平面图',
        canvas_width: 1200,
        canvas_height: 720,
      }),
    ).resolves.toMatchObject({
      layout_id: 11,
      warehouse_id: 'W1',
      name: 'W1 默认平面图',
      version: 1,
      canvas_width: 1200,
      canvas_height: 720,
      grid_size: 20,
    });

    expect(txMock).toHaveBeenCalledTimes(1);
    expect(queryMock).toHaveBeenNthCalledWith(2, expect.stringContaining('UPDATE warehouse_layout'), ['W1', 42]);
    expect(queryMock).toHaveBeenNthCalledWith(3, expect.stringContaining('INSERT INTO warehouse_layout'), [
      'W1',
      null,
      'W1 默认平面图',
      1200,
      720,
      20,
      42,
    ]);
  });

  it('rejects stale layout saves with the required Chinese conflict message', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] });

    await expect(
      new WarehouseLayoutsService().saveLayout('11', 42, {
        version: 2,
        name: 'W1 平面图',
        canvas_width: 1200,
        canvas_height: 720,
        zones: [],
        racks: [],
      }),
    ).rejects.toThrow('布局已被其他人修改，请刷新后重试');

    await expect(
      new WarehouseLayoutsService().saveLayout('11', 42, {
        name: 'W1 平面图',
        canvas_width: 1200,
        canvas_height: 720,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects rack slot mappings for warehouses without slots', async () => {
    queryMock
      .mockResolvedValueOnce({
        rows: [
          {
            layout_id: '11',
            warehouse_id: 'OUT',
            layout_template_id: null,
            name: '外协平面图',
            version: 3,
            canvas_width: '1200',
            canvas_height: '720',
            grid_size: '20',
            updated_at: '2026-06-30T00:00:00.000Z',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ warehouse_id: 'OUT', has_slots: false }] });

    await expect(
      new WarehouseLayoutsService().saveLayout('11', 42, {
        version: 2,
        name: '外协平面图',
        canvas_width: 1200,
        canvas_height: 720,
        racks: [
          {
            template_id: 5,
            code: 'R01',
            name: '外协货架',
            x: 0,
            y: 0,
            slot_maps: [{ slot_id: 401, bay_no: 1, level_no: 1, position: 'A' }],
          },
        ],
      }),
    ).rejects.toThrow('外协仓不能绑定货架库位');
  });

  it('validates every rack slot map belongs to the layout warehouse before inserting maps', async () => {
    queryMock
      .mockResolvedValueOnce({
        rows: [
          {
            layout_id: '11',
            warehouse_id: 'W1',
            layout_template_id: null,
            name: 'W1 平面图',
            version: 3,
            canvas_width: '1200',
            canvas_height: '720',
            grid_size: '20',
            updated_at: '2026-06-30T00:00:00.000Z',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ warehouse_id: 'W1', has_slots: true }] })
      .mockResolvedValueOnce({ rows: [] });

    await expect(
      new WarehouseLayoutsService().saveLayout('11', 42, {
        version: 2,
        name: 'W1 平面图',
        canvas_width: 1200,
        canvas_height: 720,
        racks: [
          {
            template_id: 5,
            code: 'R01',
            name: '一号货架',
            x: 0,
            y: 0,
            slot_maps: [{ slot_id: 401, bay_no: 1, level_no: 1, position: 'A' }],
          },
        ],
      }),
    ).rejects.toThrow('库位不属于当前布局仓库');

    expect(queryMock).toHaveBeenNthCalledWith(3, expect.stringContaining('FROM slot'), [401, 'W1']);
    expect(queryMock).not.toHaveBeenCalledWith(expect.stringContaining('INSERT INTO rack_slot_map'), expect.any(Array));
  });
});

describe('WarehouseLayoutsController contract', () => {
  it('uses the current JWT user id and requires ADMIN/BOSS for writes', async () => {
    const { WarehouseLayoutsController } = await import('./warehouse-layouts.controller');
    const service = {
      listLayoutTemplates: vi.fn(),
      listRackTemplates: vi.fn(),
      getActiveLayout: vi.fn(),
      createRackTemplate: vi.fn(),
      createLayout: vi.fn(),
      saveLayout: vi.fn(),
    };
    const controller = new WarehouseLayoutsController(service as never);
    const body = { warehouse_id: 'W1', name: 'W1', canvas_width: 1200, canvas_height: 720 };

    controller.createLayout({ user: { userId: 42, name: 'admin', role: 'ADMIN' } }, body);

    expect(service.createLayout).toHaveBeenCalledWith(42, body);

    const reflector = new Reflector();
    const createRoles = reflector.get<string[]>(ROLES_KEY, controller.createLayout);
    const saveRoles = reflector.get<string[]>(ROLES_KEY, controller.saveLayout);
    const rackTemplateRoles = reflector.get<string[]>(ROLES_KEY, controller.createRackTemplate);

    expect(createRoles).toEqual(['ADMIN', 'BOSS']);
    expect(saveRoles).toEqual(['ADMIN', 'BOSS']);
    expect(rackTemplateRoles).toEqual(['ADMIN', 'BOSS']);
  });
});

function activeLayoutRow(overrides: Record<string, unknown> = {}) {
  return {
    layout_id: '11',
    warehouse_id: 'W1',
    layout_template_id: '2',
    name: 'W1 平面图',
    version: 3,
    canvas_width: '1200',
    canvas_height: '720',
    grid_size: '20',
    zone_id: '101',
    zone_code: 'A',
    zone_name: 'A 区',
    zone_x: '10',
    zone_y: '20',
    zone_width: '300',
    zone_height: '200',
    zone_color: '#eef',
    zone_seq: 1,
    rack_layout_id: '201',
    rack_template_id: '5',
    rack_zone_id: '101',
    rack_code: 'R01',
    rack_name: '一号货架',
    rack_x: '30',
    rack_y: '40',
    rack_rotation: '0',
    rack_seq: 1,
    map_id: '301',
    slot_id: '401',
    slot_code: 'W1-R01-C01-L1-A',
    bay_no: 1,
    level_no: 1,
    position: 'A',
    ...overrides,
  };
}
