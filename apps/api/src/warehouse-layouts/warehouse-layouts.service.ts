import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseQuery, queryDatabase, withDatabaseTransaction } from '../database';
import {
  buildActiveLayoutQuery,
  buildCreateLayoutQuery,
  buildCreateRackTemplateQuery,
  buildDeactivateWarehouseLayoutsQuery,
  buildDeleteLayoutZonesQuery,
  buildDeleteRackLayoutsQuery,
  buildInsertLayoutZoneQuery,
  buildInsertRackLayoutQuery,
  buildInsertRackSlotMapQuery,
  buildRackTemplatesQuery,
  buildSlotWarehouseValidationQuery,
  buildUpdateLayoutHeaderQuery,
  buildWarehouseLayoutTemplatesQuery,
} from './warehouse-layout-queries';
import { buildProductVisualLocationsQuery } from './visual-location-queries';

export interface RackTemplateBody {
  code?: string;
  name?: string;
  bay_count?: number | string;
  level_count?: number | string;
  positions?: string[];
}

export interface WarehouseLayoutCreateBody {
  warehouse_id?: string;
  layout_template_id?: number | string | null;
  name?: string;
  canvas_width?: number | string;
  canvas_height?: number | string;
  grid_size?: number | string | null;
}

export interface WarehouseLayoutSaveBody {
  version?: number | string;
  name?: string;
  canvas_width?: number | string;
  canvas_height?: number | string;
  grid_size?: number | string | null;
  zones?: LayoutZoneBody[];
  racks?: RackLayoutBody[];
}

export interface LayoutZoneBody {
  zone_id?: number | string;
  code?: string;
  name?: string;
  x?: number | string;
  y?: number | string;
  width?: number | string;
  height?: number | string;
  color?: string | null;
  seq?: number | string | null;
}

export interface RackLayoutBody {
  rack_layout_id?: number | string;
  template_id?: number | string;
  zone_id?: number | string | null;
  zone_code?: string | null;
  code?: string;
  name?: string;
  x?: number | string;
  y?: number | string;
  rotation?: number | string | null;
  seq?: number | string | null;
  slot_maps?: RackSlotMapBody[];
}

export interface RackSlotMapBody {
  map_id?: number | string;
  slot_id?: number | string;
  bay_no?: number | string;
  level_no?: number | string;
  position?: string;
}

interface LayoutTemplateRow {
  template_id: string;
  code: string;
  name: string;
  description: string | null;
  default_config: unknown;
  created_at: string;
}

interface RackTemplateRow {
  template_id: string;
  code: string;
  name: string;
  bay_count: number;
  level_count: number;
  positions: string[];
  created_at: string;
}

interface ActiveLayoutRow {
  layout_id: string;
  warehouse_id: string;
  layout_template_id: string | null;
  name: string;
  version: number;
  canvas_width: string;
  canvas_height: string;
  grid_size: string;
  zone_id: string | null;
  zone_code: string | null;
  zone_name: string | null;
  zone_x: string | null;
  zone_y: string | null;
  zone_width: string | null;
  zone_height: string | null;
  zone_color: string | null;
  zone_seq: number | null;
  rack_layout_id: string | null;
  rack_template_id: string | null;
  rack_zone_id: string | null;
  rack_code: string | null;
  rack_name: string | null;
  rack_x: string | null;
  rack_y: string | null;
  rack_rotation: string | null;
  rack_seq: number | null;
  map_id: string | null;
  slot_id: string | null;
  slot_code: string | null;
  bay_no: number | null;
  level_no: number | null;
  position: string | null;
}

interface LayoutHeaderRow {
  layout_id: string;
  warehouse_id: string;
  layout_template_id: string | null;
  name: string;
  version: number;
  canvas_width: string;
  canvas_height: string;
  grid_size: string;
  created_at?: string;
  updated_at?: string;
}

interface WarehouseRow {
  warehouse_id: string;
  has_slots: boolean;
}

interface LayoutZoneRow {
  zone_id: string;
  layout_id: string;
  code: string;
  name: string;
  x: string;
  y: string;
  width: string;
  height: string;
  color: string | null;
  seq: number;
}

