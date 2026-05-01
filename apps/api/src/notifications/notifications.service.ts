import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { Cron, CronExpression } from "@nestjs/schedule";
import { buildPaginatedResponse, toLimit, toPage } from "../common/pagination";
import { PrismaService } from "../prisma/prisma.service";
import {
  NOTIFICATION_CATALOG,
  type CrmAssignPayload,
  type CrmFollowupPayload,
  type CrmInteractionPayload,
  type StockAtypicalPayload,
  type StockQtyPayload,
} from "./catalog";
import type { GetNotificationsQueryDto } from "./dto/get-notifications.query.dto";

const RETENTION_DAYS = Number(process.env.NOTIFICATION_RETENTION_DAYS ?? 90);

@Injectable()
export class NotificationsService {
  private readonly log = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  private async hasRecentDuplicate(
    eventType: string,
    entityType: string,
    entityId: string,
    windowHours: number,
  ): Promise<boolean> {
    const since = new Date(Date.now() - windowHours * 3_600_000);
    const found = await this.prisma.notification.findFirst({
      where: {
        eventType,
        entityType,
        entityId,
        createdAt: { gte: since },
      },
      select: { id: true },
    });
    return found != null;
  }

  private async ingest(eventType: string, payload: unknown): Promise<void> {
    const catalog = NOTIFICATION_CATALOG[eventType];
    if (!catalog) {
      this.log.warn(`Sin catálogo para eventType=${eventType}`);
      return;
    }
    try {
      const { entityType, entityId } = catalog.resolveEntity(payload);
      const hours = catalog.dedupeHours ?? 24;
      const dup = await this.hasRecentDuplicate(eventType, entityType, entityId, hours);
      if (dup) return;

      const message = catalog.messageTemplate(payload);
      const users = await this.prisma.user.findMany({ select: { id: true } });
      if (users.length === 0) return;

      await this.prisma.notification.create({
        data: {
          eventType,
          message,
          entityType,
          entityId,
          recipients: {
            createMany: {
              data: users.map((u) => ({ userId: u.id })),
            },
          },
        },
      });
    } catch (e) {
      this.log.error(`Error al ingestar notificación ${eventType}`, e);
    }
  }

  async listQuery(userId: string, query: GetNotificationsQueryDto) {
    const page = toPage(query);
    const limit = toLimit(query);
    const skip = (page - 1) * limit;

    const where = {
      userId,
      ...(query.unreadOnly === true ? { readAt: null } : {}),
    };

    const [rows, total, unreadCount] = await Promise.all([
      this.prisma.notificationRecipient.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ readAt: "desc" }, { notification: { createdAt: "desc" } }],
        include: { notification: true },
      }),
      this.prisma.notificationRecipient.count({ where }),
      this.prisma.notificationRecipient.count({
        where: { userId, readAt: null },
      }),
    ]);

    const data = rows.map((r) => ({
      id: r.id,
      readAt: r.readAt,
      notificationId: r.notification.id,
      eventType: r.notification.eventType,
      message: r.notification.message,
      entityType: r.notification.entityType,
      entityId: r.notification.entityId,
      createdAt: r.notification.createdAt.toISOString(),
    }));

    return {
      ...buildPaginatedResponse(data, total, page, limit),
      unreadCount,
    };
  }

  async markRead(userId: string, recipientId: string): Promise<void> {
    const row = await this.prisma.notificationRecipient.findFirst({
      where: { id: recipientId, userId },
    });
    if (!row) throw new NotFoundException("Notificación no encontrada");
    await this.prisma.notificationRecipient.update({
      where: { id: recipientId },
      data: { readAt: new Date() },
    });
  }

  async markAllRead(userId: string): Promise<{ updated: number }> {
    const res = await this.prisma.notificationRecipient.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: res.count };
  }

  @OnEvent("stock.low")
  handleStockLow(payload: StockQtyPayload): void {
    void this.ingest("stock.low", payload);
  }

  @OnEvent("stock.out")
  handleStockOut(payload: StockQtyPayload): void {
    void this.ingest("stock.out", payload);
  }

  @OnEvent("stock.atypical_movement")
  handleStockAtypical(payload: StockAtypicalPayload): void {
    void this.ingest("stock.atypical_movement", payload);
  }

  @OnEvent("crm.followup_due")
  handleFollowupDue(payload: CrmFollowupPayload): void {
    void this.ingest("crm.followup_due", payload);
  }

  @OnEvent("crm.interaction_created")
  handleInteraction(payload: CrmInteractionPayload): void {
    void this.ingest("crm.interaction_created", payload);
  }

  @OnEvent("crm.opportunity_assigned")
  handleAssign(payload: CrmAssignPayload): void {
    void this.ingest("crm.opportunity_assigned", payload);
  }

  @Cron(CronExpression.EVERY_HOUR)
  async scanOverdueFollowups(): Promise<void> {
    const now = new Date();
    try {
      const profiles = await this.prisma.customerProfile.findMany({
        where: {
          nextFollowUpAt: { lt: now, not: null },
        },
        include: {
          customer: { select: { id: true, name: true } },
        },
        take: 200,
      });
      for (const p of profiles) {
        void this.ingest("crm.followup_due", {
          profileId: p.id,
          customerName: p.customer.name,
        });
      }
    } catch (e) {
      this.log.error("scanOverdueFollowups", e);
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async purgeOldNotifications(): Promise<void> {
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 86_400_000);
    try {
      const res = await this.prisma.notification.deleteMany({
        where: { createdAt: { lt: cutoff } },
      });
      if (res.count > 0) {
        this.log.log(`purgeOldNotifications eliminadas=${res.count} (antes de ${cutoff.toISOString()})`);
      }
    } catch (e) {
      this.log.error("purgeOldNotifications", e);
    }
  }
}
