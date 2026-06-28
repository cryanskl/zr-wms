export type OrderType = 'PURCHASE' | 'PRODUCTION';

export interface OrderFilters {
  type?: OrderType;
  status?: string;
}

export interface OrderLineInput {
  product_id: string;
  qty: number;
  line_status?: string;
}

export interface OrderInput {
  order_type: OrderType;
  partner?: string | null;
  due_date?: string | null;
  status?: string;
  lines: OrderLineInput[];
}

export interface OrderPatchInput {
  partner?: string | null;
  due_date?: string | null;
  status?: string;
}

export interface OrderSummary {
  order_id: number;
  order_type: OrderType;
  partner: string | null;
  due_date: string | null;
  status: string;
  created_by: number | null;
  created_at: string;
  line_count: number;
  total_qty: number;
}

export interface OrderLine {
  order_line_id: number;
  order_id: number;
  product_id: string;
  product_name: string;
  qty: number;
  qty_done: number;
  line_status: string;
}

export interface OrderDetail extends Omit<OrderSummary, 'line_count' | 'total_qty'> {
  lines: OrderLine[];
}

export function isOrderDetail(value: unknown): value is OrderDetail {
  return typeof value === 'object' && value !== null && Array.isArray((value as { lines?: unknown }).lines);
}

export function buildOrdersUrl(filters: OrderFilters = {}) {
  const params = new URLSearchParams();
  if (filters.type) params.set('type', filters.type);
  if (filters.status) params.set('status', filters.status);
  const suffix = params.toString();
  return `/api/v1/orders${suffix ? `?${suffix}` : ''}`;
}

export function buildCreateOrderRequest(input: OrderInput) {
  return {
    url: '/api/v1/orders',
    init: {
      method: 'POST',
      body: JSON.stringify(input),
    },
  };
}

export function buildPatchOrderRequest(orderId: number, input: OrderPatchInput) {
  return {
    url: `/api/v1/orders/${orderId}`,
    init: {
      method: 'PATCH',
      body: JSON.stringify(input),
    },
  };
}

export function listOrders(token: string, filters: OrderFilters = {}) {
  return apiFetch<OrderSummary[]>(buildOrdersUrl(filters), token);
}

export function createOrder(token: string, input: OrderInput) {
  const request = buildCreateOrderRequest(input);
  return apiFetch<OrderDetail>(request.url, token, request.init);
}

export function getOrder(token: string, orderId: number) {
  return apiFetch<OrderDetail>(`/api/v1/orders/${orderId}`, token);
}

export function patchOrder(token: string, orderId: number, input: OrderPatchInput) {
  const request = buildPatchOrderRequest(orderId, input);
  return apiFetch<OrderDetail>(request.url, token, request.init);
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