interface RackLayoutRow {
  rack_layout_id: string;
  layout_id: string;
  template_id: string;
  zone_id: string | null;
  code: string;
  name: string;
  x: string;
  y: string;
  rotation: string;
  seq: number;
}

interface RackSlotMapRow {
  map_id: string;
  rack_layout_id: string;
  layout_id: string;
  slot_id: string;
  bay_no: number;
  level_no: number;
  position: string;
}

interface ProductVisualLocationRow {
  product_id: string;
  warehouse_id: string;
  warehouse_name: string;
  slot_id: string | null;
  slot_code: string | null;
  rack_layout_id: string | null;
  rack_code: string | null;
  bay_no: number | null;
  level_no: number | null;
  position_code: string | null;
  quality: string;
  batch_id: string | null;
  qty_on_hand: string;
  frozen_qty: string;
  available_qty: string;
  highlight_kind: 'GOOD' | 'DEFECTIVE' | 'UNAVAILABLE' | 'UNMAPPED';
}

@Injectable()
export class WarehouseLayoutsService {
  async listLayoutTemplates() {
    const result = await queryDatabase<LayoutTemplateRow>(buildWarehouseLayoutTemplatesQuery().text);
    return result.rows.map(mapLayoutTemplateRow);
  }

  async listRackTemplates() {
    const result = await queryDatabase<RackTemplateRow>(buildRackTemplatesQuery().text);
    return result.rows.map(mapRackTemplateRow);
  }

  async createRackTemplate(body: RackTemplateBody) {
    const code = requireText(body.code, '货架模板编码不能为空').toUpperCase();
    const name = requireText(body.name, '货架模板名称不能为空');
    const bayCount = requirePositiveInteger(body.bay_count, '货架列数必须是正整数');
    const levelCount = requirePositiveInteger(body.level_count, '货架层数必须是正整数');
    const positions = normalizePositions(body.positions);

    try {
      const result = await queryDatabase<RackTemplateRow>(buildCreateRackTemplateQuery().text, [
        code,
        name,
        bayCount,
        levelCount,
        positions,
      ]);
      return mapRackTemplateRow(result.rows[0]);
    } catch (error) {
      mapWarehouseLayoutError(error);
    }
  }

  async getActiveLayout(warehouseId: string) {
    const normalizedWarehouseId = requireText(warehouseId, '仓库 ID 不能为空').toUpperCase();
    const result = await queryDatabase<ActiveLayoutRow>(buildActiveLayoutQuery().text, [normalizedWarehouseId]);
    return mapActiveLayoutRows(result.rows);
  }

  async getProductVisualLocations(productId: string) {
    const normalizedProductId = requireText(productId, '产品 ID 不能为空').toUpperCase();
    const result = await queryDatabase<ProductVisualLocationRow>(buildProductVisualLocationsQuery().text, [
      normalizedProductId,
    ]);
    return result.rows.map(mapProductVisualLocationRow);
  }

  async createLayout(operatorId: number, body: WarehouseLayoutCreateBody) {
    const warehouseId = requireText(body.warehouse_id, '仓库 ID 不能为空').toUpperCase();
    const name = requireText(body.name, '布局名称不能为空');
    const layoutTemplateId = optionalPositiveInteger(body.layout_template_id, '布局模板 ID 必须是正整数');
    const canvasWidth = requirePositiveNumber(body.canvas_width, '画布宽度必须是正数');
    const canvasHeight = requirePositiveNumber(body.canvas_height, '画布高度必须是正数');
    const gridSize = optionalPositiveNumber(body.grid_size, '网格大小必须是正数') ?? 20;

    try {
      await getWarehouse(warehouseId);

      return await withDatabaseTransaction(async (query) => {
        await query(buildDeactivateWarehouseLayoutsQuery().text, [warehouseId, operatorId]);
        const result = await query<LayoutHeaderRow>(buildCreateLayoutQuery().text, [
          warehouseId,
          layoutTemplateId,
          name,
          canvasWidth,
          canvasHeight,
          gridSize,
          operatorId,
        ]);
        return {
          ...mapLayoutHeaderRow(result.rows[0]),
          zones: [],
          racks: [],
        };
      });
    } catch (error) {
      mapWarehouseLayoutError(error);
    }
  }

