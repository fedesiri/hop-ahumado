import { Injectable, NotFoundException } from "@nestjs/common";
import { buildPaginatedResponse, PaginatedResponse, PAGINATION } from "../common/pagination";
import { CustomerInteractionService } from "../customer-interaction/customer-interaction.service";
import { CustomerOpportunityService } from "../customer-opportunity/customer-opportunity.service";
import { CustomerProfileService } from "../customer-profile/customer-profile.service";
import { CustomerService } from "../customer/customer.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreateCrmCustomerDto } from "./dto/create-crm-customer.dto";

/** Coincidencias para el filtro del listado (UI solo ofrece Empresa / Particular; en DB suele haber texto libre del Excel). */
function customerTypeProfileClause(filter: string): Record<string, unknown> {
  const key = filter.trim().toLowerCase();
  const has = (substring: string) => ({ customerType: { contains: substring, mode: "insensitive" as const } });

  if (key === "empresa") {
    return {
      OR: [
        has("empresa"),
        has("b2b"),
        has("distribuidor"),
        has("mayorista"),
        has("comercial"),
        has("sociedad"),
        has("srl"),
        has("s.r.l"),
        has("s.a."),
        has("s.a"),
        has("compañía"),
        has("compania"),
      ],
    };
  }
  if (key === "particular") {
    return {
      OR: [
        has("minorista"),
        has("particular"),
        has("b2c"),
        has("consumidor"),
        has("hogar"),
        has("física"),
        has("fisica"),
        has("individual"),
      ],
    };
  }
  return has(filter);
}

/** Más reciente entre dos fechas opcionales (último vínculo pedido vs seguimiento CRM). */
function maxLinkageDate(a: Date | null | undefined, b: Date | null | undefined): Date | null {
  const ta = a?.getTime();
  const tb = b?.getTime();
  if (ta == null && tb == null) return null;
  if (tb == null) return a!;
  if (ta == null) return b!;
  return ta >= tb ? a! : b!;
}

export interface CrmCustomerListItem {
  /** ID del perfil CRM (null si el cliente aún no tiene perfil) */
  profileId: string | null;
  customerId: string;
  customerName: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  customerType: string | null;
  status: string | null;
  source: string | null;
  responsibleId: string | null;
  responsibleName: string | null;
  nextFollowUpAt: Date | null;
  /** max(última fecha de entrega de pedidos, última interacción CRM registrada) */
  lastContactAt: Date | null;
  /** última `deliveryDate` de algún pedido del cliente */
  lastOrderDeliveryAt: Date | null;
  /** fecha de la interacción CRM más reciente (si existe) */
  lastInteractionAt: Date | null;
  daysSinceLastContact: number | null;
}

