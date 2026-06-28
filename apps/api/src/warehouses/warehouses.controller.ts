import { Body, Controller, Get, Inject, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SlotPatchBody, SlotTemplateBody, WarehouseBody, WarehousesService } from './warehouses.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class WarehousesController {
  constructor(@Inject(WarehousesService) private readonly warehousesService: WarehousesService) {}

  @Get('warehouses')
  warehouses() {
    return this.warehousesService.listWarehouses();
  }

  @Post('warehouses')
  @Roles('ADMIN', 'BOSS')
  createWarehouse(@Body() body: WarehouseBody) {
    return this.warehousesService.createWarehouse(body);
  }

  @Get('warehouses/:warehouseId/slots')
  slots(@Param('warehouseId') warehouseId: string, @Query('includeUnavailable') includeUnavailable?: string) {
    return this.warehousesService.listSlots(warehouseId, includeUnavailable);
  }

  @Post('warehouses/:warehouseId/slots:template')
  @Roles('ADMIN', 'BOSS')
  generateSlots(@Param('warehouseId') warehouseId: string, @Body() body: SlotTemplateBody) {
    return this.warehousesService.generateSlotsFromTemplate(warehouseId, body);
  }

  @Patch('slots/:slotId')
  @Roles('ADMIN', 'BOSS')
  updateSlot(@Param('slotId') slotId: string, @Body() body: SlotPatchBody) {
    return this.warehousesService.updateSlot(slotId, body);
  }
}