  async saveLayout(layoutId: string, operatorId: number, body: WarehouseLayoutSaveBody) {
    const normalizedLayoutId = requirePositiveInteger(layoutId, '布局 ID 必须是正整数');
    const version = requirePositiveInteger(body.version, '布局版本不能为空');
    const name = requireText(body.name, '布局名称不能为空');
    const canvasWidth = requirePositiveNumber(body.canvas_width, '画布宽度必须是正数');
    const canvasHeight = requirePositiveNumber(body.canvas_height, '画布高度必须是正数');
    const gridSize = optionalPositiveNumber(body.grid_size, '网格大小必须是正数') ?? 20;
    const zones = normalizeZones(body.zones);
    const racks = normalizeRacks(body.racks);

    try {
      return await withDatabaseTransaction(async (query) => {
        const updated = await query<LayoutHeaderRow>(buildUpdateLayoutHeaderQuery().text, [
          normalizedLayoutId,
          name,
          canvasWidth,
          canvasHeight,
          gridSize,
          operatorId,
          version,
        ]);

        if (!updated.rows[0]) {
          throw new ConflictException('布局已被其他人修改，请刷新后重试');
        }

        const warehouse = await getWarehouse(updated.rows[0].warehouse_id, query);
        const maps = racks.flatMap((rack) => rack.slot_maps);

        if (!warehouse.has_slots && maps.length > 0) {
          throw new ConflictException('外协仓不能绑定货架库位');
        }

        await validateSlotMaps(query, updated.rows[0].warehouse_id, maps);
        await query(buildDeleteRackLayoutsQuery().text, [normalizedLayoutId]);
        await query(buildDeleteLayoutZonesQuery().text, [normalizedLayoutId]);

        const insertedZones = [];
        const zoneIdByInputId = new Map<number, number>();
        const zoneIdByCode = new Map<string, number>();

        for (const zone of zones) {
          const result = await query<LayoutZoneRow>(buildInsertLayoutZoneQuery().text, [
            normalizedLayoutId,
            zone.code,
            zone.name,
            zone.x,
            zone.y,
            zone.width,
            zone.height,
            zone.color,
            zone.seq,
            operatorId,
          ]);
          const mapped = mapLayoutZoneRow(result.rows[0]);
          insertedZones.push(mapped);
          zoneIdByCode.set(mapped.code, mapped.zone_id);
          if (zone.zone_id !== null) {
            zoneIdByInputId.set(zone.zone_id, mapped.zone_id);
          }
        }

        const insertedRacks = [];
        for (const rack of racks) {
          const zoneId = resolveRackZoneId(rack, zoneIdByInputId, zoneIdByCode);
          const rackResult = await query<RackLayoutRow>(buildInsertRackLayoutQuery().text, [
            normalizedLayoutId,
            rack.template_id,
            zoneId,
            rack.code,
            rack.name,
            rack.x,
            rack.y,
            rack.rotation,
            rack.seq,
            operatorId,
          ]);
          const insertedRack = mapRackLayoutRow(rackResult.rows[0]);
          const slotMaps = [];

          for (const slotMap of rack.slot_maps) {
            const mapResult = await query<RackSlotMapRow>(buildInsertRackSlotMapQuery().text, [
              insertedRack.rack_layout_id,
              normalizedLayoutId,
              slotMap.slot_id,
              slotMap.bay_no,
              slotMap.level_no,
              slotMap.position,
              operatorId,
            ]);
            slotMaps.push(mapRackSlotMapRow(mapResult.rows[0]));
          }

          insertedRacks.push({
            ...insertedRack,
            slot_maps: slotMaps,
          });
        }

        return {
          ...mapLayoutHeaderRow(updated.rows[0]),
          zones: insertedZones,
          racks: insertedRacks,
        };
      });
    } catch (error) {
      mapWarehouseLayoutError(error);
    }
  }
}

function mapLayoutTemplateRow(row: LayoutTemplateRow) {
  return {
    template_id: Number(row.template_id),
    code: row.code,
    name: row.name,
    description: row.description,
    default_config: row.default_config,
    created_at: row.created_at,
  };
}

