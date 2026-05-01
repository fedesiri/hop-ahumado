import { Controller, Get, Param, Patch, Query, Req } from "@nestjs/common";
import { RequestWithFirebase, upsertAppUserFromRequest } from "../auth/resolve-request-user";
import { PrismaService } from "../prisma/prisma.service";
import { GetNotificationsQueryDto } from "./dto/get-notifications.query.dto";
import { NotificationsService } from "./notifications.service";

@Controller("notifications")
export class NotificationsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Get()
  async findAll(@Req() req: RequestWithFirebase, @Query() query: GetNotificationsQueryDto) {
    const user = await upsertAppUserFromRequest(this.prisma, req);
    return this.notificationsService.listQuery(user.id, query);
  }

  @Patch("read-all")
  async markAll(@Req() req: RequestWithFirebase) {
    const user = await upsertAppUserFromRequest(this.prisma, req);
    return this.notificationsService.markAllRead(user.id);
  }

  @Patch(":id/read")
  async markOne(@Req() req: RequestWithFirebase, @Param("id") id: string) {
    const user = await upsertAppUserFromRequest(this.prisma, req);
    await this.notificationsService.markRead(user.id, id);
    return { ok: true };
  }
}
