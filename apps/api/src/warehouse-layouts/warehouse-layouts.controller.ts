import { Body, Controller, Get, Inject, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import {
  RackTemplateBody,
  WarehouseLayoutCreateBody,
  WarehouseLayoutsService,
  WarehouseLayoutSaveBody,
} from './warehouse-layouts.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class WarehouseLayoutsController {
  constructor(@Inject(WarehouseLayoutsService) private readonly warehouseLayoutsService: WarehouseLayoutsService) {}

  @Get('warehouse-layout-templates')
  layoutTemplates() {
    return this.warehouseLayoutsService.listLayoutTemplates();
  }

  @Get('rack-templates')
  rackTemplates() {
    return this.warehouseLayoutsService.listRackTemplates();
  }

  @Get('warehouse-layouts')
  activeLayout(@Query('warehouse') warehouseId: string) {
    return this.warehouseLayoutsService.getActiveLayout(warehouseId);
  }

  @Post('rack-templates')
  @Roles('ADMIN', 'BOSS')
  createRackTemplate(@Body() body: RackTemplateBody) {
    return this.warehouseLayoutsService.createRackTemplate(body);
  }

  @Post('warehouse-layouts')
  @Roles('ADMIN', 'BOSS')
  createLayout(@Req() request: { user: CurrentUser }, @Body() body: WarehouseLayoutCreateBody) {
    return this.warehouseLayoutsService.createLayout(request.user.userId, body);
  }

  @Put('warehouse-layouts/:layoutId')
  @Roles('ADMIN', 'BOSS')
  saveLayout(
    @Param('layoutId') layoutId: string,
    @Req() request: { user: CurrentUser },
    @Body() body: WarehouseLayoutSaveBody,
  ) {
    return this.warehouseLayoutsService.saveLayout(layoutId, request.user.userId, body);
  }
}
