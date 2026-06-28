import { Body, Controller, Get, Inject, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CurrentUser } from './current-user';
import { JwtAuthGuard } from './jwt-auth.guard';

interface LoginBody {
  username?: string;
  password?: string;
}

@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() body: LoginBody) {
    return this.authService.login(body.username ?? '', body.password ?? '');
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() request: { user: CurrentUser }) {
    return request.user;
  }
}
