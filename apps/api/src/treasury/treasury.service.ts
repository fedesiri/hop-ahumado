import { BadRequestException, Injectable } from "@nestjs/common";
import { Decimal } from "@prisma/client/runtime/library";
import { PrismaService } from "../prisma/prisma.service";
import { UpdateTreasuryBaselineDto } from "./dto/update-treasury-baseline.dto";

const SINGLETON_ID = "singleton";

export type TreasuryBaselineResponse = {
  openingCash: number;
  openingCard: number;
  deltaSince: string;
  updatedAt: string;
};

@Injectable()
export class TreasuryService {
  constructor(private readonly prisma: PrismaService) {}

  async getBaseline(): Promise<TreasuryBaselineResponse> {
    let row = await this.prisma.treasuryBaseline.findUnique({ where: { id: SINGLETON_ID } });
    if (!row) {
      const now = new Date();
      row = await this.prisma.treasuryBaseline.create({
        data: {
          id: SINGLETON_ID,
          openingCash: new Decimal(0),
          openingCard: new Decimal(0),
          deltaSince: now,
        },
      });
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
      where: { id: SINGLETON_ID },
      create: {
        id: SINGLETON_ID,
        openingCash: new Decimal(dto.openingCash),
        openingCard: new Decimal(dto.openingCard),
        deltaSince,
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