function mapRackTemplateRow(row: RackTemplateRow) {
  return {
    template_id: Number(row.template_id),
    code: row.code,
    name: row.name,
    bay_count: row.bay_count,
    level_count: row.level_count,
    positions: row.positions,
    created_at: row.created_at,
  };
}

function mapActiveLayoutRows(rows: ActiveLayoutRow[]) {
  if (rows.length === 0) {
    return null;
  }

  const first = rows[0];
  const zones = new Map<number, ReturnType<typeof mapActiveZone>>();
  const racks = new Map<number, ReturnType<typeof mapActiveRack>>();
  const rackMapIds = new Map<number, Set<number>>();

  for (const row of rows) {
    if (row.zone_id) {
      const zoneId = Number(row.zone_id);
      if (!zones.has(zoneId)) {
        zones.set(zoneId, mapActiveZone(row));
      }
    }

    if (row.rack_layout_id) {
      const rackId = Number(row.rack_layout_id);
      if (!racks.has(rackId)) {
        racks.set(rackId, mapActiveRack(row));
        rackMapIds.set(rackId, new Set());
      }

      if (row.map_id) {
        const mapId = Number(row.map_id);
        const seenMapIds = rackMapIds.get(rackId);
        if (seenMapIds && !seenMapIds.has(mapId)) {
          racks.get(rackId)?.slot_maps.push(mapActiveSlotMap(row));
          seenMapIds.add(mapId);
        }
      }
    }
  }

  return {
    layout_id: Number(first.layout_id),
    warehouse_id: first.warehouse_id,
    layout_template_id: first.layout_template_id ? Number(first.layout_template_id) : null,
    name: first.name,
    version: first.version,
    canvas_width: Number(first.canvas_width),
    canvas_height: Number(first.canvas_height),
    grid_size: Number(first.grid_size),
    zones: Array.from(zones.values()),
    racks: Array.from(racks.values()),
  };
}

function mapActiveZone(row: ActiveLayoutRow) {
  return {
    zone_id: Number(row.zone_id),
    code: row.zone_code,
    name: row.zone_name,
    x: Number(row.zone_x),
    y: Number(row.zone_y),
    width: Number(row.zone_width),
    height: Number(row.zone_height),
    color: row.zone_color,
    seq: row.zone_seq,
  };
}

function mapActiveRack(row: ActiveLayoutRow) {
  return {
    rack_layout_id: Number(row.rack_layout_id),
    template_id: Number(row.rack_template_id),
    zone_id: row.rack_zone_id ? Number(row.rack_zone_id) : null,
    code: row.rack_code,
    name: row.rack_name,
    x: Number(row.rack_x),
    y: Number(row.rack_y),
    rotation: Number(row.rack_rotation),
    seq: row.rack_seq,
    slot_maps: [] as ReturnType<typeof mapActiveSlotMap>[],
  };
}

function mapActiveSlotMap(row: ActiveLayoutRow) {
  return {
    map_id: Number(row.map_id),
    slot_id: Number(row.slot_id),
    slot_code: row.slot_code,
    bay_no: row.bay_no,
    level_no: row.level_no,
    position: row.position,
  };
}

