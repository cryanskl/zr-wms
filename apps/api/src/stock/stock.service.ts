import { Injectable } from '@nestjs/common';
import { queryDatabase } from '../database';
import { buildInboundQuery, buildOutboundQuery, buildTransferQuery } from './stock-queries';
import { mapStoredProcedureError } from './stock-errors';

export interface StockOperationBody {
  product?: string;
  warehouse?: string;
  qty?: number | string;
  slot?: number | string | null;
  batch?: number | string | null;
  quality?: string;
  type?: string;
  reason?: string | null;
  refOrder?: number | string | null;
}

export interface TransferBody {
  product?: string;
  qty?: number | string;
  fromWarehouse?: string;
  fromSlot?: number | string;
  toWarehouse?: string;
  toSlot?: number | string;
  batch?: number | string | null;
  quality?: string;
  reason?: string | null;
}

interface MovementRow {
  movement_id: string;
}

interface TransferRow {
  movement_ids: string[];
}

function nullableBigint(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  return Number(value);
}

function optionalText(value: unknown, fallback: string) {
  if (typeof value !== 'string' || !value.trim()) {
    return fallback;
  }

  return value.trim();
}

@Injectable()
export class StockService {
  async inbound(body: StockOperationBody, operatorId: number) {
    try {
      const result = await queryDatabase<MovementRow>(buildInboundQuery().text, [
        body.product,
        body.warehouse,
        body.qty,
        nullableBigint(body.slot),
        nullableBigint(body.batch),
        optionalText(body.quality, 'GOOD'),
        optionalText(body.type, 'IN'),
        body.reason ?? null,
        nullableBigint(body.refOrder),
        operatorId,
      ]);

      return { movementId: Number(result.rows[0].movement_id) };
    } catch (error) {
      mapStoredProcedureError(error);
    }
  }

  async outbound(body: StockOperationBody, operatorId: number, allowNegative: boolean) {
    try {
      const result = await queryDatabase<MovementRow>(buildOutboundQuery().text, [
        body.product,
        body.warehouse,
        body.qty,
        nullableBigint(body.slot),
        nullableBigint(body.batch),
        optionalText(body.quality, 'GOOD'),
        optionalText(body.type, 'OUT'),
        body.reason ?? null,
        nullableBigint(body.refOrder),
        operatorId,
        allowNegative,
      ]);

      return { movementId: Number(result.rows[0].movement_id) };
    } catch (error) {
      mapStoredProcedureError(error);
    }
  }

  async transfer(body: TransferBody, operatorId: number) {
    try {
      const result = await queryDatabase<TransferRow>(buildTransferQuery().text, [
        body.product,
        body.qty,
        body.fromWarehouse,
        nullableBigint(body.fromSlot),
        body.toWarehouse,
        nullableBigint(body.toSlot),
        nullableBigint(body.batch),
        optionalText(body.quality, 'GOOD'),
        body.reason ?? '移库',
        operatorId,
      ]);

      return { movementIds: result.rows[0].movement_ids.map(Number) };
    } catch (error) {
      mapStoredProcedureError(error);
    }
  }
}
