import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Decimal } from "@prisma/client/runtime/library";
import { PrismaService } from "../prisma/prisma.service";
import { CreateFixedCostItemDto, UpdateFixedCostItemDto } from "./dto/fixed-cost-item.dto";
import { CreatePartnerDto, UpdatePartnerDto } from "./dto/partner.dto";
import { UpsertChannelCommissionDto } from "./dto/upsert-channel-commission.dto";
import { UpsertOperationalParametersDto } from "./dto/upsert-operational-parameters.dto";

export type OperationalRates = {
  capacityHoursPerMonth: number;
  totalActiveSalaries: number;
  totalActiveFixedCosts: number;
  laborRatePerHour: number;
  fixedCostRatePerHour: number;
  totalOperativeRatePerHour: number;
  monthlyStructureTotal: number;
};

@Injectable()
export class OperationalParametersService {
  constructor(private readonly prisma: PrismaService) {}

  private async getOrCreate(businessLineId: string) {
    const existing = await this.prisma.operationalParameters.findUnique({ where: { businessLineId } });
    if (existing) return existing;
    const businessLine = await this.prisma.businessLine.findUnique({ where: { id: businessLineId } });
    if (!businessLine) {
      throw new BadRequestException(`Línea de negocio con id "${businessLineId}" no encontrada`);
    }
    return this.prisma.operationalParameters.create({
      data: { businessLineId, workDaysPerMonth: 0, hoursPerShift: 0, capacityHoursPerMonth: 0 },
    });
  }

  async getFull(businessLineId: string) {
    const parameters = await this.getOrCreate(businessLineId);
    const [partners, fixedCosts, channelCommissions] = await Promise.all([
      this.prisma.operationalPartner.findMany({ where: { parametersId: parameters.id }, orderBy: { name: "asc" } }),
      this.prisma.fixedCostItem.findMany({ where: { parametersId: parameters.id }, orderBy: { concept: "asc" } }),
      this.prisma.channelCommission.findMany({ where: { parametersId: parameters.id }, orderBy: { channel: "asc" } }),
    ]);
    const rates = this.computeRatesFrom(parameters.capacityHoursPerMonth, partners, fixedCosts);
    return {
      businessLineId,
      workDaysPerMonth: parameters.workDaysPerMonth,
      hoursPerShift: parameters.hoursPerShift,
      capacityHoursPerMonth: parameters.capacityHoursPerMonth,
      notes: parameters.notes,
      updatedAt: parameters.updatedAt,
      partners: partners.map((p) => ({ ...p, monthlySalary: Number(p.monthlySalary) })),
      fixedCosts: fixedCosts.map((f) => ({ ...f, monthlyCost: Number(f.monthlyCost) })),
      channelCommissions,
      rates,
    };
  }

  async getRates(businessLineId: string): Promise<OperationalRates> {
    const parameters = await this.prisma.operationalParameters.findUnique({ where: { businessLineId } });
    if (!parameters) {
      return {
        capacityHoursPerMonth: 0,
        totalActiveSalaries: 0,
        totalActiveFixedCosts: 0,
        laborRatePerHour: 0,
        fixedCostRatePerHour: 0,
        totalOperativeRatePerHour: 0,
        monthlyStructureTotal: 0,
      };
    }
    const [partners, fixedCosts] = await Promise.all([
      this.prisma.operationalPartner.findMany({ where: { parametersId: parameters.id } }),
      this.prisma.fixedCostItem.findMany({ where: { parametersId: parameters.id } }),
    ]);
    return this.computeRatesFrom(parameters.capacityHoursPerMonth, partners, fixedCosts);
  }

  async getChannelCommissionsMap(businessLineId: string): Promise<Record<string, number>> {
    const parameters = await this.prisma.operationalParameters.findUnique({ where: { businessLineId } });
    if (!parameters) return {};
    const rows = await this.prisma.channelCommission.findMany({ where: { parametersId: parameters.id } });
    return Object.fromEntries(rows.map((r) => [r.channel, r.commissionPct]));
  }

  private computeRatesFrom(
    capacityHoursPerMonth: number,
    partners: { monthlySalary: Decimal | number; active: boolean }[],
    fixedCosts: { monthlyCost: Decimal | number; active: boolean }[],
  ): OperationalRates {
    const totalActiveSalaries = partners
      .filter((p) => p.active)
      .reduce((sum, p) => sum + Number(p.monthlySalary), 0);
    const totalActiveFixedCosts = fixedCosts
      .filter((f) => f.active)
      .reduce((sum, f) => sum + Number(f.monthlyCost), 0);
    const laborRatePerHour = capacityHoursPerMonth > 0 ? totalActiveSalaries / capacityHoursPerMonth : 0;
    const fixedCostRatePerHour = capacityHoursPerMonth > 0 ? totalActiveFixedCosts / capacityHoursPerMonth : 0;
    return {
      capacityHoursPerMonth,
      totalActiveSalaries,
      totalActiveFixedCosts,
      laborRatePerHour,
      fixedCostRatePerHour,
      totalOperativeRatePerHour: laborRatePerHour + fixedCostRatePerHour,
      monthlyStructureTotal: totalActiveSalaries + totalActiveFixedCosts,
    };
  }

