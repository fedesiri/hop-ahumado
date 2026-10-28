import { Injectable, NotFoundException } from "@nestjs/common";
import { Logger } from "nestjs-pino";
import { OnEvent } from "@nestjs/event-emitter";
import { Cron, CronExpression } from "@nestjs/schedule";
import { buildPaginatedResponse, toLimit, toPage } from "../common/pagination";
import { PrismaService } from "../prisma/prisma.service";
import {
  NOTIFICATION_CATALOG,
  type CrmAssignPayload,
  type CustomerLapsedPayload,
  type CrmFollowupPayload,
  type CrmInteractionPayload,
  type StockAtypicalPayload,
  type StockQtyPayload,
} from "./catalog";
import type { GetNotificationsQueryDto } from "./dto/get-notifications.query.dto";

const RETENTION_DAYS = Number(process.env.NOTIFICATION_RETENTION_DAYS ?? 90);
/** Días sin comprar a partir de los cuales se avisa de un cliente mayorista. */
const LAPSE_DAYS = Number(process.env.CUSTOMER_LAPSE_DAYS ?? 30);
const WHOLESALE_TYPE = /mayorista|empresa|distribuidor|b2b/i;
const NON_WHOLESALE_TYPE = /particular|minorista|consumidor|b2c/i;

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly log: Logger,
  ) {}

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
        // Una sola vez por fecha de seguimiento vencida; si se reprograma y vuelve a vencer, avisa de nuevo.
        if (p.nextFollowUpAt && (await this.alreadyNotifiedSince("crm.followup_due", p.id, p.nextFollowUpAt))) continue;
        void this.ingest("crm.followup_due", {
          profileId: p.id,
          customerName: p.customer.name,
        });
      }
    } catch (e) {
      this.log.error("scanOverdueFollowups", e);
    }
  }

  /**
   * Clientes mayoristas con LAPSE_DAYS o más sin comprar (última compra = `deliveryDate` de pedidos no
   * cancelados). Es mayorista si su tipo en el CRM es Mayorista / Empresa; si no tiene tipo reconocible,
   * si alguna vez compró con lista mayorista. Los que nunca compraron cuentan desde que se cargaron al CRM.
   * `referenceDate` es la fecha desde la que se mide (última compra o alta) y define cuándo ya se avisó.
   */
  async findLapsedWholesaleCustomers(
    now: Date = new Date(),
  ): Promise<(CustomerLapsedPayload & { referenceDate: Date })[]> {
    const customers = await this.prisma.customer.findMany({
      where: { profile: { isNot: null } },
      select: {
        name: true,
        profile: { select: { id: true, customerType: true, createdAt: true } },
        orders: { where: { cancelledAt: null }, select: { deliveryDate: true, priceListType: true } },
      },
    });

    const lapsed: (CustomerLapsedPayload & { referenceDate: Date })[] = [];
    for (const c of customers) {
      if (!c.profile) continue;
      const type = c.profile.customerType ?? "";
      const isWholesale = WHOLESALE_TYPE.test(type)
        ? true
        : NON_WHOLESALE_TYPE.test(type)
          ? false
          : c.orders.some((o) => o.priceListType === "mayorista");
      if (!isWholesale) continue;

      const lastPurchase =
        c.orders.length > 0 ? new Date(Math.max(...c.orders.map((o) => o.deliveryDate.getTime()))) : null;
      const referenceDate = lastPurchase ?? c.profile.createdAt;
      const days = Math.floor((now.getTime() - referenceDate.getTime()) / 86_400_000);
      if (days < LAPSE_DAYS) continue;
      lapsed.push({
        profileId: c.profile.id,
        customerName: c.name,
        daysSincePurchase: days,
        lastPurchaseAt: lastPurchase?.toISOString() ?? null,
        referenceDate,
      });
    }
    return lapsed.sort((a, b) => a.daysSincePurchase - b.daysSincePurchase);
  }

  /** Una vez por día; avisa una sola vez por cada última compra (si vuelve a comprar y se enfría, avisa de nuevo). */
  @Cron("0 9 * * *", { timeZone: "America/Argentina/Buenos_Aires" })
  async scanLapsedWholesaleCustomers(): Promise<void> {
    try {
      for (const { referenceDate, ...payload } of await this.findLapsedWholesaleCustomers()) {
        if (await this.alreadyNotifiedSince("crm.customer_lapsed", payload.profileId, referenceDate)) continue;
        await this.ingest("crm.customer_lapsed", payload);
      }
    } catch (e) {
      this.log.error("scanLapsedWholesaleCustomers", e);
    }
  }

  /** ¿Ya hay una notificación de ese tipo para el perfil creada a partir de `since`? */
  private async alreadyNotifiedSince(eventType: string, profileId: string, since: Date): Promise<boolean> {
    const found = await this.prisma.notification.findFirst({
      where: { eventType, entityType: "customer_profile", entityId: profileId, createdAt: { gte: since } },
      select: { id: true },
    });
    return found != null;
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
