import { Body, Controller, ForbiddenException, Get, Inject, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { queryDatabase } from '../database';
import { CurrentUser } from '../auth/current-user';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StockOperationBody, StockService, TransferBody } from './stock.service';

interface InventoryRow {
  product_id: string;
  warehouse_id: string;
  slot_id: string | null;
  quality: string;
  qty_on_hand: string;
  available: string;
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

  @Get('inventory')
  async inventory(@Query('product') product?: string, @Query('warehouse') warehouse?: string, @Query('slot') slot?: string) {
    const result = await queryDatabase<InventoryRow>(
      `
        SELECT
          inventory.product_id,
          inventory.warehouse_id,
          inventory.slot_id::text,
          inventory.quality,
          inventory.qty_on_hand::text,
          fn_available(
            inventory.product_id,
            inventory.warehouse_id,
            inventory.slot_id,
            inventory.batch_id,
            inventory.quality
          )::text AS available
        FROM inventory
        WHERE ($1::text IS NULL OR inventory.product_id = $1)
          AND ($2::text IS NULL OR inventory.warehouse_id = $2)
          AND ($3::bigint IS NULL OR inventory.slot_id = $3::bigint)
        ORDER BY inventory.product_id, inventory.warehouse_id, inventory.slot_id
      `,
      [product || null, warehouse || null, slot || null],
    );

    return result.rows.map((row) => ({
      product_id: row.product_id,
      warehouse_id: row.warehouse_id,
      slot_id: row.slot_id ? Number(row.slot_id) : null,
      quality: row.quality,
      qty_on_hand: Number(row.qty_on_hand),
      available: Number(row.available),
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
