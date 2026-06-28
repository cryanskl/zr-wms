export type ReportRange = 'day' | 'week' | 'month';
export type ExportType = 'inventory' | 'movements' | 'period' | 'dead-stock' | 'slot-utilization';

export interface PeriodReportRow {
  period: string;
  movement_count: number;
  inbound_qty: number;
  outbound_qty: number;
  adjustment_qty: number;
  net_qty: number;
}

export interface DeadStockRow {
  product_id: string;
  product_name: string;
  qty_on_hand: number;
  last_movement_at: string | null;
  idle_days: number | null;
}

export interface SlotUtilizationRow {
  warehouse_id: string;
  warehouse_name: string;
  total_slots: number;
  occupied_slots: number;
  utilization_rate: number;
}

export interface ExportRequestBody {
  type: ExportType;
  range?: ReportRange;
  days?: number;
}

export function buildPeriodReportUrl(range: ReportRange) {
  const params = new URLSearchParams({ range });
  return `/api/v1/reports/period?${params.toString()}`;
}

export function buildDeadStockUrl(days?: number | null) {
  const params = new URLSearchParams();
  if (days) params.set('days', String(days));
  const suffix = params.toString();
  return `/api/v1/reports/dead-stock${suffix ? `?${suffix}` : ''}`;
}

export function buildExportRequest(token: string, body: ExportRequestBody) {
  return {
    url: '/api/v1/export',
    init: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    },
  };
}

export function getPeriodReport(token: string, range: ReportRange) {
  return apiFetch<PeriodReportRow[]>(buildPeriodReportUrl(range), token);
}

export function getDeadStockReport(token: string, days?: number | null) {
  return apiFetch<DeadStockRow[]>(buildDeadStockUrl(days), token);
}

export function getSlotUtilizationReport(token: string) {
  return apiFetch<SlotUtilizationRow[]>('/api/v1/reports/slot-utilization', token);
}

export async function downloadExport(token: string, body: ExportRequestBody) {
  const request = buildExportRequest(token, body);
  const response = await fetch(request.url, request.init);

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(errorBody?.message ?? `导出失败：HTTP ${response.status}`);
  }

  const blob = await response.blob();
  const disposition = response.headers.get('content-disposition') ?? '';
  return {
    blob,
    fileName: parseFileName(disposition) ?? `zr-wms-${body.type}.xlsx`,
  };
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

function parseFileName(disposition: string) {
  const match = disposition.match(/filename="([^"]+)"/i);
  return match?.[1];
}
