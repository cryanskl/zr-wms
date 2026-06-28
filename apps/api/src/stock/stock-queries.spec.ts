import { describe, expect, it } from 'vitest';
import { buildInboundQuery, buildOutboundQuery, buildTransferQuery } from './stock-queries';

describe('stock operation SQL builders', () => {
  it('calls only stored procedures for inventory writes', () => {
    const sql = [
      buildInboundQuery().text,
      buildOutboundQuery().text,
      buildTransferQuery().text,
    ].join('\n');

    expect(sql).toContain('op_inbound');
    expect(sql).toContain('op_outbound');
    expect(sql).toContain('op_transfer');
    expect(sql).not.toMatch(/\bUPDATE\s+(inventory|stock_movement)\b/i);
    expect(sql).not.toMatch(/\bDELETE\s+FROM\s+(inventory|stock_movement)\b/i);
  });
});
