export interface InventoryFilters {
  product?: string;
  warehouse?: string;
  slot?: number | string | null;
  quality?: string;
}

export interface InventoryDashboardRow {
  inventory_id: number;
  product_id: string;
  product_name: string;
  warehouse_id: string;
  warehouse_name: string;
  slot_id: number | null;
  slot_code: string | null;
  quality: string;
  qty_on_hand: number;
  available: number;
  frozen: number;
}

export interface InventorySummary {
  total: number;
  available: number;
  frozen: number;
}

export interface LowStockRow {
  product_id: string;
  product_name: string;
  safety_stock: number;
  qty_on_hand: number;
  shortage: number;
}

export function buildInventoryUrl(filters: InventoryFilters = {}) {
  const params = new URLSearchParams();
  if (filters.product) params.set('product', filters.product);
  if (filters.warehouse) params.set('warehouse', filters.warehouse);
  if (filters.slot) params.set('slot', String(filters.slot));
  if (filters.quality) params.set('quality', filters.quality);

  const suffix = params.toString();
  return `/api/v1/inventory${suffix ? `?${suffix}` : ''}`;
}

export function getInventoryDashboard(token: string, filters: InventoryFilters = {}) {
  return apiFetch<InventoryDashboardRow[]>(buildInventoryUrl(filters), token);
}

export function getInventorySummary(token: string, product?: string) {
  const params = new URLSearchParams();
  if (product) params.set('product', product);

  return apiFetch<InventorySummary>(`/api/v1/inventory/summary${params.toString() ? `?${params.toString()}` : ''}`, token);
}

export function getLowStock(token: string) {
  return apiFetch<LowStockRow[]>('/api/v1/reports/low-stock', token);
}

async function apiFetch<T>(url: string, token: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? `请求失败：HTTP ${response.status}`);
  }

  return response.json() as Promise<T>;
}
