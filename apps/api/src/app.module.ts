import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { JwtStrategy } from './auth/jwt.strategy';
import { RolesGuard } from './auth/roles.guard';
import { HealthController } from './health.controller';
import { ImportsController } from './imports/imports.controller';
import { ImportsService } from './imports/imports.service';
import { NotificationsController } from './notifications/notifications.controller';
import { NotificationsService } from './notifications/notifications.service';
import { OperationLogsController } from './operation-logs/operation-logs.controller';
import { OperationLogsService } from './operation-logs/operation-logs.service';
import { OrdersController } from './orders/orders.controller';
import { OrdersService } from './orders/orders.service';
import { BomController } from './products/bom.controller';
import { ProductsController } from './products/products.controller';
import { ProductsService } from './products/products.service';
import { ReservationsController } from './reservations/reservations.controller';
import { ReservationsService } from './reservations/reservations.service';
import { ReportsController } from './reports/reports.controller';
import { ReportsService } from './reports/reports.service';
import { SearchController } from './search/search.controller';
import { SearchService } from './search/search.service';
import { StockController } from './stock/stock.controller';
import { StockService } from './stock/stock.service';
import { StocktakesController } from './stocktakes/stocktakes.controller';
import { StocktakesService } from './stocktakes/stocktakes.service';
import { WarehousesController } from './warehouses/warehouses.controller';
import { WarehousesService } from './warehouses/warehouses.service';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'dev-only-wms-secret',
      signOptions: { expiresIn: '8h' },
    }),
  ],
  controllers: [
    HealthController,
    ImportsController,
    NotificationsController,
    OperationLogsController,
    SearchController,
    AuthController,
    BomController,
    OrdersController,
    ProductsController,
    ReservationsController,
    ReportsController,
    StockController,
    StocktakesController,
    WarehousesController,
  ],
  providers: [
    SearchService,
    AuthService,
    ImportsService,
    NotificationsService,
    OperationLogsService,
    JwtStrategy,
    RolesGuard,
    OrdersService,
    ProductsService,
    ReservationsService,
    ReportsService,
    StockService,
    StocktakesService,
    WarehousesService,
  ],
})
export class AppModule {}
