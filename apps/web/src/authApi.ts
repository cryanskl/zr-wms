export type UserRole = 'OPERATOR' | 'ADMIN' | 'BOSS';

export interface CurrentUser {
  userId: number;
  name: string;
  role: UserRole;
}

export interface LoginResponse {
  accessToken: string;
  user: CurrentUser;
}

export interface LoginInput {
  username: string;
  password: string;
}

export function buildLoginRequest(input: LoginInput) {
  return {
    url: '/api/v1/auth/login',
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  };
}

export async function login(input: LoginInput): Promise<LoginResponse> {
  const request = buildLoginRequest(input);
  const response = await fetch(request.url, request.init);
  if (!response.ok) {
    throw new Error(response.status === 401 ? '用户名或密码错误' : `登录失败：HTTP ${response.status}`);
  }

  return response.json() as Promise<LoginResponse>;
}
