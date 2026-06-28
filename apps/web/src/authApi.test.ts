import { describe, expect, it } from 'vitest';
import { buildLoginRequest } from './authApi';

describe('buildLoginRequest', () => {
  it('builds the thin auth login request', () => {
    expect(buildLoginRequest({ username: 'operator', password: 'operator123' })).toEqual({
      url: '/api/v1/auth/login',
      init: {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'operator', password: 'operator123' }),
      },
    });
  });
});
