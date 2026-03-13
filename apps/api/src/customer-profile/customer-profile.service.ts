import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { CustomerProfile } from "@prisma/client";
import { buildPaginatedResponse, PaginatedResponse, PAGINATION } from "../common/pagination";
import { PrismaService } from "../prisma/prisma.service";
import { CreateCustomerProfileDto } from "./dto/create-customer-profile.dto";
import { UpdateCustomerProfileDto } from "./dto/update-customer-profile.dto";

type CustomerProfileWithRelations = CustomerProfile & {
  customer: { id: string; name: string; phone: string | null; email: string | null };
  responsible: { id: string; name: string; email: string } | null;
};

@Injectable()
export class CustomerProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCustomerProfileDto) {
    await this.validateCustomerExists(dto.customerId);
    await this.validateCustomerHasNoProfile(dto.customerId);
    if (dto.responsibleId) {
      await this.validateUserExists(dto.responsibleId);
    }
    const data = this.mapCreateDtoToPrisma(dto);
    return this.prisma.customerProfile.create({
      data,
      include: { customer: true, responsible: true },
    });
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
          customer: { select: { id: true, name: true, phone: true, email: true } },
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
    await this.findOne(id);
    if (dto.customerId !== undefined) {
      await this.validateCustomerExists(dto.customerId);
      await this.validateCustomerHasNoProfile(dto.customerId, id);
    }
    if (dto.responsibleId !== undefined && dto.responsibleId) {
      await this.validateUserExists(dto.responsibleId);
    }
    const data = this.mapUpdateDtoToPrisma(dto);
    return this.prisma.customerProfile.update({
      where: { id },
      data,
      include: { customer: true, responsible: true },
    });
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
      company: dto.company ?? undefined,
      customerType: dto.customerType ?? undefined,
      status: dto.status ?? undefined,
      source: dto.source ?? undefined,
      responsibleId: dto.responsibleId ?? undefined,
      lastContactAt: dto.lastContactAt ? new Date(dto.lastContactAt) : undefined,
    };
  }

  private mapUpdateDtoToPrisma(dto: UpdateCustomerProfileDto) {
    return {
      ...(dto.customerId !== undefined && { customerId: dto.customerId }),
      ...(dto.company !== undefined && { company: dto.company }),
      ...(dto.customerType !== undefined && { customerType: dto.customerType }),
      ...(dto.status !== undefined && { status: dto.status }),
      ...(dto.source !== undefined && { source: dto.source }),
      ...(dto.responsibleId !== undefined && { responsibleId: dto.responsibleId }),
      ...(dto.lastContactAt !== undefined && {
        lastContactAt: dto.lastContactAt ? new Date(dto.lastContactAt) : null,
      }),
    };
  }
}
