import { Body, Controller, Get, Inject, Param, Post, Req, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateReservationBody, ReservationsService } from './reservations.service';

@UseGuards(JwtAuthGuard)
@Controller()
export class ReservationsController {
  constructor(@Inject(ReservationsService) private readonly reservationsService: ReservationsService) {}

  @Post('reservations')
  reserve(@Body() body: CreateReservationBody, @Req() request: { user: CurrentUser }) {
    return this.reservationsService.reserve(body, request.user.userId);
  }

  @Post('reservations/:id/fulfill')
  fulfill(@Param('id') reservationId: string, @Req() request: { user: CurrentUser }) {
    return this.reservationsService.fulfill(reservationId, request.user.userId);
  }

  @Post('reservations/:id/release')
  release(@Param('id') reservationId: string, @Req() request: { user: CurrentUser }) {
    return this.reservationsService.release(reservationId, request.user.userId);
  }

  @Get('orders/:id/reservations')
  listForOrder(@Param('id') orderId: string) {
    return this.reservationsService.listForOrder(orderId);
  }
}
