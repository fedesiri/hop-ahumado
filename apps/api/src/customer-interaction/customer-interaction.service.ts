import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { CustomerInteraction } from "@prisma/client";
import { buildPaginatedResponse, PaginatedResponse, PAGINATION } from "../common/pagination";
import { PrismaService } from "../prisma/prisma.service";
import { CreateCustomerInteractionDto } from "./dto/create-customer-interaction.dto";
import { UpdateCustomerInteractionDto } from "./dto/update-customer-interaction.dto";

type CustomerInteractionWithProfile = CustomerInteraction & {
  profile: { id: string; customerId: string; customer: { id: string; name: string } };
};

@Injectable()
export class CustomerInteractionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(dto: CreateCustomerInteractionDto) {
    await this.validateProfileExists(dto.profileId);
    const interaction = await this.prisma.customerInteraction.create({
      data: {
        profileId: dto.profileId,
        channel: dto.channel ?? undefined,
        date: dto.date ? new Date(dto.date) : undefined,
        notes: dto.notes ?? undefined,
        nextStep: dto.nextStep ?? undefined,
      },
      include: {
        profile: {
          select: {
            id: true,
            customerId: true,
            customer: { select: { id: true, name: true } },
          },
        },
      },
    });
    this.eventEmitter.emit("crm.interaction_created", {
      profileId: dto.profileId,
      customerName: interaction.profile.customer.name,
      interactionId: interaction.id,
    });
    return interaction;
  }

  async findAll(
    page: number = PAGINATION.defaultPage,
    limit: number = PAGINATION.defaultLimit,
    profileId?: string,
  ): Promise<PaginatedResponse<CustomerInteractionWithProfile>> {
    const where = profileId ? { profileId } : undefined;
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.customerInteraction.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: {
          profile: {
            select: {
              id: true,
              customerId: true,
              customer: { select: { id: true, name: true } },
            },
          },
        },
        skip,
        take: limit,
      }),
      this.prisma.customerInteraction.count({ where }),
    ]);
    return buildPaginatedResponse(data, total, page, limit);
  }

  async findOne(id: string) {
    const interaction = await this.prisma.customerInteraction.findUnique({
      where: { id },
      include: {
        profile: { include: { customer: { select: { id: true, name: true } } } },
      },
    });
    if (!interaction) {
      throw new NotFoundException(`Interacción con id "${id}" no encontrada`);
    }
    return interaction;
  }

  async update(id: string, dto: UpdateCustomerInteractionDto) {
    await this.findOne(id);
    return this.prisma.customerInteraction.update({
      where: { id },
      data: {
        ...(dto.channel !== undefined && { channel: dto.channel }),
        ...(dto.date !== undefined && { date: new Date(dto.date) }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.nextStep !== undefined && { nextStep: dto.nextStep }),
      },
      include: {
        profile: {
          select: {
            id: true,
            customerId: true,
            customer: { select: { id: true, name: true } },
          },
        },
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.customerInteraction.delete({
      where: { id },
      include: {
        profile: {
          select: {
            id: true,
            customerId: true,
            customer: { select: { id: true, name: true } },
          },
        },
      },
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
