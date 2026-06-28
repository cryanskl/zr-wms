import { Body, Controller, ForbiddenException, Get, Inject, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { queryDatabase } from '../database';
import { CurrentUser } from '../auth/current-user';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  buildInventoryQuery,
  buildInventorySummaryQuery,
  buildLowStockQuery,
  buildProductLocationsQuery,
  buildSlotProductsQuery,
} from './stock-read-queries';
import { StockOperationBody, StockService, TransferBody } from './stock.service';

interface InventoryRow {
  inventory_id: string;
  product_id: string;
  product_name: string;
  warehouse_id: string;
  warehouse_name: string;
  slot_id: string | null;
  slot_code: string | null;
  quality: string;
  qty_on_hand: string;
  available: string;
  frozen: string;
}

interface InventorySummaryRow {
  total: string;
  available: string;
  frozen: string;
}

interface LowStockRow {
  product_id: string;
  product_name: string;
  safety_stock: string;
  qty_on_hand: string;
  shortage: string;
}

@UseGuards(JwtAuthGuard)
@Controller()
export class StockController {
  constructor(@Inject(StockService) private readonly stockService: StockService) {}

  @Post('inbound')
  inbound(@Body() body: StockOperationBody, @Req() request: { user: CurrentUser }) {
    return this.stockService.inbound(body, request.user.userId);
  }

  @Post('outbound')
  outbound(
    @Body() body: StockOperationBody,
    @Query('force') force: string | undefined,
    @Req() request: { user: CurrentUser },
  ) {
    const allowNegative = force === 'true';
    if (allowNegative && request.user.role !== 'ADMIN') {
      throw new ForbiddenException('强制出库需要管理员权限');
    }

    return this.stockService.outbound(body, request.user.userId, allowNegative);
  }

  @Post('transfer')
  transfer(@Body() body: TransferBody, @Req() request: { user: CurrentUser }) {
    return this.stockService.transfer(body, request.user.userId);
  }

  @Get('inventory/summary')
  async inventorySummary(@Query('product') product?: string) {
    const result = await queryDatabase<InventorySummaryRow>(buildInventorySummaryQuery().text, [product || null]);
    const row = result.rows[0] ?? { total: '0', available: '0', frozen: '0' };

    return {
      total: Number(row.total),
      available: Number(row.available),
      frozen: Number(row.frozen),
    };
  }

  @Get('inventory')
  async inventory(
    @Query('product') product?: string,
    @Query('warehouse') warehouse?: string,
    @Query('slot') slot?: string,
    @Query('quality') quality?: string,
  ) {
    const result = await queryDatabase<InventoryRow>(buildInventoryQuery().text, [
      product || null,
      warehouse || null,
      slot || null,
      quality || null,
    ]);

    return result.rows.map(mapInventoryRow);
  }

  @Get('products/:id/locations')
  async productLocations(@Param('id') productId: string) {
    const result = await queryDatabase<InventoryRow>(buildProductLocationsQuery().text, [productId]);
    return result.rows.map(mapInventoryRow);
  }

  @Get('slots/:id/products')
  async slotProducts(@Param('id') slotId: string) {
    const result = await queryDatabase<InventoryRow>(buildSlotProductsQuery().text, [slotId]);
    return result.rows.map(mapInventoryRow);
  }

  @Get('reports/low-stock')
  async lowStock() {
    const result = await queryDatabase<LowStockRow>(buildLowStockQuery().text);
    return result.rows.map((row) => ({
      product_id: row.product_id,
      product_name: row.product_name,
      safety_stock: Number(row.safety_stock),
      qty_on_hand: Number(row.qty_on_hand),
      shortage: Number(row.shortage),
    }));
  }

  @Get('warehouses')
  async warehouses() {
    const result = await queryDatabase<{ warehouse_id: string; name: string; has_slots: boolean }>(
      'SELECT warehouse_id, name, has_slots FROM warehouse ORDER BY warehouse_id',
    );
    return result.rows;
  }

  @Get('warehouses/:warehouseId/slots')
  async slots(@Param('warehouseId') warehouseId: string) {
    const result = await queryDatabase<{ slot_id: string; code: string }>(
      'SELECT slot_id::text, code FROM slot WHERE warehouse_id = $1 ORDER BY code',
      [warehouseId],
    );
    return result.rows.map((row) => ({ slot_id: Number(row.slot_id), code: row.code }));
  }
}

function mapInventoryRow(row: InventoryRow) {
  return {
    inventory_id: Number(row.inventory_id),
    product_id: row.product_id,
    product_name: row.product_name,
    warehouse_id: row.warehouse_id,
    warehouse_name: row.warehouse_name,
    slot_id: row.slot_id ? Number(row.slot_id) : null,
    slot_code: row.slot_code,
    quality: row.quality,
    qty_on_hand: Number(row.qty_on_hand),
    available: Number(row.available),
    frozen: Number(row.frozen),
  };
}
