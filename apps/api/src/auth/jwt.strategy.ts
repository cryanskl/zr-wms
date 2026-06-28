import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { CurrentUser, JwtPayload } from './current-user';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET ?? 'dev-only-wms-secret',
    });
  }

  validate(payload: JwtPayload): CurrentUser {
    return {
      userId: payload.sub,
      name: payload.name,
      role: payload.role,
    };
  }
}
