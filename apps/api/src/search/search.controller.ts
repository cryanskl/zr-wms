import { Controller, Get, Inject, Query } from '@nestjs/common';
import { SearchService } from './search.service';

@Controller('search')
export class SearchController {
  constructor(@Inject(SearchService) private readonly searchService: SearchService) {}

  @Get()
  search(@Query('q') q = '') {
    return this.searchService.search(q);
  }
}
