import { Injectable } from '@nestjs/common';
import { queryDatabase } from '../database';
import { buildSearchQuery, SearchResultRow } from './search-query';

@Injectable()
export class SearchService {
  async search(rawQuery: string) {
    if (!rawQuery.trim()) {
      return [];
    }

    const searchQuery = buildSearchQuery(rawQuery);
    const result = await queryDatabase<SearchResultRow>(searchQuery.text, searchQuery.values);

    return result.rows.map((row) => ({
      ...row,
      score: Number(row.score),
    }));
  }
}
