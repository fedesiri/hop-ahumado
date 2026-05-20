import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class BusinessLineService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.businessLine.findMany({ orderBy: { name: "asc" } });
  }
}
