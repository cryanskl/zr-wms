import { Reflector } from '@nestjs/core';
import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { RolesGuard } from './roles.guard';
import { ROLES_KEY } from './roles.decorator';

function makeContext(role: string, roles: string[]) {
  const handler = () => undefined;
  Reflect.defineMetadata(ROLES_KEY, roles, handler);

  return {
    getHandler: () => handler,
    getClass: () => class TestController {},
    switchToHttp: () => ({
      getRequest: () => ({
        user: { role },
      }),
    }),
  } as never;
}

describe('RolesGuard', () => {
  it('allows users with a required role', () => {
    const guard = new RolesGuard(new Reflector());

    expect(guard.canActivate(makeContext('ADMIN', ['ADMIN']))).toBe(true);
  });

  it('rejects users without a required role', () => {
    const guard = new RolesGuard(new Reflector());

    expect(() => guard.canActivate(makeContext('OPERATOR', ['ADMIN']))).toThrow(ForbiddenException);
  });
});