function mapLayoutHeaderRow(row: LayoutHeaderRow) {
  return {
    layout_id: Number(row.layout_id),
    warehouse_id: row.warehouse_id,
    layout_template_id: row.layout_template_id ? Number(row.layout_template_id) : null,
    name: row.name,
    version: row.version,
    canvas_width: Number(row.canvas_width),
    canvas_height: Number(row.canvas_height),
    grid_size: Number(row.grid_size),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapLayoutZoneRow(row: LayoutZoneRow) {
  return {
    zone_id: Number(row.zone_id),
    code: row.code,
    name: row.name,
    x: Number(row.x),
    y: Number(row.y),
    width: Number(row.width),
    height: Number(row.height),
    color: row.color,
    seq: row.seq,
  };
}

function mapRackLayoutRow(row: RackLayoutRow) {
  return {
    rack_layout_id: Number(row.rack_layout_id),
    template_id: Number(row.template_id),
    zone_id: row.zone_id ? Number(row.zone_id) : null,
    code: row.code,
    name: row.name,
    x: Number(row.x),
    y: Number(row.y),
    rotation: Number(row.rotation),
    seq: row.seq,
  };
}

function mapRackSlotMapRow(row: RackSlotMapRow) {
  return {
    map_id: Number(row.map_id),
    slot_id: Number(row.slot_id),
    bay_no: row.bay_no,
    level_no: row.level_no,
    position: row.position,
  };
}

function mapProductVisualLocationRow(row: ProductVisualLocationRow) {
  return {
    product_id: row.product_id,
    warehouse_id: row.warehouse_id,
    warehouse_name: row.warehouse_name,
    slot_id: row.slot_id ? Number(row.slot_id) : null,
    slot_code: row.slot_code,
    rack_layout_id: row.rack_layout_id ? Number(row.rack_layout_id) : null,
    rack_code: row.rack_code,
    bay_no: row.bay_no,
    level_no: row.level_no,
    position_code: row.position_code,
    quality: row.quality,
    batch_id: row.batch_id,
    qty_on_hand: Number(row.qty_on_hand),
    reserved_qty: Number(row.frozen_qty),
    available_qty: Number(row.available_qty),
    highlight_kind: row.highlight_kind,
  };
}

async function getWarehouse(warehouseId: string, query: DatabaseQuery = queryDatabase) {
  const result = await query<WarehouseRow>(
    'SELECT warehouse_id, has_slots FROM warehouse WHERE warehouse_id = $1::text',
    [warehouseId],
  );
  if (!result.rows[0]) {
    throw new NotFoundException('仓库不存在');
  }
  return result.rows[0];
}

async function validateSlotMaps(query: DatabaseQuery, warehouseId: string, maps: NormalizedRackSlotMap[]) {
  for (const map of maps) {
    const result = await query(buildSlotWarehouseValidationQuery().text, [map.slot_id, warehouseId]);
    if (!result.rows[0]) {
      throw new ConflictException('库位不属于当前布局仓库');
    }
  }
}

function resolveRackZoneId(
  rack: NormalizedRackLayout,
  zoneIdByInputId: Map<number, number>,
  zoneIdByCode: Map<string, number>,
) {
  if (rack.zone_id !== null) {
    const zoneId = zoneIdByInputId.get(rack.zone_id);
    if (!zoneId) {
      throw new BadRequestException('货架区域不存在');
    }
    return zoneId;
  }
  if (rack.zone_code !== null) {
    const zoneId = zoneIdByCode.get(rack.zone_code);
    if (!zoneId) {
      throw new BadRequestException('货架区域不存在');
    }
    return zoneId;
  }
  return null;
}

function normalizeZones(value: unknown): NormalizedLayoutZone[] {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new BadRequestException('区域必须是数组');
  }
  return value.map((zone, index) => ({
    zone_id: optionalPositiveInteger(zone.zone_id, '区域 ID 必须是正整数'),
    code: requireText(zone.code, '区域编码不能为空'),
    name: requireText(zone.name, '区域名称不能为空'),
    x: requireNumber(zone.x, '区域 X 坐标必须是数字'),
    y: requireNumber(zone.y, '区域 Y 坐标必须是数字'),
    width: requireNonNegativeNumber(zone.width, '区域宽度不能是负数'),
    height: requireNonNegativeNumber(zone.height, '区域高度不能是负数'),
    color: nullableText(zone.color),
    seq: optionalInteger(zone.seq, '区域排序必须是整数') ?? index,
  }));
}

function normalizeRacks(value: unknown): NormalizedRackLayout[] {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new BadRequestException('货架必须是数组');
  }
  return value.map((rack, index) => ({
    rack_layout_id: optionalPositiveInteger(rack.rack_layout_id, '货架 ID 必须是正整数'),
    template_id: requirePositiveInteger(rack.template_id, '货架模板 ID 不能为空'),
    zone_id: optionalPositiveInteger(rack.zone_id, '货架区域 ID 必须是正整数'),
    zone_code: nullableText(rack.zone_code),
    code: requireText(rack.code, '货架编码不能为空'),
    name: requireText(rack.name, '货架名称不能为空'),
    x: requireNumber(rack.x, '货架 X 坐标必须是数字'),
    y: requireNumber(rack.y, '货架 Y 坐标必须是数字'),
    rotation: optionalNumber(rack.rotation, '货架角度必须是数字') ?? 0,
    seq: optionalInteger(rack.seq, '货架排序必须是整数') ?? index,
    slot_maps: normalizeSlotMaps(rack.slot_maps),
  }));
}

