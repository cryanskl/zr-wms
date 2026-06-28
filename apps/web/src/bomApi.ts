export interface BomLineInput {
  child_product_id: string;
  qty: number;
  seq: number;
}

export interface BomLine extends BomLineInput {
  bom_line_id: number;
  parent_product_id: string;
  child_name: string;
  child_type: string;
}

export interface ReplaceBomResult {
  line_count: number;
  regenerated_aliases: number;
}

export interface WhereUsedRow {
  parent_product_id: string;
  parent_name: string;
  ptype: string;
  lvl: number;
}

export interface PathAliasRow {
  path_alias_id: number;
  product_id: string;
  root_product_id: string;
  path_text: string;
  generated_at: string;
}

export interface ProducibleOptions {
  deep?: boolean;
  useSfStock?: boolean;
}

export interface ProducibleResult {
  target: string;
  maxMake: number;
  limiting: string | null;
  limitingOnHand: number | null;
  limitingDemand?: number | null;
}

export function buildBomUrl(productId: string) {
  return `/api/v1/products/${encodeURIComponent(productId)}/bom`;
}

export function buildWhereUsedUrl(productId: string, recursive = false) {
  const params = new URLSearchParams();
  if (recursive) params.set('recursive', 'true');
  const suffix = params.toString();
  return `/api/v1/products/${encodeURIComponent(productId)}/where-used${suffix ? `?${suffix}` : ''}`;
}

export function buildPathAliasesUrl(productId: string) {
  return `/api/v1/products/${encodeURIComponent(productId)}/path-aliases`;
}

export function buildProducibleUrl(productId: string, options: ProducibleOptions = {}) {
  const params = new URLSearchParams();
  if (options.deep) params.set('deep', 'true');
  if (options.deep && options.useSfStock === false) params.set('useSfStock', 'false');
  const suffix = params.toString();
  return `/api/v1/products/${encodeURIComponent(productId)}/producible${suffix ? `?${suffix}` : ''}`;
}

export function buildReplaceBomRequest(productId: string, lines: BomLineInput[]) {
  return {
    url: buildBomUrl(productId),
    init: {
      method: 'PUT',
      body: JSON.stringify({ lines }),
    },
  };
}

export function getBom(token: string, productId: string) {
  return apiFetch<BomLine[]>(buildBomUrl(productId), token);
}

export function replaceBom(token: string, productId: string, lines: BomLineInput[]) {
  const request = buildReplaceBomRequest(productId, lines);
  return apiFetch<ReplaceBomResult>(request.url, token, request.init);
}

export function regeneratePathAliases(token: string) {
  return apiFetch<{ regenerated_aliases: number }>('/api/v1/bom/regenerate-aliases', token, { method: 'POST' });
}

export function getWhereUsed(token: string, productId: string, recursive = false) {
  return apiFetch<WhereUsedRow[]>(buildWhereUsedUrl(productId, recursive), token);
}

export function getPathAliases(token: string, productId: string) {
  return apiFetch<PathAliasRow[]>(buildPathAliasesUrl(productId), token);
}

export function getProducible(token: string, productId: string, options: ProducibleOptions = {}) {
  return apiFetch<ProducibleResult>(buildProducibleUrl(productId, options), token);
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
