import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateProductDto } from "./dto/create-product.dto";
import { UpdateProductDto } from "./dto/update-product.dto";

@Injectable()
export class ProductService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateProductDto) {
    if (dto.categoryId) {
      await this.validateCategoryExists(dto.categoryId);
    }
    const data = this.mapCreateDtoToPrisma(dto);
    return this.prisma.product.create({ data });
  }

  async findAll(includeDeactivated = false) {
    return this.prisma.product.findMany({
      where: includeDeactivated ? undefined : { deactivationDate: null },
      orderBy: { name: "asc" },
      include: { category: true },
    });
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { category: true },
    });
    if (!product) {
      throw new NotFoundException(`Producto con id "${id}" no encontrado`);
    }
    return product;
  }

  async update(id: string, dto: UpdateProductDto) {
    await this.findOne(id);
    if (dto.categoryId !== undefined) {
      if (dto.categoryId) {
        await this.validateCategoryExists(dto.categoryId);
      }
    }
    const data = this.mapUpdateDtoToPrisma(dto);
    return this.prisma.product.update({
      where: { id },
      data,
    });
  }

  /** Soft-delete: marca el producto como desactivado (deactivationDate = ahora). */
  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.product.update({
      where: { id },
      data: { deactivationDate: new Date() },
    });
  }

  private async validateCategoryExists(categoryId: string) {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
    });
    if (!category) {
      throw new BadRequestException(`Categoría con id "${categoryId}" no encontrada`);
    }
  }

  private mapCreateDtoToPrisma(dto: CreateProductDto) {
    return {
      name: dto.name,
      description: dto.description ?? undefined,
      categoryId: dto.categoryId ?? undefined,
      sku: dto.sku ?? undefined,
      barcode: dto.barcode ?? undefined,
      stock: dto.stock ?? 0,
      deactivationDate: dto.deactivationDate ? new Date(dto.deactivationDate) : undefined,
    };
  }

  private mapUpdateDtoToPrisma(dto: UpdateProductDto) {
    const deactivationDate =
      dto.deactivationDate === null
        ? null
        : dto.deactivationDate !== undefined
          ? new Date(dto.deactivationDate)
          : undefined;
    return {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
      ...(dto.sku !== undefined && { sku: dto.sku }),
      ...(dto.barcode !== undefined && { barcode: dto.barcode }),
      ...(dto.stock !== undefined && { stock: dto.stock }),
      ...(dto.deactivationDate !== undefined && {
        deactivationDate,
      }),
    };
  }
}
