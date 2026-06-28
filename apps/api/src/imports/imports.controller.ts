import { Controller, Inject, Post, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../auth/current-user';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ImportsService, UploadedExcelFile } from './imports.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('import')
export class ImportsController {
  constructor(@Inject(ImportsService) private readonly importsService: ImportsService) {}

  @Post('products')
  @Roles('ADMIN', 'BOSS')
  @UseInterceptors(FileInterceptor('file'))
  importProducts(@UploadedFile() file: UploadedExcelFile, @Req() request: { user: CurrentUser }) {
    return this.importsService.importProducts(file, request.user.userId);
  }

  @Post('inventory')
  @Roles('ADMIN', 'BOSS')
  @UseInterceptors(FileInterceptor('file'))
  importInventory(@UploadedFile() file: UploadedExcelFile, @Req() request: { user: CurrentUser }) {
    return this.importsService.importInventory(file, request.user.userId);
  }

  @Post('bom')
  @Roles('ADMIN', 'BOSS')
  @UseInterceptors(FileInterceptor('file'))
  importBom(@UploadedFile() file: UploadedExcelFile) {
    return this.importsService.importBom(file);
  }
}
