import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { pool, queryDatabase } from '../database';
import { mapPgConcurrencyError } from '../db-errors';
import {
  buildBomQuery,
  buildDeleteBomLinesQuery,
  buildInsertBomLineQuery,
  buildMaxProducibleDeepQuery,
  buildMaxProducibleQuery,
  buildPathAliasesQuery,
  buildRegeneratePathAliasesQuery,
  buildWhereUsedQuery,
} from './bom-queries';
import {
  buildAddAliasQuery,
  buildAddImageQuery,
  buildCreateProductQuery,
  buildDeleteAliasQuery,
  buildProductDetailQuery,
  buildProductListQuery,
  buildProductPriceQuery,
  buildSoftDeleteProductQuery,
  buildUpsertProductPriceQuery,
  buildUpdateProductQuery,
} from './product-queries';

type ProductType = 'RM' | 'SF' | 'FG' | 'ACC';

export interface ProductBody {
  product_id?: string;
  type?: ProductType;
  name?: string;
  has_tube?: boolean;
  has_alu_plate?: boolean;
  has_dust_cover?: boolean;
  attrs?: Record<string, unknown>;
  safety_stock?: number | string | null;
  remark?: string | null;
}

export interface AliasBody {
  alias_text?: string;
}

export interface ImageBody {
  url?: string;
  seq?: number | string;
}

export interface BomLineBody {
  child_product_id?: string;
  qty?: number | string;
  seq?: number | string;
}

export interface ReplaceBomBody {
  lines?: BomLineBody[];
}

export interface PriceBody {
  cost_in?: number | string | null;
  cost_process?: number | string | null;
  cost_loss?: number | string | null;
  price_out?: number | string | null;
}

interface ProductRow {
  product_id: string;
  type: ProductType;
  name: string;
  has_tube: boolean;
  has_alu_plate: boolean;
  has_dust_cover: boolean;
  attrs: string;
  safety_stock: string | null;
  remark: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

interface AliasRow {
  alias_id: string;
  product_id: string;
  alias_text: string;
  created_at: string;
}

interface ImageRow {
  image_id: string;
  product_id: string;
  url: string;
  seq: number;
}

interface PathAliasRow {
  path_alias_id: string;
  product_id: string;
  root_product_id: string;
  path_text: string;
  generated_at: string;
}

interface BomLineRow {
  bom_line_id: string;
  parent_product_id: string;
  child_product_id: string;
  child_name: string;
  child_type: ProductType;
  qty: string;
  seq: number;
}

interface RegenRow {
  regenerated_aliases: number;
}

interface WhereUsedRow {
  parent_product_id: string;
  parent_name: string;
  ptype: ProductType;
  lvl: number;
}

interface MaxProducibleRow {
  target: string;
  max_make: string;
  limiting_product: string | null;
  limiting_on_hand: string | null;
}

interface MaxProducibleDeepRow extends MaxProducibleRow {
  limiting_demand: string | null;
}

interface PriceRow {
  product_id: string;
  cost_in: string | null;
  cost_process: string | null;
  cost_loss: string | null;
  price_out: string | null;
  updated_by: string | null;
  updated_at: string | null;
}

interface IdRow {
  product_id?: string;
  alias_id?: string;
}

interface CountRow {
  count: string;
}

@Injectable()
export class ProductsService {
  async list(filters: { type?: string; active?: string }) {
    const result = await queryDatabase<ProductRow>(buildProductListQuery().text, [
      filters.type || null,
      parseOptionalBoolean(filters.active),
    ]);
    return result.rows.map(mapProductRow);
  }

  async detail(productId: string) {
    const queries = buildProductDetailQuery();
    const productResult = await queryDatabase<ProductRow>(queries.product.text, [productId]);
    const product = productResult.rows[0];
    if (!product) {
      throw new NotFoundException('产品不存在');
    }

    const [aliasesResult, imagesResult, pathAliasesResult] = await Promise.all([
      queryDatabase<AliasRow>(queries.aliases.text, [productId]),
      queryDatabase<ImageRow>(queries.images.text, [productId]),
      queryDatabase<PathAliasRow>(queries.pathAliases.text, [productId]),
    ]);

    return {
      ...mapProductRow(product),
      aliases: aliasesResult.rows.map(mapAliasRow),
      images: imagesResult.rows.map(mapImageRow),
      path_aliases: pathAliasesResult.rows.map((row) => ({
        path_alias_id: Number(row.path_alias_id),
        product_id: row.product_id,
        root_product_id: row.root_product_id,
        path_text: row.path_text,
        generated_at: row.generated_at,
      })),
    };
  }

