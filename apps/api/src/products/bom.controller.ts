import { Controller, Inject, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ProductsService } from './products.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('bom')
export class BomController {
  constructor(@Inject(ProductsService) private readonly productsService: ProductsService) {}

  @Post('regenerate-aliases')
  @Roles('ADMIN', 'BOSS')
  regenerateAliases() {
    return this.productsService.regeneratePathAliases();
  }
}
