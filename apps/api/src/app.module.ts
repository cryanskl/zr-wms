import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { SearchController } from './search/search.controller';
import { SearchService } from './search/search.service';

@Module({
  controllers: [HealthController, SearchController],
  providers: [SearchService],
})
export class AppModule {}
