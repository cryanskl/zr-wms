import { Body, Controller, ForbiddenException, Inject, Param, Post, Req, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateStocktakeBody, CreateStocktakeLineBody, StocktakesService } from './stocktakes.service';

@UseGuards(JwtAuthGuard)
@Controller()
export class StocktakesController {
  constructor(@Inject(StocktakesService) private readonly stocktakesService: StocktakesService) {}

  @Post('stocktakes')
  create(@Body() body: CreateStocktakeBody, @Req() request: { user: CurrentUser }) {
    return this.stocktakesService.create(body, request.user.userId);
  }

  @Post('stocktakes/:id/lines')
  addLine(@Param('id') stocktakeId: string, @Body() body: CreateStocktakeLineBody) {
    return this.stocktakesService.addLine(stocktakeId, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post('stocktake-lines/:id/apply')
  applyLine(@Param('id') stlineId: string, @Req() request: { user: CurrentUser }) {
    if (request.user.role !== 'ADMIN') {
      throw new ForbiddenException('盘点应用需要管理员权限');
    }
    return this.stocktakesService.applyLine(stlineId, request.user.userId);
  }
}