function normalizeSlotMaps(value: unknown): NormalizedRackSlotMap[] {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new BadRequestException('库位映射必须是数组');
  }
  return value.map((map) => ({
    map_id: optionalPositiveInteger(map.map_id, '映射 ID 必须是正整数'),
    slot_id: requirePositiveInteger(map.slot_id, '库位 ID 不能为空'),
    bay_no: requirePositiveInteger(map.bay_no, '货架列号必须是正整数'),
    level_no: requirePositiveInteger(map.level_no, '货架层号必须是正整数'),
    position: requirePosition(map.position),
  }));
}

function requireText(value: unknown, message: string) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new BadRequestException(message);
  }
  return value.trim();
}

function nullableText(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }
  return value.trim();
}

function requireNumber(value: unknown, message: string) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) {
    throw new BadRequestException(message);
  }
  return numberValue;
}

function requirePositiveNumber(value: unknown, message: string) {
  const numberValue = requireNumber(value, message);
  if (numberValue <= 0) {
    throw new BadRequestException(message);
  }
  return numberValue;
}

function requireNonNegativeNumber(value: unknown, message: string) {
  const numberValue = requireNumber(value, message);
  if (numberValue < 0) {
    throw new BadRequestException(message);
  }
  return numberValue;
}

function optionalNumber(value: unknown, message: string) {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  return requireNumber(value, message);
}

function optionalPositiveNumber(value: unknown, message: string) {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  return requirePositiveNumber(value, message);
}

function requirePositiveInteger(value: unknown, message: string) {
  const numberValue = Number(value);
  if (!Number.isInteger(numberValue) || numberValue <= 0) {
    throw new BadRequestException(message);
  }
  return numberValue;
}

function optionalPositiveInteger(value: unknown, message: string) {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  return requirePositiveInteger(value, message);
}

function optionalInteger(value: unknown, message: string) {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const numberValue = Number(value);
  if (!Number.isInteger(numberValue)) {
    throw new BadRequestException(message);
  }
  return numberValue;
}

function normalizePositions(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new BadRequestException('货架位置必须至少包含 A/B/C 中的一个');
  }
  const positions = value.map((item) => String(item).trim().toUpperCase());
  if (positions.some((item) => !['A', 'B', 'C'].includes(item))) {
    throw new BadRequestException('货架位置只能是 A/B/C');
  }
  return Array.from(new Set(positions));
}

function requirePosition(value: unknown) {
  const position = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (!['A', 'B', 'C'].includes(position)) {
    throw new BadRequestException('库位位置只能是 A/B/C');
  }
  return position;
}

function mapWarehouseLayoutError(error: unknown): never {
  if (error instanceof HttpException) {
    throw error;
  }

  const pgError = error as { code?: string; message?: string };
  if (pgError.code === '23503') {
    throw new ConflictException('引用的仓库、货架模板或库位不存在');
  }
  if (pgError.code === '23505') {
    throw new ConflictException('布局元素重复');
  }
  if (pgError.code === '23514' || pgError.code === '22P02') {
    throw new BadRequestException(pgError.message ?? '布局数据不合法');
  }
  throw error;
}

type NormalizedLayoutZone = {
  zone_id: number | null;
  code: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string | null;
  seq: number;
};

type NormalizedRackLayout = {
  rack_layout_id: number | null;
  template_id: number;
  zone_id: number | null;
  zone_code: string | null;
  code: string;
  name: string;
  x: number;
  y: number;
  rotation: number;
  seq: number;
  slot_maps: NormalizedRackSlotMap[];
};

type NormalizedRackSlotMap = {
  map_id: number | null;
  slot_id: number;
  bay_no: number;
  level_no: number;
  position: string;
};
