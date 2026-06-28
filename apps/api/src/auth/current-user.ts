export type UserRole = 'OPERATOR' | 'ADMIN' | 'BOSS';

export interface CurrentUser {
  userId: number;
  name: string;
  role: UserRole;
}

export interface JwtPayload {
  sub: number;
  user_id: number;
  name: string;
  role: UserRole;
}
