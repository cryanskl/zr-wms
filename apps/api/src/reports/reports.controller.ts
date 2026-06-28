import { Body, Controller, Get, HttpCode, Inject, Post, Query, Res, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ExportBody, ReportsService } from './reports.service';

interface FileResponse {
  setHeader(name: string, value: string): void;
  send(body: Buffer): void;
}

@UseGuards(JwtAuthGuard)
@Controller()
export class ReportsController {
  constructor(@Inject(ReportsService) private readonly reportsService: ReportsService) {}

  @Get('reports/period')
  period(@Query('range') range?: string) {
    return this.reportsService.period(range);
  }

  @Get('reports/dead-stock')
  deadStock(@Query('days') days?: string) {
    return this.reportsService.deadStock(days);
  }

  @Get('reports/slot-utilization')
  slotUtilization() {
    return this.reportsService.slotUtilization();
  }

  @Post('export')
  @HttpCode(200)
  async export(@Body() body: ExportBody, @Res() response: FileResponse) {
    const result = await this.reportsService.export(body);
    response.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    response.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);
    response.send(result.buffer);
  }
}
