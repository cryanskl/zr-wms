import { Injectable } from '@nestjs/common';
import { queryDatabase } from '../database';
import { buildPeriodReportQuery, parseReportRange, ReportRange } from '../reports/reports-queries';
import { buildLowStockQuery } from '../stock/stock-read-queries';
import { buildInsertNotificationLogQuery, buildRecentNotificationLogsQuery } from './notification-queries';

interface NotificationLogRow {
  log_id: string;
  entity_type: string;
  entity_id: string | null;
  action: string;
  detail: string | null;
  operator_id: string | null;
  created_at: string;
}

interface LowStockRow {
  product_id: string;
  product_name: string;
  safety_stock: string;
  qty_on_hand: string;
  shortage: string;
}

interface PeriodRow {
  period: string;
  movement_count: string;
  inbound_qty: string;
  outbound_qty: string;
  adjustment_qty: string;
  net_qty: string;
}

@Injectable()
export class NotificationsService {
  async sendTestNotification(operatorId: number) {
    return this.recordNotification('test', 'TEST_NOTIFICATION', {
      channel: 'operation_log',
      message: '通知服务测试',
    }, operatorId);
  }

  async scanLowStock(operatorId: number | null = null) {
    const result = await queryDatabase<LowStockRow>(buildLowStockQuery().text);
    const rows = result.rows.map((row) => ({
      product_id: row.product_id,
      product_name: row.product_name,
      safety_stock: Number(row.safety_stock),
      qty_on_hand: Number(row.qty_on_hand),
      shortage: Number(row.shortage),
    }));

    if (rows.length === 0) {
      return {
        sent: false,
        low_stock_count: 0,
      };
    }

    const log = await this.recordNotification('low-stock', 'LOW_STOCK_NOTIFICATION', {
      channel: 'operation_log',
      low_stock_count: rows.length,
      rows,
    }, operatorId);

    return {
      sent: true,
      low_stock_count: rows.length,
      log,
    };
  }

  async generatePeriodReport(rangeInput: unknown = 'day', operatorId: number | null = null) {
    const range = parseReportRange(rangeInput);
    const result = await queryDatabase<PeriodRow>(buildPeriodReportQuery(range).text);
    const rows = result.rows.map(mapPeriodRow);
    const log = await this.recordNotification(`period-${range}`, 'PERIOD_REPORT_NOTIFICATION', {
      channel: 'operation_log',
      range,
      row_count: rows.length,
      rows,
    }, operatorId);

    return {
      sent: true,
      range,
      row_count: rows.length,
      log,
    };
  }

  async recent(limit = 10) {
    const result = await queryDatabase<NotificationLogRow>(buildRecentNotificationLogsQuery().text, [limit]);
    return result.rows.map(mapNotificationLogRow);
  }

  private async recordNotification(entityId: string, action: string, detail: Record<string, unknown>, operatorId: number | null) {
    const result = await queryDatabase<NotificationLogRow>(buildInsertNotificationLogQuery().text, [
      entityId,
      action,
      JSON.stringify(detail),
      operatorId,
    ]);

    return mapNotificationLogRow(result.rows[0]);
  }
}

function mapNotificationLogRow(row: NotificationLogRow) {
  return {
    log_id: Number(row.log_id),
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    action: row.action,
    detail: row.detail ? (JSON.parse(row.detail) as Record<string, unknown>) : null,
    operator_id: row.operator_id === null ? null : Number(row.operator_id),
    created_at: row.created_at,
  };
}

function mapPeriodRow(row: PeriodRow) {
  return {
    period: row.period,
    movement_count: Number(row.movement_count),
    inbound_qty: Number(row.inbound_qty),
    outbound_qty: Number(row.outbound_qty),
    adjustment_qty: Number(row.adjustment_qty),
    net_qty: Number(row.net_qty),
  };
}
