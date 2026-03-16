import { Injectable, NotFoundException } from "@nestjs/common";
import { buildPaginatedResponse, PaginatedResponse, PAGINATION } from "../common/pagination";
import { CustomerInteractionService } from "../customer-interaction/customer-interaction.service";
import { CustomerOpportunityService } from "../customer-opportunity/customer-opportunity.service";
import { CustomerProfileService } from "../customer-profile/customer-profile.service";
import { CustomerService } from "../customer/customer.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreateCrmCustomerDto } from "./dto/create-crm-customer.dto";

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
  lastContactAt: Date | null;
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
  ): Promise<PaginatedResponse<CrmCustomerListItem>> {
    const skip = (page - 1) * limit;
    const [customers, total] = await Promise.all([
      this.prisma.customer.findMany({
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
      this.prisma.customer.count(),
    ]);

    const now = new Date();
    const data: CrmCustomerListItem[] = customers.map((c) => {
      const p = c.profile;
      const lastInteraction = p?.interactions?.[0];
      const lastContactAt = lastInteraction?.date ?? null;
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
    const lastInteraction = profile.interactions[0];
    const lastContactAt = lastInteraction?.date ?? null;
    const now = new Date();
    const daysSinceLastContact =
      lastContactAt != null ? Math.floor((now.getTime() - lastContactAt.getTime()) / (1000 * 60 * 60 * 24)) : null;
    return {
      ...profile,
      lastContactAt,
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
