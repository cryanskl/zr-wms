export type SearchMatchedField = 'name' | 'alias' | 'path_alias' | 'remark';

export interface SearchResult {
  product_id: string;
  name: string;
  matched: SearchMatchedField;
  snippet: string;
  score: number;
}

export function buildSearchUrl(query: string) {
  const params = new URLSearchParams({ q: query });
  return `/api/v1/search?${params.toString()}`;
}

export async function searchProducts(query: string, token?: string): Promise<SearchResult[]> {
  if (!query.trim()) {
    return [];
  }

  const response = await fetch(buildSearchUrl(query), {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!response.ok) {
    throw new Error(`搜索失败：HTTP ${response.status}`);
  }

  return response.json() as Promise<SearchResult[]>;
}
