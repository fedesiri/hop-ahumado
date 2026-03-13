import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { RecipeItem } from "@prisma/client";
import { buildPaginatedResponse, PaginatedResponse, PAGINATION } from "../common/pagination";
import { PrismaService } from "../prisma/prisma.service";
import { CreateRecipeItemDto } from "./dto/create-recipe-item.dto";
import { UpdateRecipeItemDto } from "./dto/update-recipe-item.dto";

type RecipeItemWithRelations = RecipeItem & {
  product: { id: string; name: string };
  ingredient: { id: string; name: string };
};

@Injectable()
export class RecipeItemService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateRecipeItemDto) {
    if (dto.productId === dto.ingredientId) {
      throw new BadRequestException("Un producto no puede ser ingrediente de sí mismo");
    }
    await this.validateProductExists(dto.productId);
    await this.validateProductExists(dto.ingredientId);
    await this.validateNoDuplicateIngredient(dto.productId, dto.ingredientId);

    return this.prisma.recipeItem.create({
      data: {
        productId: dto.productId,
        ingredientId: dto.ingredientId,
        quantity: dto.quantity,
      },
      include: {
        product: { select: { id: true, name: true } },
        ingredient: { select: { id: true, name: true } },
      },
    });
  }

  async findAll(
    page: number = PAGINATION.defaultPage,
    limit: number = PAGINATION.defaultLimit,
    productId?: string,
  ): Promise<PaginatedResponse<RecipeItemWithRelations>> {
    const where = productId ? { productId } : undefined;
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.recipeItem.findMany({
        where,
        orderBy: [{ productId: "asc" }, { ingredientId: "asc" }],
        include: {
          product: { select: { id: true, name: true } },
          ingredient: { select: { id: true, name: true } },
        },
        skip,
        take: limit,
      }),
      this.prisma.recipeItem.count({ where }),
    ]);
    return buildPaginatedResponse(data, total, page, limit);
  }

  async findOne(id: string) {
    const item = await this.prisma.recipeItem.findUnique({
      where: { id },
      include: {
        product: true,
        ingredient: true,
      },
    });
    if (!item) {
      throw new NotFoundException(`Ítem de receta con id "${id}" no encontrado`);
    }
    return item;
  }

  async update(id: string, dto: UpdateRecipeItemDto) {
    await this.findOne(id);
    return this.prisma.recipeItem.update({
      where: { id },
      data: { ...(dto.quantity !== undefined && { quantity: dto.quantity }) },
      include: {
        product: { select: { id: true, name: true } },
        ingredient: { select: { id: true, name: true } },
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.recipeItem.delete({
      where: { id },
      include: {
        product: { select: { id: true, name: true } },
        ingredient: { select: { id: true, name: true } },
      },
    });
  }

  private async validateProductExists(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) {
      throw new BadRequestException(`Producto con id "${productId}" no encontrado`);
    }
  }

  private async validateNoDuplicateIngredient(productId: string, ingredientId: string) {
    const existing = await this.prisma.recipeItem.findFirst({
      where: { productId, ingredientId },
    });
    if (existing) {
      throw new BadRequestException("Este ingrediente ya está en la receta. Use actualizar para cambiar la cantidad.");
    }
  }
}
