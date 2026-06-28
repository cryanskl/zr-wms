export interface OperationLogFilters {
  entity_type?: string;
  action?: string;
  limit?: number;
}

export interface OperationLogRow {
  log_id: number;
  entity_type: string;
  entity_id: string | null;
  action: string;
  detail: Record<string, unknown> | null;
  operator_id: number | null;
  operator_name: string | null;
  created_at: string;
}

export function buildOperationLogsUrl(filters: OperationLogFilters = {}) {
  const params = new URLSearchParams();
  if (filters.entity_type) params.set('entity_type', filters.entity_type);
  if (filters.action) params.set('action', filters.action);
  if (filters.limit) params.set('limit', String(filters.limit));

  const suffix = params.toString();
  return `/api/v1/operation-logs${suffix ? `?${suffix}` : ''}`;
}

export function getOperationLogs(token: string, filters: OperationLogFilters = {}) {
  return apiFetch<OperationLogRow[]>(buildOperationLogsUrl(filters), token);
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
