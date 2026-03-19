import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PaymentMethod } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { randomUUID } from "crypto";
import { buildPaginatedResponse, PaginatedResponse, PAGINATION } from "../common/pagination";
import { PrismaService } from "../prisma/prisma.service";
import { CreateExpenseDto } from "./dto/create-expense.dto";

type ExpenseRecord = {
  id: string;
  amount: Decimal;
  method: PaymentMethod;
  description: string | null;
  createdAt: Date;
  groupId: string;
};

@Injectable()
export class ExpenseService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateExpenseDto): Promise<ExpenseRecord[]> {
    const cashAmount = dto.cashAmount ?? 0;
    const cardAmount = dto.cardAmount ?? 0;

    if (cashAmount <= 0 && cardAmount <= 0) {
      throw new BadRequestException("Debe ingresar al menos un monto mayor a 0 (cash o card).");
    }

    const groupId = randomUUID();
    const now = new Date();

    const created = await this.prisma.$transaction(async (tx) => {
      const records: ExpenseRecord[] = [];

      if (cashAmount > 0) {
        const createdCash = await tx.expense.create({
          data: {
            amount: new Decimal(cashAmount),
            method: PaymentMethod.CASH,
            description: dto.description ?? null,
            createdAt: now,
            groupId,
          },
        });
        records.push(createdCash as ExpenseRecord);
      }

      if (cardAmount > 0) {
        const createdCard = await tx.expense.create({
          data: {
            amount: new Decimal(cardAmount),
            method: PaymentMethod.CARD,
            description: dto.description ?? null,
            createdAt: now,
            groupId,
          },
        });
        records.push(createdCard as ExpenseRecord);
      }

      return records;
    });

    return created;
  }

  async findAll(
    page: number = PAGINATION.defaultPage,
    limit: number = PAGINATION.defaultLimit,
  ): Promise<PaginatedResponse<ExpenseRecord>> {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.expense.findMany({
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      this.prisma.expense.count(),
    ]);

    return buildPaginatedResponse(data as ExpenseRecord[], total, page, limit);
  }

  async removeGroup(groupId: string): Promise<void> {
    const before = await this.prisma.expense.count({ where: { groupId } });
    if (before === 0) throw new NotFoundException(`No existe el gasto con groupId "${groupId}"`);
    await this.prisma.expense.deleteMany({ where: { groupId } });
  }
}
