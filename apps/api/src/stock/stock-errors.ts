import { ConflictException, InternalServerErrorException } from '@nestjs/common';

interface PgErrorLike {
  code?: string;
  message?: string;
}

export function mapStoredProcedureError(error: unknown): never {
  const pgError = error as PgErrorLike;
  if (pgError.code === '23514' || pgError.code === 'P0001') {
    throw new ConflictException(pgError.message ?? '库存操作冲突');
  }

  throw new InternalServerErrorException('库存操作失败');
}
