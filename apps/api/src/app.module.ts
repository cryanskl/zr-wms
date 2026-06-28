import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { JwtStrategy } from './auth/jwt.strategy';
import { RolesGuard } from './auth/roles.guard';
import { HealthController } from './health.controller';
import { BomController } from './products/bom.controller';
import { ProductsController } from './products/products.controller';
import { ProductsService } from './products/products.service';
import { SearchController } from './search/search.controller';
import { SearchService } from './search/search.service';
import { StockController } from './stock/stock.controller';
import { StockService } from './stock/stock.service';
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
    SearchController,
    AuthController,
    BomController,
    ProductsController,
    StockController,
    WarehousesController,
  ],
  providers: [SearchService, AuthService, JwtStrategy, RolesGuard, ProductsService, StockService, WarehousesService],
})
export class AppModule {}
