export type ProductType = 'RM' | 'SF' | 'FG' | 'ACC';

export interface ProductFilters {
  type?: ProductType;
  active?: boolean;
}

export interface ProductInput {
  product_id?: string;
  type: ProductType;
  name: string;
  has_tube?: boolean;
  has_alu_plate?: boolean;
  has_dust_cover?: boolean;
  attrs?: Record<string, unknown>;
  safety_stock?: number | null;
  remark?: string | null;
}

export interface ProductSummary extends Required<Omit<ProductInput, 'safety_stock' | 'remark'>> {
  safety_stock: number | null;
  remark: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductAlias {
  alias_id: number;
  product_id: string;
  alias_text: string;
  created_at: string;
}

export interface ProductImage {
  image_id: number;
  product_id: string;
  url: string;
  seq: number;
}

export interface ProductPathAlias {
  path_alias_id: number;
  product_id: string;
  root_product_id: string;
  path_text: string;
  generated_at: string;
}

export interface ProductDetail extends ProductSummary {
  aliases: ProductAlias[];
  images: ProductImage[];
  path_aliases: ProductPathAlias[];
}

export function buildProductsUrl(filters: ProductFilters = {}) {
  const params = new URLSearchParams();
  if (filters.type) params.set('type', filters.type);
  if (filters.active !== undefined) params.set('active', String(filters.active));

  const suffix = params.toString();
  return `/api/v1/products${suffix ? `?${suffix}` : ''}`;
}

export function buildCreateProductRequest(input: ProductInput) {
  return {
    url: '/api/v1/products',
    init: {
      method: 'POST',
      body: JSON.stringify(input),
    },
  };
}

export function listProducts(token: string, filters: ProductFilters = {}) {
  return apiFetch<ProductSummary[]>(buildProductsUrl(filters), token);
}

export function getProduct(token: string, productId: string) {
  return apiFetch<ProductDetail>(`/api/v1/products/${encodeURIComponent(productId)}`, token);
}

export function createProduct(token: string, input: ProductInput) {
  const request = buildCreateProductRequest(input);
  return apiFetch<{ product_id: string }>(request.url, token, request.init);
}

export function updateProduct(token: string, productId: string, input: ProductInput) {
  return apiFetch<{ product_id: string }>(`/api/v1/products/${encodeURIComponent(productId)}`, token, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function softDeleteProduct(token: string, productId: string) {
  return apiFetch<{ product_id: string }>(`/api/v1/products/${encodeURIComponent(productId)}`, token, {
    method: 'DELETE',
  });
}

export function addProductAlias(token: string, productId: string, alias_text: string) {
  return apiFetch<ProductAlias>(`/api/v1/products/${encodeURIComponent(productId)}/aliases`, token, {
    method: 'POST',
    body: JSON.stringify({ alias_text }),
  });
}

export function deleteProductAlias(token: string, productId: string, aliasId: number) {
  return apiFetch<{ alias_id: number }>(
    `/api/v1/products/${encodeURIComponent(productId)}/aliases/${aliasId}`,
    token,
    { method: 'DELETE' },
  );
}

export function addProductImage(token: string, productId: string, url: string, seq?: number) {
  return apiFetch<ProductImage>(`/api/v1/products/${encodeURIComponent(productId)}/images`, token, {
    method: 'POST',
    body: JSON.stringify({ url, seq }),
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
