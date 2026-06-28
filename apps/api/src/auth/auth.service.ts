import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
import { queryDatabase } from '../database';
import { CurrentUser, UserRole } from './current-user';

interface UserPasswordRow {
  user_id: string;
  name: string;
  role: UserRole;
  password_hash: string;
}

@Injectable()
export class AuthService {
  constructor(@Inject(JwtService) private readonly jwtService: JwtService) {}

  async login(username: string, password: string) {
    const result = await queryDatabase<UserPasswordRow>(
      `
        SELECT app_user.user_id::text, app_user.name, app_user.role, app_user_password.password_hash
        FROM app_user
        JOIN app_user_password ON app_user_password.user_id = app_user.user_id
        WHERE app_user.name = $1 AND app_user.active
        LIMIT 1
      `,
      [username],
    );

    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    const userId = Number(user.user_id);
    const currentUser: CurrentUser = {
      userId,
      name: user.name,
      role: user.role,
    };

    const accessToken = await this.jwtService.signAsync({
      sub: userId,
      user_id: userId,
      name: user.name,
      role: user.role,
    });

    return {
      accessToken,
      user: currentUser,
    };
  }
}
