import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { OperationLogsService } from './operation-logs.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('operation-logs')
export class OperationLogsController {
  constructor(@Inject(OperationLogsService) private readonly operationLogsService: OperationLogsService) {}

  @Get()
  @Roles('ADMIN')
  list(@Query('entity_type') entityType?: string, @Query('action') action?: string, @Query('limit') limit?: string) {
    return this.operationLogsService.list({ entityType, action, limit });
  }
}