  async create(body: ProductBody, operatorId: number) {
    const type = requireProductType(body.type);
    const name = requireText(body.name, '产品名称不能为空');
    const productId = normalizeProductId(body.product_id) ?? generateProductId(type);

    try {
      const result = await queryDatabase<IdRow>(buildCreateProductQuery().text, [
        productId,
        type,
        name,
        Boolean(body.has_tube),
        Boolean(body.has_alu_plate),
        Boolean(body.has_dust_cover),
        JSON.stringify(body.attrs ?? {}),
        nullableNumber(body.safety_stock),
        nullableText(body.remark),
        operatorId,
      ]);

      return { product_id: result.rows[0].product_id };
    } catch (error) {
      mapProductError(error);
    }
  }

  async update(productId: string, body: ProductBody, operatorId: number) {
    const current = await this.detail(productId);
    const nextProductId = normalizeProductId(body.product_id) ?? productId;
    const nextType = body.type ?? current.type;
    const nextName = requireText(body.name ?? current.name, '产品名称不能为空');

    try {
      const result = await queryDatabase<IdRow>(buildUpdateProductQuery().text, [
        productId,
        nextProductId,
        nextType,
        nextName,
        body.has_tube ?? current.has_tube,
        body.has_alu_plate ?? current.has_alu_plate,
        body.has_dust_cover ?? current.has_dust_cover,
        JSON.stringify(body.attrs ?? current.attrs),
        body.safety_stock === undefined ? current.safety_stock : nullableNumber(body.safety_stock),
        body.remark === undefined ? current.remark : nullableText(body.remark),
        operatorId,
      ]);

      return { product_id: result.rows[0].product_id };
    } catch (error) {
      mapProductError(error);
    }
  }

  async softDelete(productId: string, operatorId: number) {
    const result = await queryDatabase<IdRow>(buildSoftDeleteProductQuery().text, [productId, operatorId]);
    if (!result.rows[0]) {
      throw new NotFoundException('产品不存在');
    }
    return { product_id: result.rows[0].product_id };
  }

  async addAlias(productId: string, body: AliasBody, operatorId: number) {
    const aliasText = requireText(body.alias_text, '别名不能为空');
    const count = await countRows('SELECT count(*)::text AS count FROM product_alias WHERE product_id = $1', [productId]);
    if (count >= 10) {
      throw new ConflictException('每个产品最多 10 个别名');
    }

    try {
      const result = await queryDatabase<AliasRow>(buildAddAliasQuery().text, [productId, aliasText, operatorId]);
      return mapAliasRow(result.rows[0]);
    } catch (error) {
      mapProductError(error);
    }
  }

  async deleteAlias(productId: string, aliasId: string) {
    const result = await queryDatabase<IdRow>(buildDeleteAliasQuery().text, [productId, aliasId]);
    if (!result.rows[0]) {
      throw new NotFoundException('别名不存在');
    }
    return { alias_id: Number(result.rows[0].alias_id) };
  }

  async addImage(productId: string, body: ImageBody) {
    const url = requireText(body.url, '图片 URL 不能为空');
    const count = await countRows('SELECT count(*)::text AS count FROM product_image WHERE product_id = $1', [productId]);
    if (count >= 3) {
      throw new ConflictException('每个产品最多 3 张图片');
    }

    try {
      const seq = body.seq === undefined || body.seq === null || body.seq === '' ? count + 1 : Number(body.seq);
      const result = await queryDatabase<ImageRow>(buildAddImageQuery().text, [productId, url, seq]);
      return mapImageRow(result.rows[0]);
    } catch (error) {
      mapProductError(error);
    }
  }

