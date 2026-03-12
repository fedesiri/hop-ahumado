import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { User } from "@prisma/client";
import { buildPaginatedResponse, PaginatedResponse, PAGINATION } from "../common/pagination";
import { PrismaService } from "../prisma/prisma.service";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateUserDto) {
    const email = dto.email.toLowerCase();
    await this.validateEmailUnique(email);
    return this.prisma.user.create({
      data: { name: dto.name, email },
    });
  }

  async findAll(
    page: number = PAGINATION.defaultPage,
    limit: number = PAGINATION.defaultLimit,
  ): Promise<PaginatedResponse<User>> {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        orderBy: { name: "asc" },
        skip,
        take: limit,
      }),
      this.prisma.user.count(),
    ]);
    return buildPaginatedResponse(data, total, page, limit);
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });
    if (!user) {
      throw new NotFoundException(`Usuario con id "${id}" no encontrado`);
    }
    return user;
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.findOne(id);
    const data: { name?: string; email?: string } = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.email !== undefined) {
      data.email = dto.email.toLowerCase();
      await this.validateEmailUnique(data.email, id);
    }
    return this.prisma.user.update({
      where: { id },
      data,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.user.delete({
      where: { id },
    });
  }

  private async validateEmailUnique(email: string, excludeUserId?: string) {
    const existing = await this.prisma.user.findUnique({
      where: { email },
    });
    if (existing && existing.id !== excludeUserId) {
      throw new ConflictException(`Ya existe un usuario con el email "${email}"`);
    }
  }
}
