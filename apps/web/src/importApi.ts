export type ImportType = 'products' | 'inventory' | 'bom';

export interface ImportResult {
  imported: number;
  product_ids?: string[];
  movement_ids?: number[];
  parent_product_ids?: string[];
  regenerated_aliases?: number;
}

export function buildImportUrl(type: ImportType) {
  return `/api/v1/import/${type}`;
}

export function buildImportRequest(token: string, type: ImportType, file: File) {
  const formData = new FormData();
  formData.append('file', file);

  return {
    url: buildImportUrl(type),
    init: {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    },
  };
}

export async function importExcel(token: string, type: ImportType, file: File) {
  const request = buildImportRequest(token, type, file);
  const response = await fetch(request.url, request.init);

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? `导入失败：HTTP ${response.status}`);
  }

  return response.json() as Promise<ImportResult>;
}

export function importProducts(token: string, file: File) {
  return importExcel(token, 'products', file);
}

export function importInventory(token: string, file: File) {
  return importExcel(token, 'inventory', file);
}

export function importBom(token: string, file: File) {
  return importExcel(token, 'bom', file);
}
