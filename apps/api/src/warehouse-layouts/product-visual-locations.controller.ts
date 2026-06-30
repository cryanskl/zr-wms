import { Controller, Get, Inject, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WarehouseLayoutsService } from './warehouse-layouts.service';

@UseGuards(JwtAuthGuard)
@Controller('products')
export class ProductVisualLocationsController {
  constructor(@Inject(WarehouseLayoutsService) private readonly warehouseLayoutsService: WarehouseLayoutsService) {}

  @Get(':id/visual-locations')
  productVisualLocations(@Param('id') productId: string) {
    return this.warehouseLayoutsService.getProductVisualLocations(productId);
  }
}
