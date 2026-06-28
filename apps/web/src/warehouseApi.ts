export type WarehouseType = 'NORMAL' | 'MOLD' | 'OUTSOURCE';
export type SlotStatus = 'AVAILABLE' | 'OCCUPIED' | 'UNUSABLE' | 'MERGED';

export interface WarehouseInput {
  warehouse_id: string;
  name: string;
  type: WarehouseType;
  has_slots: boolean;
}

export interface Warehouse extends WarehouseInput {
  created_at?: string;
}

export interface Slot {
  slot_id: number;
  warehouse_id: string;
  code: string;
  row_no: number | null;
  col_no: number | null;
  level_no: number | null;
  position: string | null;
  status: SlotStatus;
  status_reason: string | null;
  merged_into: number | null;
}

export interface SlotTemplateInput {
  rows: number;
  cols: number;
  levels: number;
  positions: string[];
}

export interface SlotPatchInput {
  status: SlotStatus;
  status_reason?: string | null;
  merged_into?: number | null;
}

export function buildSlotsUrl(warehouseId: string, includeUnavailable = false) {
  const params = new URLSearchParams();
  if (includeUnavailable) params.set('includeUnavailable', 'true');
  const suffix = params.toString();
  return `/api/v1/warehouses/${encodeURIComponent(warehouseId)}/slots${suffix ? `?${suffix}` : ''}`;
}

export function buildCreateWarehouseRequest(input: WarehouseInput) {
  return {
    url: '/api/v1/warehouses',
    init: {
      method: 'POST',
      body: JSON.stringify(input),
    },
  };
}

export function buildTemplateSlotsRequest(warehouseId: string, input: SlotTemplateInput) {
  return {
    url: `/api/v1/warehouses/${encodeURIComponent(warehouseId)}/slots:template`,
    init: {
      method: 'POST',
      body: JSON.stringify(input),
    },
  };
}

export function listWarehouses(token: string) {
  return apiFetch<Warehouse[]>('/api/v1/warehouses', token);
}

export function createWarehouse(token: string, input: WarehouseInput) {
  const request = buildCreateWarehouseRequest(input);
  return apiFetch<Warehouse>(request.url, token, request.init);
}

export function listSlots(token: string, warehouseId: string, includeUnavailable = false) {
  return apiFetch<Slot[]>(buildSlotsUrl(warehouseId, includeUnavailable), token);
}

export function generateSlotsFromTemplate(token: string, warehouseId: string, input: SlotTemplateInput) {
  const request = buildTemplateSlotsRequest(warehouseId, input);
  return apiFetch<{ created: number; slots: Slot[] }>(request.url, token, request.init);
}

export function updateSlot(token: string, slotId: number, input: SlotPatchInput) {
  return apiFetch<Slot>(`/api/v1/slots/${slotId}`, token, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
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
