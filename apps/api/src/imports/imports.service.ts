import { BadRequestException, ConflictException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { PoolClient } from 'pg';
import { pool } from '../database';
import {
  ImportedBomRow,
  ImportedInventoryRow,
  ImportedProductRow,
  parseBomWorkbook,
  parseInventoryWorkbook,
  parseProductsWorkbook,
} from './import-parser';
import {
  buildDeleteImportedBomLinesQuery,
  buildImportInventoryInboundQuery,
  buildImportProductUpsertQuery,
  buildInsertImportedBomLineQuery,
  buildRegenerateImportedPathAliasesQuery,
} from './import-queries';

export interface UploadedExcelFile {
  originalname?: string;
  buffer?: Buffer;
}

interface MovementRow {
  movement_id: string;
}

interface RegeneratedAliasesRow {
  regenerated_aliases: number;
}

@Injectable()
export class ImportsService {
  async importProducts(file: UploadedExcelFile, operatorId: number) {
    const rows = await parseProductsWorkbook(requiredBuffer(file));
    const importedIds = await withTransaction(async (client) => {
      const imported: string[] = [];
      for (const row of rows) {
        await importProduct(client, row, operatorId);
        imported.push(row.product_id);
      }
      return imported;
    });

    return {
      imported: importedIds.length,
      product_ids: importedIds,
    };
  }

  async importInventory(file: UploadedExcelFile, operatorId: number) {
    const rows = await parseInventoryWorkbook(requiredBuffer(file));
    const movementIds = await withTransaction(async (client) => {
      const imported: number[] = [];
      for (const row of rows) {
        imported.push(await importInventoryRow(client, row, operatorId));
      }
      return imported;
    });

    return {
      imported: movementIds.length,
      movement_ids: movementIds,
    };
  }

  async importBom(file: UploadedExcelFile) {
    const rows = await parseBomWorkbook(requiredBuffer(file));
    const result = await withTransaction(async (client) => {
      const parents = [...new Set(rows.map((row) => row.parent_product_id))];
      await client.query(buildDeleteImportedBomLinesQuery().text, [parents]);
      for (const row of rows) {
        await importBomRow(client, row);
      }
      const regenerated = await client.query<RegeneratedAliasesRow>(buildRegenerateImportedPathAliasesQuery().text);

      return {
        parents,
        regenerated_aliases: Number(regenerated.rows[0]?.regenerated_aliases ?? 0),
      };
    });

    return {
      imported: rows.length,
      parent_product_ids: result.parents,
      regenerated_aliases: result.regenerated_aliases,
    };
  }
}

async function withTransaction<T>(callback: (client: PoolClient) => Promise<T>) {
  if (!pool) {
    throw new InternalServerErrorException('DATABASE_URL is not set');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    mapImportDbError(error);
  } finally {
    client.release();
  }
}

async function importProduct(client: PoolClient, row: ImportedProductRow, operatorId: number) {
  await client.query(buildImportProductUpsertQuery().text, [
    row.product_id,
    row.type,
    row.name,
    row.has_tube,
    row.has_alu_plate,
    row.has_dust_cover,
    JSON.stringify(row.attrs),
    row.safety_stock,
    row.remark,
    operatorId,
  ]);
}

async function importInventoryRow(client: PoolClient, row: ImportedInventoryRow, operatorId: number) {
  const result = await client.query<MovementRow>(buildImportInventoryInboundQuery().text, [
    row.product_id,
    row.warehouse_id,
    row.qty,
    row.slot_id,
    row.batch_id,
    row.quality,
    row.reason,
    operatorId,
  ]);

  return Number(result.rows[0].movement_id);
}

async function importBomRow(client: PoolClient, row: ImportedBomRow) {
  await client.query(buildInsertImportedBomLineQuery().text, [
    row.parent_product_id,
    row.child_product_id,
    row.qty,
    row.seq,
  ]);
}

function requiredBuffer(file: UploadedExcelFile) {
  if (!file?.buffer) {
    throw new BadRequestException('请上传 Excel 文件');
  }
  return file.buffer;
}

function mapImportDbError(error: unknown): never {
  if (error instanceof BadRequestException) {
    throw error;
  }

  const pgError = error as { code?: string; message?: string };
  if (pgError.code === '23503' || pgError.code === '23505' || pgError.code === '23514' || pgError.code === 'P0001') {
    throw new ConflictException(pgError.message ?? '导入数据与当前数据库约束冲突');
  }

  throw new InternalServerErrorException('导入失败');
}
