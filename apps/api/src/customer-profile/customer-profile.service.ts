import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { CustomerProfile } from "@prisma/client";
import { buildPaginatedResponse, PaginatedResponse, PAGINATION } from "../common/pagination";
import { PrismaService } from "../prisma/prisma.service";
import { CreateCustomerProfileDto } from "./dto/create-customer-profile.dto";
import { UpdateCustomerProfileDto } from "./dto/update-customer-profile.dto";

type CustomerProfileWithRelations = CustomerProfile & {
  customer: { id: string; name: string };
  responsible: { id: string; name: string; email: string } | null;
};

@Injectable()
export class CustomerProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /** Crea un perfil mínimo si el cliente no tenía uno (p. ej. tras el primer pedido). Idempotente. */
  async ensureProfileForCustomer(customerId: string): Promise<CustomerProfile> {
    await this.validateCustomerExists(customerId);
    const existing = await this.prisma.customerProfile.findUnique({
      where: { customerId },
    });
    if (existing) {
      return existing;
    }
    return this.prisma.customerProfile.create({
      data: { customerId },
    });
  }

  async create(dto: CreateCustomerProfileDto) {
    await this.validateCustomerExists(dto.customerId);
    await this.validateCustomerHasNoProfile(dto.customerId);
    if (dto.responsibleId) {
      await this.validateUserExists(dto.responsibleId);
    }
    const data = this.mapCreateDtoToPrisma(dto);
    const row = await this.prisma.customerProfile.create({
      data,
      include: { customer: true, responsible: true },
    });
    if (dto.responsibleId) {
      this.eventEmitter.emit("crm.opportunity_assigned", {
        profileId: row.id,
        customerName: row.customer.name,
        assignedUserId: dto.responsibleId,
      });
    }
    return row;
  }

  async findAll(
    page: number = PAGINATION.defaultPage,
    limit: number = PAGINATION.defaultLimit,
  ): Promise<PaginatedResponse<CustomerProfileWithRelations>> {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.customerProfile.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          customer: { select: { id: true, name: true } },
          responsible: { select: { id: true, name: true, email: true } },
        },
        skip,
        take: limit,
      }),
      this.prisma.customerProfile.count(),
    ]);
    return buildPaginatedResponse(data, total, page, limit);
  }

  async findOne(id: string) {
    const profile = await this.prisma.customerProfile.findUnique({
      where: { id },
      include: {
        customer: true,
        responsible: { select: { id: true, name: true, email: true } },
      },
    });
    if (!profile) {
      throw new NotFoundException(`Perfil de cliente con id "${id}" no encontrado`);
    }
    return profile;
  }

  async update(id: string, dto: UpdateCustomerProfileDto) {
    const existing = await this.findOne(id);
    if (dto.customerId !== undefined) {
      await this.validateCustomerExists(dto.customerId);
      await this.validateCustomerHasNoProfile(dto.customerId, id);
    }
    if (dto.responsibleId !== undefined && dto.responsibleId) {
      await this.validateUserExists(dto.responsibleId);
    }
    const data = this.mapUpdateDtoToPrisma(dto);
    const updated = await this.prisma.customerProfile.update({
      where: { id },
      data,
      include: { customer: true, responsible: true },
    });
    const assignedNew =
      dto.responsibleId !== undefined && !!dto.responsibleId && dto.responsibleId !== existing.responsibleId;
    if (assignedNew && dto.responsibleId) {
      this.eventEmitter.emit("crm.opportunity_assigned", {
        profileId: id,
        customerName: updated.customer.name,
        opportunityId: undefined,
        assignedUserId: dto.responsibleId,
      });
    }
    return updated;
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.customerProfile.delete({
      where: { id },
      include: { customer: true, responsible: true },
    });
  }

  private async validateCustomerExists(customerId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
    });
    if (!customer) {
      throw new BadRequestException(`Cliente con id "${customerId}" no encontrado`);
    }
  }

  private async validateCustomerHasNoProfile(customerId: string, excludeProfileId?: string) {
    const existing = await this.prisma.customerProfile.findUnique({
      where: { customerId },
    });
    if (existing && existing.id !== excludeProfileId) {
      throw new BadRequestException(`El cliente con id "${customerId}" ya tiene un perfil asociado`);
    }
  }

  private async validateUserExists(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new BadRequestException(`Usuario con id "${userId}" no encontrado`);
    }
  }

  private mapCreateDtoToPrisma(dto: CreateCustomerProfileDto) {
    return {
      customerId: dto.customerId,
      contactName: dto.contactName ?? undefined,
      phone: dto.phone ?? undefined,
      email: dto.email ?? undefined,
      customerType: dto.customerType ?? undefined,
      status: dto.status ?? undefined,
      source: dto.source ?? undefined,
      responsibleId: dto.responsibleId ?? undefined,
      generalNotes: dto.generalNotes ?? undefined,
      nextFollowUpAt: dto.nextFollowUpAt ? new Date(dto.nextFollowUpAt) : undefined,
    };
  }

  private mapUpdateDtoToPrisma(dto: UpdateCustomerProfileDto) {
    return {
      ...(dto.customerId !== undefined && { customerId: dto.customerId }),
      ...(dto.contactName !== undefined && { contactName: dto.contactName }),
      ...(dto.phone !== undefined && { phone: dto.phone }),
      ...(dto.email !== undefined && { email: dto.email }),
      ...(dto.customerType !== undefined && { customerType: dto.customerType }),
      ...(dto.status !== undefined && { status: dto.status }),
      ...(dto.source !== undefined && { source: dto.source }),
      ...(dto.responsibleId !== undefined && { responsibleId: dto.responsibleId }),
      ...(dto.generalNotes !== undefined && { generalNotes: dto.generalNotes }),
      ...(dto.nextFollowUpAt !== undefined && {
        nextFollowUpAt: dto.nextFollowUpAt ? new Date(dto.nextFollowUpAt) : null,
      }),
    };
  }
}
