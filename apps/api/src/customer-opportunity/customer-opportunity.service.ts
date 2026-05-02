import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { PrismaService } from "../prisma/prisma.service";
import { CreateCustomerOpportunityDto } from "./dto/create-customer-opportunity.dto";
import { UpdateCustomerOpportunityDto } from "./dto/update-customer-opportunity.dto";

@Injectable()
export class CustomerOpportunityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(dto: CreateCustomerOpportunityDto) {
    await this.validateProfileExists(dto.customerProfileId);
    const existing = await this.prisma.customerOpportunity.findUnique({
      where: { customerProfileId: dto.customerProfileId },
    });
    if (existing) {
      throw new BadRequestException(`Ya existe una oportunidad para el perfil con id "${dto.customerProfileId}"`);
    }
    const row = await this.prisma.customerOpportunity.create({
      data: {
        customerProfileId: dto.customerProfileId,
        stage: dto.stage ?? undefined,
        estimatedValue: dto.estimatedValue ?? undefined,
        expectedClosingDate: dto.expectedClosingDate ? new Date(dto.expectedClosingDate) : undefined,
        notes: dto.notes ?? undefined,
      },
      include: {
        customerProfile: { include: { customer: true, responsible: true } },
      },
    });
    this.eventEmitter.emit("crm.opportunity_assigned", {
      profileId: row.customerProfileId,
      customerName: row.customerProfile.customer.name,
      opportunityId: row.id,
      assignedUserId: row.customerProfile.responsibleId,
    });
    return row;
  }

  async findByProfileId(profileId: string) {
    return this.prisma.customerOpportunity.findUnique({
      where: { customerProfileId: profileId },
      include: { customerProfile: { include: { customer: true } } },
    });
  }

  async findOne(id: string) {
    const opportunity = await this.prisma.customerOpportunity.findUnique({
      where: { id },
      include: { customerProfile: { include: { customer: true } } },
    });
    if (!opportunity) {
      throw new NotFoundException(`Oportunidad con id "${id}" no encontrada`);
    }
    return opportunity;
  }

  async update(id: string, dto: UpdateCustomerOpportunityDto) {
    await this.findOne(id);
    return this.prisma.customerOpportunity.update({
      where: { id },
      data: {
        ...(dto.stage !== undefined && { stage: dto.stage }),
        ...(dto.estimatedValue !== undefined && { estimatedValue: dto.estimatedValue }),
        ...(dto.expectedClosingDate !== undefined && {
          expectedClosingDate: dto.expectedClosingDate ? new Date(dto.expectedClosingDate) : null,
        }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
      include: { customerProfile: { include: { customer: true } } },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.customerOpportunity.delete({
      where: { id },
      include: { customerProfile: { include: { customer: true } } },
    });
  }

  async upsertByProfileId(profileId: string, dto: UpdateCustomerOpportunityDto) {
    const existing = await this.prisma.customerOpportunity.findUnique({
      where: { customerProfileId: profileId },
    });
    if (existing) {
      return this.update(existing.id, dto);
    }
    return this.create({
      customerProfileId: profileId,
      ...dto,
    });
  }

  private async validateProfileExists(profileId: string) {
    const profile = await this.prisma.customerProfile.findUnique({
      where: { id: profileId },
    });
    if (!profile) {
      throw new BadRequestException(`Perfil de cliente con id "${profileId}" no encontrado`);
    }
  }
}
