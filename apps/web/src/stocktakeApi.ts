export interface StocktakeInput {
  warehouse_id?: string | null;
}

export interface Stocktake {
  stocktake_id: number;
  warehouse_id: string | null;
  status: string;
  created_by: number | null;
  created_at: string;
  lines: StocktakeLine[];
}

export interface StocktakeLineInput {
  product_id: string;
  slot_id: number;
  counted_qty: number;
  batch_id?: number | null;
}

export interface StocktakeLine {
  stline_id: number;
  stocktake_id: number;
  product_id: string;
  slot_id: number | null;
  batch_id: number | null;
  system_qty: number | null;
  counted_qty: number | null;
  diff: number | null;
  adj_movement_id: number | null;
}

export interface ApplyStocktakeLineResult {
  stline_id: number;
  movement_id: number | null;
}

export function buildCreateStocktakeRequest(input: StocktakeInput) {
  return {
    url: '/api/v1/stocktakes',
    init: {
      method: 'POST',
      body: JSON.stringify(input),
    },
  };
}

export function buildAddStocktakeLineRequest(stocktakeId: number, input: StocktakeLineInput) {
  return {
    url: `/api/v1/stocktakes/${stocktakeId}/lines`,
    init: {
      method: 'POST',
      body: JSON.stringify(input),
    },
  };
}

export function buildApplyStocktakeLineRequest(stlineId: number) {
  return {
    url: `/api/v1/stocktake-lines/${stlineId}/apply`,
    init: {
      method: 'POST',
    },
  };
}

export function createStocktake(token: string, input: StocktakeInput) {
  const request = buildCreateStocktakeRequest(input);
  return apiFetch<Stocktake>(request.url, token, request.init);
}

export function addStocktakeLine(token: string, stocktakeId: number, input: StocktakeLineInput) {
  const request = buildAddStocktakeLineRequest(stocktakeId, input);
  return apiFetch<StocktakeLine>(request.url, token, request.init);
}

export function applyStocktakeLine(token: string, stlineId: number) {
  const request = buildApplyStocktakeLineRequest(stlineId);
  return apiFetch<ApplyStocktakeLineResult>(request.url, token, request.init);
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
