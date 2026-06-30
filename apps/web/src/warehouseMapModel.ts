import type {
  WarehouseLayout,
  WarehouseLayoutSaveInput,
  ProductVisualHighlightKind,
  ProductVisualLocation,
  RackLayout,
  RackSlotMap,
  RackTemplate,
} from './warehouseMapApi';

export interface ElevationCell {
  key: string;
  rack_layout_id: number;
  bay_no: number;
  level_no: number;
  position: string;
  map: RackSlotMap | null;
  locations: ProductVisualLocation[];
  hit_count: number;
  highlight_kind: ProductVisualHighlightKind | null;
}

export function groupLocationsByWarehouse(locations: ProductVisualLocation[]) {
  const grouped = new Map<string, ProductVisualLocation[]>();

  for (const location of locations) {
    const current = grouped.get(location.warehouse_id) ?? [];
    grouped.set(location.warehouse_id, [...current, location]);
  }

  return grouped;
}

export function getWarehouseHitCount(warehouseId: string, locations: ProductVisualLocation[]) {
  return locations.filter((location) => location.warehouse_id === warehouseId).length;
}

export function getRackHitCount(rackLayoutId: number, locations: ProductVisualLocation[]) {
  return locations.filter((location) => location.rack_layout_id === rackLayoutId).length;
}

export function buildElevationCells(
  rack: RackLayout,
  template: RackTemplate,
  mappings: RackSlotMap[],
  locations: ProductVisualLocation[],
): ElevationCell[] {
  const mapsByCoordinate = new Map<string, RackSlotMap>();
  for (const map of mappings) {
    mapsByCoordinate.set(buildCoordinateKey(map.bay_no, map.level_no, map.position), map);
  }

  const locationsByCoordinate = new Map<string, ProductVisualLocation[]>();
  for (const location of locations) {
    if (
      location.rack_layout_id !== rack.rack_layout_id ||
      location.bay_no === null ||
      location.level_no === null ||
      location.position_code === null
    ) {
      continue;
    }

    const key = buildCoordinateKey(location.bay_no, location.level_no, location.position_code);
    locationsByCoordinate.set(key, [...(locationsByCoordinate.get(key) ?? []), location]);
  }

  const cells: ElevationCell[] = [];
  for (let level = 1; level <= template.level_count; level += 1) {
    for (let bay = 1; bay <= template.bay_count; bay += 1) {
      for (const position of template.positions) {
        const coordinateKey = buildCoordinateKey(bay, level, position);
        const cellLocations = locationsByCoordinate.get(coordinateKey) ?? [];
        cells.push({
          key: `${rack.rack_layout_id}:${bay}:${level}:${position}`,
          rack_layout_id: rack.rack_layout_id,
          bay_no: bay,
          level_no: level,
          position,
          map: mapsByCoordinate.get(coordinateKey) ?? null,
          locations: cellLocations,
          hit_count: cellLocations.length,
          highlight_kind: getCellHighlightKind(cellLocations),
        });
      }
    }
  }

  return cells;
}

export function normalizeCanvasPosition(value: number, gridSize: number) {
  if (gridSize <= 0) {
    return value;
  }

  return Math.max(0, Math.round(value / gridSize) * gridSize);
}

export function buildWarehouseLayoutSaveInput(layout: WarehouseLayout): WarehouseLayoutSaveInput {
  return {
    version: layout.version,
    name: layout.name,
    canvas_width: layout.canvas_width,
    canvas_height: layout.canvas_height,
    grid_size: layout.grid_size,
    zones: layout.zones.map((zone) => ({
      zone_id: zone.zone_id > 0 ? zone.zone_id : undefined,
      code: zone.code,
      name: zone.name,
      x: zone.x,
      y: zone.y,
      width: zone.width,
      height: zone.height,
      color: zone.color,
      seq: zone.seq,
    })),
    racks: layout.racks.map((rack) => ({
      rack_layout_id: rack.rack_layout_id > 0 ? rack.rack_layout_id : undefined,
      template_id: rack.template_id,
      zone_id: rack.zone_id && rack.zone_id > 0 ? rack.zone_id : null,
      code: rack.code,
      name: rack.name,
      x: rack.x,
      y: rack.y,
      rotation: rack.rotation,
      seq: rack.seq,
      slot_maps: rack.slot_maps.map((map) => ({
        map_id: map.map_id > 0 ? map.map_id : undefined,
        slot_id: map.slot_id,
        bay_no: map.bay_no,
        level_no: map.level_no,
        position: map.position,
      })),
    })),
  };
}

function buildCoordinateKey(bayNo: number, levelNo: number, position: string) {
  return `${bayNo}:${levelNo}:${position}`;
}

function getCellHighlightKind(locations: ProductVisualLocation[]): ProductVisualHighlightKind | null {
  if (locations.length === 0) {
    return null;
  }

  if (locations.some((location) => location.highlight_kind === 'UNMAPPED')) {
    return 'UNMAPPED';
  }
  if (locations.some((location) => location.highlight_kind === 'UNAVAILABLE')) {
    return 'UNAVAILABLE';
  }
  if (locations.some((location) => location.highlight_kind === 'DEFECTIVE')) {
    return 'DEFECTIVE';
  }
  return 'GOOD';
}