  async bom(productId: string) {
    await this.ensureProductExists(productId);
    const result = await queryDatabase<BomLineRow>(buildBomQuery().text, [productId]);
    return result.rows.map(mapBomLineRow);
  }

  async replaceBom(productId: string, body: ReplaceBomBody) {
    await this.ensureProductExists(productId);
    const lines = normalizeBomLines(body.lines);

    if (!pool) {
      throw new Error('DATABASE_URL is not set');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(buildDeleteBomLinesQuery().text, [productId]);

      for (const line of lines) {
        await client.query(buildInsertBomLineQuery().text, [productId, line.child_product_id, line.qty, line.seq]);
      }

      const result = await client.query<RegenRow>(buildRegeneratePathAliasesQuery().text);
      await client.query('COMMIT');
      return {
        line_count: lines.length,
        regenerated_aliases: Number(result.rows[0].regenerated_aliases),
      };
    } catch (error) {
      await client.query('ROLLBACK');
      mapProductError(error);
    } finally {
      client.release();
    }
  }

  async regeneratePathAliases() {
    const result = await queryDatabase<RegenRow>(buildRegeneratePathAliasesQuery().text);
    return { regenerated_aliases: Number(result.rows[0].regenerated_aliases) };
  }

  async whereUsed(productId: string, recursive: string | undefined) {
    await this.ensureProductExists(productId);
    const result = await queryDatabase<WhereUsedRow>(buildWhereUsedQuery().text, [
      productId,
      parseOptionalBoolean(recursive) ?? false,
    ]);
    return result.rows.map((row) => ({
      parent_product_id: row.parent_product_id,
      parent_name: row.parent_name,
      ptype: row.ptype,
      lvl: Number(row.lvl),
    }));
  }

  async pathAliases(productId: string) {
    await this.ensureProductExists(productId);
    const result = await queryDatabase<PathAliasRow>(buildPathAliasesQuery().text, [productId]);
    return result.rows.map(mapPathAliasRow);
  }

  async price(productId: string) {
    const result = await queryDatabase<PriceRow>(buildProductPriceQuery().text, [productId]);
    const row = result.rows[0];
    if (!row) {
      throw new NotFoundException('产品不存在');
    }
    return mapPriceRow(row);
  }

  async updatePrice(productId: string, body: PriceBody, operatorId: number) {
    await this.ensureProductExists(productId);
    const result = await queryDatabase<PriceRow>(buildUpsertProductPriceQuery().text, [
      productId,
      nullableNumber(body.cost_in),
      nullableNumber(body.cost_process),
      nullableNumber(body.cost_loss),
      nullableNumber(body.price_out),
      operatorId,
    ]);
    return mapPriceRow(result.rows[0]);
  }

  async producible(productId: string, deep: string | undefined, useSfStock: string | undefined) {
    try {
      if (deep === 'true') {
        const result = await queryDatabase<MaxProducibleDeepRow>(buildMaxProducibleDeepQuery().text, [
          productId,
          useSfStock !== 'false',
        ]);
        return mapMaxProducibleDeepRow(result.rows[0]);
      }

      const result = await queryDatabase<MaxProducibleRow>(buildMaxProducibleQuery().text, [productId]);
      return mapMaxProducibleRow(result.rows[0]);
    } catch (error) {
      mapProductError(error);
    }
  }

