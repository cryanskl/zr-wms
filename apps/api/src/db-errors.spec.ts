import { ConflictException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { mapPgConcurrencyError } from './db-errors';

describe('mapPgConcurrencyError', () => {
  it('maps stale and serialization conflicts to refresh guidance', () => {
    expect(() => mapPgConcurrencyError({ code: '40001' })).toThrow(ConflictException);
    expect(() => mapPgConcurrencyError({ message: 'version mismatch' })).toThrow('刷新后重试');
  });

  it('rethrows unrelated errors', () => {
    const error = new Error('other');
    expect(() => mapPgConcurrencyError(error)).toThrow(error);
  });
});
