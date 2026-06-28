import { SearchResult } from './searchApi';

export interface Warehouse {
  warehouse_id: string;
  name: string;
  has_slots: boolean;
}

export interface Slot {
  slot_id: number;
  code: string;
}

export interface InventoryRow {
  product_id: string;
  warehouse_id: string;
  slot_id: number | null;
  quality: string;
  qty_on_hand: number;
  available: number;
}

export interface StockOperationPayload {
  product: string;
  warehouse: string;
  qty: number;
  slot: number | null;
  quality?: string;
  type?: string;
  reason?: string | null;
}

export interface TransferPayload {
  product: string;
  qty: number;
  fromWarehouse: string;
  fromSlot: number;
  toWarehouse: string;
  toSlot: number;
  quality?: string;
  reason?: string | null;
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

export function getWarehouses(token: string) {
  return apiFetch<Warehouse[]>('/api/v1/warehouses', token);
}

export function getSlots(token: string, warehouseId: string) {
  return apiFetch<Slot[]>(`/api/v1/warehouses/${warehouseId}/slots`, token);
}

export function getInventory(token: string, productId?: string) {
  const params = new URLSearchParams();
  if (productId) params.set('product', productId);
  const suffix = params.toString() ? `?${params.toString()}` : '';
  return apiFetch<InventoryRow[]>(`/api/v1/inventory${suffix}`, token);
}

export function inbound(token: string, payload: StockOperationPayload) {
  return apiFetch<{ movementId: number }>('/api/v1/inbound', token, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function outbound(token: string, payload: StockOperationPayload, force = false) {
  return apiFetch<{ movementId: number }>(`/api/v1/outbound${force ? '?force=true' : ''}`, token, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function transfer(token: string, payload: TransferPayload) {
  return apiFetch<{ movementIds: number[] }>('/api/v1/transfer', token, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function searchResultLabel(result: SearchResult) {
  return `${result.product_id} ${result.name}`;
}
