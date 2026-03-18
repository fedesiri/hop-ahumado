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

    // Si el usuario existe en Firebase, solo actualizamos su displayName (password no lo tocamos).
    // Si no existe, lo creamos con password.
    const auth = firebaseAdmin.auth();
    const name = dto.name;

    try {
      const existingFirebaseUser = (await auth.getUserByEmail(email)) as any;
      await auth.updateUser(existingFirebaseUser.uid, { displayName: name });
    } catch (e: any) {
      const code = e?.code ?? e?.errorInfo?.code;
      if (code === "auth/user-not-found") {
        await auth.createUser({
          email,
          password: dto.password,
          displayName: name,
        });
      } else {
        throw e;
      }
    }

    // DB: creamos o actualizamos el registro por email
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

    // Firebase: actualizar por UID buscando por email (no guardamos uid en DB).
    const auth = firebaseAdmin.auth();
    const firebaseUser = await auth.getUserByEmail(existing.email);
    const updatePayload: any = {};
    if (nextName !== existing.name) updatePayload.displayName = nextName;
    if (nextEmail !== existing.email) updatePayload.email = nextEmail;

    if (Object.keys(updatePayload).length > 0) {
      await auth.updateUser(firebaseUser.uid, updatePayload);
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