@Injectable()
export class CrmService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly customerService: CustomerService,
    private readonly customerProfileService: CustomerProfileService,
    private readonly customerInteractionService: CustomerInteractionService,
    private readonly customerOpportunityService: CustomerOpportunityService,
  ) {}

  async listCrmCustomers(
    page: number = PAGINATION.defaultPage,
    limit: number = PAGINATION.defaultLimit,
    search?: string,
    status?: string,
    source?: string,
    customerType?: string,
    responsibleId?: string,
    responsibleSearch?: string,
  ): Promise<PaginatedResponse<CrmCustomerListItem>> {
    const skip = (page - 1) * limit;

    const t = (s?: string) => {
      const x = s?.trim();
      return x ? x : undefined;
    };
    const searchTrim = t(search);
    const statusTrim = t(status);
    const sourceTrim = t(source);
    const customerTypeTrim = t(customerType);
    const responsibleIdTrim = t(responsibleId);
    const responsibleSearchTrim = t(responsibleSearch);

    const where: any = {};

    const or: any[] = [];
    if (searchTrim) {
      or.push({ name: { contains: searchTrim, mode: "insensitive" } });
      or.push({ profile: { is: { contactName: { contains: searchTrim, mode: "insensitive" } } } });
      or.push({ profile: { is: { email: { contains: searchTrim, mode: "insensitive" } } } });
      or.push({ profile: { is: { phone: { contains: searchTrim, mode: "insensitive" } } } });
      or.push({ profile: { is: { source: { contains: searchTrim, mode: "insensitive" } } } });
      or.push({ profile: { is: { status: { contains: searchTrim, mode: "insensitive" } } } });
    }
    if (or.length) {
      where.AND = [...(where.AND ?? []), { OR: or }];
    }

    const profileParts: Record<string, unknown>[] = [];
    if (statusTrim) {
      profileParts.push({ status: { contains: statusTrim, mode: "insensitive" } });
    }
    if (sourceTrim) {
      profileParts.push({ source: { contains: sourceTrim, mode: "insensitive" } });
    }
    if (customerTypeTrim) {
      profileParts.push(customerTypeProfileClause(customerTypeTrim));
    }
    if (responsibleIdTrim) {
      profileParts.push({ responsibleId: responsibleIdTrim });
    } else if (responsibleSearchTrim) {
      profileParts.push({
        responsible: { is: { name: { contains: responsibleSearchTrim, mode: "insensitive" } } },
      });
    }
    if (profileParts.length > 0) {
      const profileIs = profileParts.length === 1 ? profileParts[0] : { AND: profileParts };
      where.AND = [...(where.AND ?? []), { profile: { is: profileIs } }];
    }

    const [customers, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        orderBy: { name: "asc" },
        include: {
          profile: {
            include: {
              responsible: { select: { id: true, name: true } },
              interactions: {
                orderBy: { date: "desc" },
                take: 1,
                select: { date: true },
              },
            },
          },
        },
        skip,
        take: limit,
      }),
      this.prisma.customer.count({ where }),
    ]);

    const customerIds = customers.map((c) => c.id);
    const orderMaxByCustomer =
      customerIds.length === 0
        ? []
        : await this.prisma.order.groupBy({
            by: ["customerId"],
            where: { customerId: { in: customerIds } },
            _max: { deliveryDate: true },
          });
    const lastDeliveryByCustomerId = new Map(
      orderMaxByCustomer
        .filter((row): row is typeof row & { customerId: string } => row.customerId != null)
        .map((row) => [row.customerId, row._max.deliveryDate]),
    );

    const now = new Date();
    const data: CrmCustomerListItem[] = customers.map((c) => {
      const p = c.profile;
      const lastInteraction = p?.interactions?.[0];
      const lastInteractionAt = lastInteraction?.date ?? null;
      const lastOrderDeliveryAt = lastDeliveryByCustomerId.get(c.id) ?? null;
      const lastContactAt = maxLinkageDate(lastOrderDeliveryAt ?? undefined, lastInteractionAt ?? undefined);
      const daysSinceLastContact =
        lastContactAt != null ? Math.floor((now.getTime() - lastContactAt.getTime()) / (1000 * 60 * 60 * 24)) : null;
      return {
        profileId: p?.id ?? null,
        customerId: c.id,
        customerName: c.name,
        contactName: p?.contactName ?? null,
        phone: p?.phone ?? null,
        email: p?.email ?? null,
        customerType: p?.customerType ?? null,
        status: p?.status ?? null,
        source: p?.source ?? null,
        responsibleId: p?.responsibleId ?? null,
        responsibleName: p?.responsible?.name ?? null,
        nextFollowUpAt: p?.nextFollowUpAt ?? null,
        lastContactAt,
        lastOrderDeliveryAt,
        lastInteractionAt,
        daysSinceLastContact,
      };
    });

    return buildPaginatedResponse(data, total, page, limit);
  }

  async getCrmCustomerDetail(profileId: string) {
    const profile = await this.prisma.customerProfile.findUnique({
      where: { id: profileId },
      include: {
        customer: true,
        responsible: { select: { id: true, name: true, email: true } },
        interactions: { orderBy: { date: "desc" }, take: 50 },
        opportunity: true,
      },
    });
    if (!profile) {
      throw new NotFoundException(`Perfil de cliente con id "${profileId}" no encontrado`);
    }
    const agg = await this.prisma.order.aggregate({
      where: { customerId: profile.customerId },
      _max: { deliveryDate: true },
    });
    const lastOrderDeliveryAt = agg._max.deliveryDate ?? null;
    const lastInteraction = profile.interactions[0];
    const lastInteractionAt = lastInteraction?.date ?? null;
    const lastContactAt = maxLinkageDate(lastOrderDeliveryAt ?? undefined, lastInteractionAt ?? undefined);
    const now = new Date();
    const daysSinceLastContact =
      lastContactAt != null ? Math.floor((now.getTime() - lastContactAt.getTime()) / (1000 * 60 * 60 * 24)) : null;
    return {
      ...profile,
      lastContactAt,
      lastOrderDeliveryAt,
      lastInteractionAt,
      daysSinceLastContact,
    };
  }

  async createCrmCustomer(dto: CreateCrmCustomerDto) {
    const customer = await this.customerService.create({ name: dto.name });
    const profile = await this.customerProfileService.create({
      customerId: customer.id,
      contactName: dto.contactName,
      phone: dto.phone,
      email: dto.email,
      customerType: dto.customerType,
      status: dto.status,
      source: dto.source,
      responsibleId: dto.responsibleId,
      generalNotes: dto.generalNotes,
      nextFollowUpAt: dto.nextFollowUpAt,
    });
    return { customer, profile };
  }

  async getDashboard() {
    const [profileCount, interactionCount, opportunityCount, byStatus] = await Promise.all([
      this.prisma.customerProfile.count(),
      this.prisma.customerInteraction.count(),
      this.prisma.customerOpportunity.count(),
      this.prisma.customerProfile.groupBy({
        by: ["status"],
        _count: { id: true },
        where: { status: { not: null } },
      }),
    ]);
    return {
      profileCount,
      interactionCount,
      opportunityCount,
      byStatus: byStatus.map((s) => ({ status: s.status, count: s._count.id })),
    };
  }
}
