import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Decimal } from "@prisma/client/runtime/library";
import { PrismaService } from "../prisma/prisma.service";
import { UpdateTreasuryBaselineDto } from "./dto/update-treasury-baseline.dto";

export type TreasuryBaselineResponse = {
  openingCash: number;
  openingCard: number;
  deltaSince: string;
  updatedAt: string;
};

@Injectable()
export class TreasuryService {
  constructor(private readonly prisma: PrismaService) {}

  async getBaseline(businessLineId: string): Promise<TreasuryBaselineResponse> {
    const row = await this.prisma.treasuryBaseline.findUnique({
      where: { businessLineId },
    });
    if (!row) {
      throw new NotFoundException(`No existe baseline para businessLineId "${businessLineId}"`);
    }
    return {
      openingCash: Number(row.openingCash),
      openingCard: Number(row.openingCard),
      deltaSince: row.deltaSince.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async updateBaseline(dto: UpdateTreasuryBaselineDto): Promise<TreasuryBaselineResponse> {
    const deltaSince = new Date(dto.deltaSince);
    if (Number.isNaN(deltaSince.getTime())) {
      throw new BadRequestException("deltaSince inválido");
    }
    const row = await this.prisma.treasuryBaseline.upsert({
      where: { businessLineId: dto.businessLineId },
      create: {
        openingCash: new Decimal(dto.openingCash),
        openingCard: new Decimal(dto.openingCard),
        deltaSince,
        businessLineId: dto.businessLineId,
      },
      update: {
        openingCash: new Decimal(dto.openingCash),
        openingCard: new Decimal(dto.openingCard),
        deltaSince,
      },
    });
    return {
      openingCash: Number(row.openingCash),
      openingCard: Number(row.openingCard),
      deltaSince: row.deltaSince.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
