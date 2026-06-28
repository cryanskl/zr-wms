import { describe, expect, it } from 'vitest';
import {
  buildDeleteImportedBomLinesQuery,
  buildImportInventoryInboundQuery,
  buildImportProductUpsertQuery,
  buildInsertImportedBomLineQuery,
  buildRegenerateImportedPathAliasesQuery,
} from './import-queries';

describe('import query builders', () => {
  it('uses op_inbound for inventory import writes', () => {
    const sql = buildImportInventoryInboundQuery().text;

    expect(sql).toContain('op_inbound');
    expect(sql).not.toMatch(/\bINSERT\s+INTO\s+(inventory|stock_movement)\b/i);
    expect(sql).not.toMatch(/\bUPDATE\s+(inventory|stock_movement)\b/i);
    expect(sql).not.toMatch(/\bDELETE\s+FROM\s+(inventory|stock_movement)\b/i);
  });

  it('builds product and BOM import queries for the documented tables', () => {
    expect(buildImportProductUpsertQuery().text).toContain('INSERT INTO product');
    expect(buildDeleteImportedBomLinesQuery().text).toContain('DELETE FROM bom_line');
    expect(buildInsertImportedBomLineQuery().text).toContain('INSERT INTO bom_line');
    expect(buildRegenerateImportedPathAliasesQuery().text).toContain('fn_regen_path_aliases');
  });
});
