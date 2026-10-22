import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { User } from "@prisma/client";
import { firebaseAdmin } from "../auth/firebase-admin";
import { buildPaginatedResponse, PaginatedResponse, PAGINATION } from "../common/pagination";
import { PrismaService } from "../prisma/prisma.service";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateUserDto) {
    const email = dto.email.toLowerCase();
    const name = dto.name;

    // Allowlist: la fila en User habilita el acceso; el usuario de Firebase lo crea Google en el primer login.
    return this.prisma.user.upsert({
      where: { email },
      update: { name },
      create: { name, email },
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

    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Usuario con id "${id}" no encontrado`);

    const nextName = dto.name !== undefined ? dto.name : existing.name;
    const nextEmail = dto.email !== undefined ? dto.email.toLowerCase() : existing.email;

    if (dto.email !== undefined && nextEmail !== existing.email) {
      await this.validateEmailUnique(nextEmail, id);
    }

    return this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.email !== undefined ? { email: nextEmail } : {}),
      },
    });
  }

  async remove(id: string) {
    const existing = await this.findOne(id);

    // Firebase: intentar borrar por email (si no existe, igualmente borramos DB).
    try {
      const auth = firebaseAdmin.auth();
      const firebaseUser = await auth.getUserByEmail(existing.email);
      await auth.deleteUser(firebaseUser.uid);
    } catch {
      // ignore (user no existe en Firebase, pero DB sí la borramos)
    }

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
