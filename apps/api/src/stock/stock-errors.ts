import { ConflictException, InternalServerErrorException } from '@nestjs/common';
import { mapPgConcurrencyError } from '../db-errors';

interface PgErrorLike {
  code?: string;
  message?: string;
}

export function mapStoredProcedureError(error: unknown): never {
  const pgError = error as PgErrorLike;
  if (pgError.code === '23514' || pgError.code === 'P0001') {
    throw new ConflictException(pgError.message ?? '库存操作冲突');
  }

  try {
    mapPgConcurrencyError(error);
  } catch (mapped) {
    if (mapped !== error) throw mapped;
  }

  throw new InternalServerErrorException('库存操作失败');
}