  private async ensureProductExists(productId: string) {
    await this.detail(productId);
  }
}

function mapProductRow(row: ProductRow) {
  return {
    product_id: row.product_id,
    type: row.type,
    name: row.name,
    has_tube: row.has_tube,
    has_alu_plate: row.has_alu_plate,
    has_dust_cover: row.has_dust_cover,
    attrs: JSON.parse(row.attrs || '{}') as Record<string, unknown>,
    safety_stock: row.safety_stock === null ? null : Number(row.safety_stock),
    remark: row.remark,
    active: row.active,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapAliasRow(row: AliasRow) {
  return {
    alias_id: Number(row.alias_id),
    product_id: row.product_id,
    alias_text: row.alias_text,
    created_at: row.created_at,
  };
}

function mapImageRow(row: ImageRow) {
  return {
    image_id: Number(row.image_id),
    product_id: row.product_id,
    url: row.url,
    seq: row.seq,
  };
}

function mapPathAliasRow(row: PathAliasRow) {
  return {
    path_alias_id: Number(row.path_alias_id),
    product_id: row.product_id,
    root_product_id: row.root_product_id,
    path_text: row.path_text,
    generated_at: row.generated_at,
  };
}

function mapMaxProducibleRow(row: MaxProducibleRow) {
  return {
    target: row.target,
    maxMake: Number(row.max_make),
    limiting: row.limiting_product,
    limitingOnHand: row.limiting_on_hand === null ? null : Number(row.limiting_on_hand),
  };
}

function mapMaxProducibleDeepRow(row: MaxProducibleDeepRow) {
  return {
    ...mapMaxProducibleRow(row),
    limitingDemand: row.limiting_demand === null ? null : Number(row.limiting_demand),
  };
}

function mapBomLineRow(row: BomLineRow) {
  return {
    bom_line_id: Number(row.bom_line_id),
    parent_product_id: row.parent_product_id,
    child_product_id: row.child_product_id,
    child_name: row.child_name,
    child_type: row.child_type,
    qty: Number(row.qty),
    seq: Number(row.seq),
  };
}

function mapPriceRow(row: PriceRow) {
  return {
    product_id: row.product_id,
    cost_in: row.cost_in === null ? null : Number(row.cost_in),
    cost_process: row.cost_process === null ? null : Number(row.cost_process),
    cost_loss: row.cost_loss === null ? null : Number(row.cost_loss),
    price_out: row.price_out === null ? null : Number(row.price_out),
    updated_by: row.updated_by === null ? null : Number(row.updated_by),
    updated_at: row.updated_at,
  };
}

async function countRows(text: string, values: unknown[]) {
  const result = await queryDatabase<CountRow>(text, values);
  return Number(result.rows[0]?.count ?? 0);
}

function parseOptionalBoolean(value: string | undefined) {
  if (value === undefined || value === '') {
    return null;
  }
  return value === 'true';
}

function nullableNumber(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  return Number(value);
}

function nullableText(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }
  return value.trim();
}

function requireText(value: unknown, message: string) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new BadRequestException(message);
  }
  return value.trim();
}

function normalizeBomLines(lines: BomLineBody[] | undefined) {
  if (!Array.isArray(lines)) {
    throw new BadRequestException('BOM 明细必须是数组');
  }

  return lines.map((line) => ({
    child_product_id: requireText(line.child_product_id, '子项产品不能为空').toUpperCase(),
    qty: requirePositiveNumber(line.qty, 'BOM 用量必须大于 0'),
    seq: requirePositiveInteger(line.seq, 'BOM 顺序必须是正整数'),
  }));
}

function requirePositiveNumber(value: unknown, message: string) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    throw new BadRequestException(message);
  }
  return numberValue;
}

function requirePositiveInteger(value: unknown, message: string) {
  const numberValue = Number(value);
  if (!Number.isInteger(numberValue) || numberValue <= 0) {
    throw new BadRequestException(message);
  }
  return numberValue;
}

function normalizeProductId(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }
  return value.trim().toUpperCase();
}

function requireProductType(value: unknown): ProductType {
  if (value === 'RM' || value === 'SF' || value === 'FG' || value === 'ACC') {
    return value;
  }
  throw new BadRequestException('产品类型必须是 RM/SF/FG/ACC');
}

function generateProductId(type: ProductType) {
  return `${type}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function mapProductError(error: unknown): never {
  const pgError = error as { code?: string; message?: string };
  if (pgError.code === '23505') {
    throw new ConflictException('产品编码、别名、图片序号或 BOM 顺序重复');
  }
  if (pgError.code === '23503') {
    throw new ConflictException('产品或 BOM 子项不存在，或产品已被业务数据引用，无法完成操作');
  }
  if (pgError.code === 'P0001') {
    throw new ConflictException(pgError.message ?? '产品推衍失败');
  }
  if (pgError.code === '23514' || pgError.code === '22P02') {
    throw new BadRequestException(pgError.message ?? '产品数据不合法');
  }
  mapPgConcurrencyError(error);
  throw error;
}
