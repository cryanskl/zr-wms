export interface WarehouseLayoutTemplate {
  template_id: number;
  code: string;
  name: string;
  description: string | null;
  default_config: unknown;
  created_at: string;
}

export interface RackTemplate {
  template_id: number;
  code: string;
  name: string;
  bay_count: number;
  level_count: number;
  positions: string[];
  created_at: string;
}

export interface WarehouseLayout {
  layout_id: number;
  warehouse_id: string;
  layout_template_id: number | null;
  name: string;
  version: number;
  canvas_width: number;
  canvas_height: number;
  grid_size: number;
  zones: LayoutZone[];
  racks: RackLayout[];
  created_at?: string;
  updated_at?: string;
}

export interface LayoutZone {
  zone_id: number;
  code: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string | null;
  seq: number | null;
}

export interface RackLayout {
  rack_layout_id: number;
  template_id: number;
  zone_id: number | null;
  code: string;
  name: string;
  x: number;
  y: number;
  rotation: number;
  seq: number | null;
  slot_maps: RackSlotMap[];
}

export interface RackSlotMap {
  map_id: number;
  slot_id: number;
  slot_code?: string | null;
  bay_no: number;
  level_no: number;
  position: string;
}

export type ProductVisualHighlightKind = 'GOOD' | 'DEFECTIVE' | 'UNAVAILABLE' | 'UNMAPPED';

export interface ProductVisualLocation {
  product_id: string;
  warehouse_id: string;
  warehouse_name: string;
  slot_id: number | null;
  slot_code: string | null;
  rack_layout_id: number | null;
  rack_code: string | null;
  bay_no: number | null;
  level_no: number | null;
  position_code: string | null;
  quality: string;
  batch_id: string | null;
  qty_on_hand: number;
  reserved_qty: number;
  available_qty: number;
  highlight_kind: ProductVisualHighlightKind;
}

export interface RackTemplateInput {
  code: string;
  name: string;
  bay_count: number;
  level_count: number;
  positions: string[];
}

export interface WarehouseLayoutCreateInput {
  warehouse_id: string;
  layout_template_id?: number | null;
  name: string;
  canvas_width: number;
  canvas_height: number;
  grid_size?: number | null;
}

export interface WarehouseLayoutSaveInput {
  version: number;
  name: string;
  canvas_width: number;
  canvas_height: number;
  grid_size?: number | null;
  zones: LayoutZoneSaveInput[];
  racks: RackLayoutSaveInput[];
}

export interface LayoutZoneSaveInput {
  zone_id?: number;
  code: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string | null;
  seq?: number | null;
}

export interface RackLayoutSaveInput {
  rack_layout_id?: number;
  template_id: number;
  zone_id?: number | null;
  zone_code?: string | null;
  code: string;
  name: string;
  x: number;
  y: number;
  rotation?: number | null;
  seq?: number | null;
  slot_maps: RackSlotMapSaveInput[];
}

export interface RackSlotMapSaveInput {
  map_id?: number;
  slot_id: number;
  bay_no: number;
  level_no: number;
  position: string;
}

export function buildWarehouseLayoutTemplatesUrl() {
  return '/api/v1/warehouse-layout-templates';
}

export function buildRackTemplatesUrl() {
  return '/api/v1/rack-templates';
}

export function buildWarehouseLayoutUrl(warehouseId: string) {
  const params = new URLSearchParams({ warehouse: warehouseId });
  return `/api/v1/warehouse-layouts?${params.toString()}`;
}

export function buildProductVisualLocationsUrl(productId: string) {
  return `/api/v1/products/${encodeURIComponent(productId)}/visual-locations`;
}

export function buildCreateRackTemplateRequest(input: RackTemplateInput) {
  return {
    url: buildRackTemplatesUrl(),
    init: {
      method: 'POST',
      body: JSON.stringify(input),
    },
  };
}

export function buildCreateWarehouseLayoutRequest(input: WarehouseLayoutCreateInput) {
  return {
    url: '/api/v1/warehouse-layouts',
    init: {
      method: 'POST',
      body: JSON.stringify(input),
    },
  };
}

export function buildSaveWarehouseLayoutRequest(layoutId: number | string, input: WarehouseLayoutSaveInput) {
  return {
    url: `/api/v1/warehouse-layouts/${encodeURIComponent(String(layoutId))}`,
    init: {
      method: 'PUT',
      body: JSON.stringify(input),
    },
  };
}

export function listWarehouseLayoutTemplates(token: string) {
  return apiFetch<WarehouseLayoutTemplate[]>(buildWarehouseLayoutTemplatesUrl(), token);
}

export function listRackTemplates(token: string) {
  return apiFetch<RackTemplate[]>(buildRackTemplatesUrl(), token);
}

export function createRackTemplate(token: string, input: RackTemplateInput) {
  const request = buildCreateRackTemplateRequest(input);
  return apiFetch<RackTemplate>(request.url, token, request.init);
}

export function getWarehouseLayout(token: string, warehouseId: string) {
  return apiFetch<WarehouseLayout | null>(buildWarehouseLayoutUrl(warehouseId), token);
}

export function createWarehouseLayout(token: string, input: WarehouseLayoutCreateInput) {
  const request = buildCreateWarehouseLayoutRequest(input);
  return apiFetch<WarehouseLayout>(request.url, token, request.init);
}

export function saveWarehouseLayout(token: string, layoutId: number | string, input: WarehouseLayoutSaveInput) {
  const request = buildSaveWarehouseLayoutRequest(layoutId, input);
  return apiFetch<WarehouseLayout>(request.url, token, request.init);
}

export function getProductVisualLocations(token: string, productId: string) {
  return apiFetch<ProductVisualLocation[]>(buildProductVisualLocationsUrl(productId), token);
}

async function apiFetch<T>(url: string, token: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? `请求失败：HTTP ${response.status}`);
  }

  return response.json() as Promise<T>;
}
