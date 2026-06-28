import { Controller, Get } from '@nestjs/common';
import { checkDatabase } from './database';

@Controller('health')
export class HealthController {
  @Get()
  health() {
    return {
      ok: true,
      service: 'zr-wms-api',
    };
  }

  @Get('db')
  async databaseHealth() {
    return checkDatabase();
  }
}
