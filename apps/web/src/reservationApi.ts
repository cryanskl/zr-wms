export interface ReservationInput {
  order_id: number;
  product_id: string;
  slot_id: number;
  qty: number;
  batch_id?: number | null;
}

export interface ReservationRow {
  reservation_id: number;
  order_id: number;
  product_id: string;
  product_name: string;
  warehouse_id: string;
  slot_id: number;
  slot_code: string;
  batch_id: number | null;
  qty: number;
  status: 'RESERVED' | 'RELEASED' | 'CONSUMED';
  version: number;
  created_at: string;
}

export function buildOrderReservationsUrl(orderId: number) {
  return `/api/v1/orders/${orderId}/reservations`;
}

export function buildCreateReservationRequest(input: ReservationInput) {
  return {
    url: '/api/v1/reservations',
    init: {
      method: 'POST',
      body: JSON.stringify(input),
    },
  };
}

export function buildFulfillReservationRequest(reservationId: number) {
  return {
    url: `/api/v1/reservations/${reservationId}/fulfill`,
    init: { method: 'POST' },
  };
}

export function buildReleaseReservationRequest(reservationId: number) {
  return {
    url: `/api/v1/reservations/${reservationId}/release`,
    init: { method: 'POST' },
  };
}

export function listOrderReservations(token: string, orderId: number) {
  return apiFetch<ReservationRow[]>(buildOrderReservationsUrl(orderId), token);
}

export function createReservation(token: string, input: ReservationInput) {
  const request = buildCreateReservationRequest(input);
  return apiFetch<{ reservation_id: number }>(request.url, token, request.init);
}

export function fulfillReservation(token: string, reservationId: number) {
  const request = buildFulfillReservationRequest(reservationId);
  return apiFetch<{ movement_id: number }>(request.url, token, request.init);
}

export function releaseReservation(token: string, reservationId: number) {
  const request = buildReleaseReservationRequest(reservationId);
  return apiFetch<{ reservation_id: number }>(request.url, token, request.init);
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