  async updateParameters(dto: UpsertOperationalParametersDto) {
    const existing = await this.prisma.operationalParameters.findUnique({ where: { businessLineId: dto.businessLineId } });
    if (existing) {
      await this.prisma.operationalParameters.update({
        where: { businessLineId: dto.businessLineId },
        data: {
          ...(dto.workDaysPerMonth !== undefined && { workDaysPerMonth: dto.workDaysPerMonth }),
          ...(dto.hoursPerShift !== undefined && { hoursPerShift: dto.hoursPerShift }),
          ...(dto.capacityHoursPerMonth !== undefined && { capacityHoursPerMonth: dto.capacityHoursPerMonth }),
          ...(dto.notes !== undefined && { notes: dto.notes }),
        },
      });
    } else {
      const businessLine = await this.prisma.businessLine.findUnique({ where: { id: dto.businessLineId } });
      if (!businessLine) {
        throw new BadRequestException(`Línea de negocio con id "${dto.businessLineId}" no encontrada`);
      }
      await this.prisma.operationalParameters.create({
        data: {
          businessLineId: dto.businessLineId,
          workDaysPerMonth: dto.workDaysPerMonth ?? 0,
          hoursPerShift: dto.hoursPerShift ?? 0,
          capacityHoursPerMonth: dto.capacityHoursPerMonth ?? 0,
          notes: dto.notes,
        },
      });
    }
    return this.getFull(dto.businessLineId);
  }

  async addPartner(dto: CreatePartnerDto) {
    const parameters = await this.getOrCreate(dto.businessLineId);
    await this.prisma.operationalPartner.create({
      data: {
        parametersId: parameters.id,
        name: dto.name,
        monthlySalary: new Decimal(dto.monthlySalary),
        active: dto.active ?? true,
      },
    });
    return this.getFull(dto.businessLineId);
  }

  async updatePartner(id: string, dto: UpdatePartnerDto) {
    const partner = await this.prisma.operationalPartner.findUnique({ where: { id }, include: { parameters: true } });
    if (!partner) throw new NotFoundException(`Socio con id "${id}" no encontrado`);
    await this.prisma.operationalPartner.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.monthlySalary !== undefined && { monthlySalary: new Decimal(dto.monthlySalary) }),
        ...(dto.active !== undefined && { active: dto.active }),
      },
    });
    return this.getFull(partner.parameters.businessLineId);
  }

  async removePartner(id: string) {
    const partner = await this.prisma.operationalPartner.findUnique({ where: { id }, include: { parameters: true } });
    if (!partner) throw new NotFoundException(`Socio con id "${id}" no encontrado`);
    await this.prisma.operationalPartner.delete({ where: { id } });
    return this.getFull(partner.parameters.businessLineId);
  }

  async addFixedCost(dto: CreateFixedCostItemDto) {
    const parameters = await this.getOrCreate(dto.businessLineId);
    await this.prisma.fixedCostItem.create({
      data: {
        parametersId: parameters.id,
        concept: dto.concept,
        monthlyCost: new Decimal(dto.monthlyCost),
        active: dto.active ?? true,
        notes: dto.notes,
      },
    });
    return this.getFull(dto.businessLineId);
  }

  async updateFixedCost(id: string, dto: UpdateFixedCostItemDto) {
    const item = await this.prisma.fixedCostItem.findUnique({ where: { id }, include: { parameters: true } });
    if (!item) throw new NotFoundException(`Costo fijo con id "${id}" no encontrado`);
    await this.prisma.fixedCostItem.update({
      where: { id },
      data: {
        ...(dto.concept !== undefined && { concept: dto.concept }),
        ...(dto.monthlyCost !== undefined && { monthlyCost: new Decimal(dto.monthlyCost) }),
        ...(dto.active !== undefined && { active: dto.active }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
    });
    return this.getFull(item.parameters.businessLineId);
  }

  async removeFixedCost(id: string) {
    const item = await this.prisma.fixedCostItem.findUnique({ where: { id }, include: { parameters: true } });
    if (!item) throw new NotFoundException(`Costo fijo con id "${id}" no encontrado`);
    await this.prisma.fixedCostItem.delete({ where: { id } });
    return this.getFull(item.parameters.businessLineId);
  }

  async upsertChannelCommission(dto: UpsertChannelCommissionDto) {
    const parameters = await this.getOrCreate(dto.businessLineId);
    await this.prisma.channelCommission.upsert({
      where: { parametersId_channel: { parametersId: parameters.id, channel: dto.channel } },
      create: {
        parametersId: parameters.id,
        channel: dto.channel,
        commissionPct: dto.commissionPct,
        notes: dto.notes,
      },
      update: {
        commissionPct: dto.commissionPct,
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
    });
    return this.getFull(dto.businessLineId);
  }
}
