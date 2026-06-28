import { Controller, Inject, Post, Req, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { NotificationsService } from './notifications.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(@Inject(NotificationsService) private readonly notificationsService: NotificationsService) {}

  @Post('test')
  @Roles('ADMIN', 'BOSS')
  test(@Req() request: { user: CurrentUser }) {
    return this.notificationsService.sendTestNotification(request.user.userId);
  }
}
