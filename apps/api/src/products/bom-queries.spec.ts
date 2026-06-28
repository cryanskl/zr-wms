import { describe, expect, it } from 'vitest';
import {
  buildBomQuery,
  buildDeleteBomLinesQuery,
  buildInsertBomLineQuery,
  buildPathAliasesQuery,
  buildRegeneratePathAliasesQuery,
  buildWhereUsedQuery,
} from './bom-queries';

describe('BOM query builders', () => {
  it('regenerates path aliases and delegates where-used to database functions', () => {
    const sql = [
      buildBomQuery().text,
      buildDeleteBomLinesQuery().text,
      buildInsertBomLineQuery().text,
      buildRegeneratePathAliasesQuery().text,
      buildWhereUsedQuery().text,
      buildPathAliasesQuery().text,
    ].join('\n');

    expect(sql).toContain('fn_regen_path_aliases');
    expect(sql).toContain('fn_where_used');
    expect(sql).toContain('bom_line');
    expect(sql).not.toMatch(/\b(UPDATE|DELETE\s+FROM)\s+(inventory|stock_movement)\b/i);
    expect(sql).not.toMatch(/\b(inventory|stock_movement)\s+SET\b/i);
  });
});
