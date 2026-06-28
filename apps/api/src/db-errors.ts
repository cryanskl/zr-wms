import { ConflictException } from '@nestjs/common';

interface PgErrorLike {
  code?: string;
  message?: string;
}

export function mapPgConcurrencyError(error: unknown): never {
  const pgError = error as PgErrorLike;
  const message = pgError.message?.toLowerCase() ?? '';

  if (
    pgError.code === '40001' ||
    pgError.code === '40P01' ||
    message.includes('version') ||
    message.includes('stale') ||
    message.includes('乐观锁')
  ) {
    throw new ConflictException('数据已被其他人修改，请刷新后重试');
  }

  throw error;
}
