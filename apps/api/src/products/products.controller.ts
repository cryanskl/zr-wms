import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AliasBody, ImageBody, ProductBody, ProductsService } from './products.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('products')
export class ProductsController {
  constructor(@Inject(ProductsService) private readonly productsService: ProductsService) {}

  @Get()
  list(@Query('type') type?: string, @Query('active') active?: string) {
    return this.productsService.list({ type, active });
  }

  @Get(':id')
  detail(@Param('id') productId: string) {
    return this.productsService.detail(productId);
  }

  @Post()
  @Roles('ADMIN', 'BOSS')
  create(@Body() body: ProductBody, @Req() request: { user: CurrentUser }) {
    return this.productsService.create(body, request.user.userId);
  }

  @Patch(':id')
  @Roles('ADMIN', 'BOSS')
  update(@Param('id') productId: string, @Body() body: ProductBody, @Req() request: { user: CurrentUser }) {
    return this.productsService.update(productId, body, request.user.userId);
  }

  @Delete(':id')
  @Roles('ADMIN', 'BOSS')
  softDelete(@Param('id') productId: string, @Req() request: { user: CurrentUser }) {
    return this.productsService.softDelete(productId, request.user.userId);
  }

  @Post(':id/aliases')
  addAlias(@Param('id') productId: string, @Body() body: AliasBody, @Req() request: { user: CurrentUser }) {
    return this.productsService.addAlias(productId, body, request.user.userId);
  }

  @Delete(':id/aliases/:aliasId')
  deleteAlias(@Param('id') productId: string, @Param('aliasId') aliasId: string) {
    return this.productsService.deleteAlias(productId, aliasId);
  }

  @Post(':id/images')
  @Roles('ADMIN', 'BOSS')
  addImage(@Param('id') productId: string, @Body() body: ImageBody) {
    return this.productsService.addImage(productId, body);
  }
}
