import { Body, Controller, Get, Inject, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateOrderBody, OrdersService, PatchOrderBody } from './orders.service';

@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrdersController {
  constructor(@Inject(OrdersService) private readonly ordersService: OrdersService) {}

  @Get()
  list(@Query('type') type?: string, @Query('status') status?: string) {
    return this.ordersService.list({ type, status });
  }

  @Post()
  create(@Body() body: CreateOrderBody, @Req() request: { user: CurrentUser }) {
    return this.ordersService.create(body, request.user.userId);
  }

  @Get(':id')
  detail(@Param('id') orderId: string) {
    return this.ordersService.detail(orderId);
  }

  @Patch(':id')
  update(@Param('id') orderId: string, @Body() body: PatchOrderBody) {
    return this.ordersService.update(orderId, body);
  }
}
