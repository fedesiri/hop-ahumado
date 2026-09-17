import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { buildPaginatedResponse, PaginatedResponse, PAGINATION } from "../common/pagination";
import { PRICE_LIST_TYPES, type PriceListType } from "../common/price-list-type";
import { OperationalParametersService } from "../operational-parameters/operational-parameters.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreateRecipeCostProfileDto } from "./dto/create-recipe-cost-profile.dto";
import { UpdateRecipeCostProfileDto } from "./dto/update-recipe-cost-profile.dto";

const CHANNELS = PRICE_LIST_TYPES.filter((c): c is Exclude<PriceListType, "fabrica"> => c !== "fabrica");

type CostingResult = {
  productId: string;
  name: string;
  materialCost: number;
  /** Solo ingredientes comprados directos (excluye el costo de subrecetas) — usado por Plan de Producción. */
  ownMaterialCost: number;
  costWithWaste: number;
  laborCost: number;
  overheadCost: number;
  costPerUnit: number;
  rindeCalculado: number | null;
  rindeUsado: number;
  perBatch: {
    materialCost: number;
    costWithWaste: number;
    laborCost: number;
    overheadCost: number;
    totalCost: number;
  };
  alerts: string[];
};

@Injectable()
export class RecipeCostProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly operationalParametersService: OperationalParametersService,
  ) {}

  async create(dto: CreateRecipeCostProfileDto) {
    const product = await this.prisma.product.findUnique({ where: { id: dto.productId } });
    if (!product) throw new BadRequestException(`Producto con id "${dto.productId}" no encontrado`);
    const existing = await this.prisma.recipeCostProfile.findUnique({ where: { productId: dto.productId } });
    if (existing) throw new BadRequestException("Este producto ya tiene un perfil de costeo de receta");

    await this.prisma.recipeCostProfile.create({
      data: {
        productId: dto.productId,
        recipeType: dto.recipeType,
        saleUnitLabel: dto.saleUnitLabel,
        unitsPerPack: dto.unitsPerPack,
        packName: dto.packName,
        mainIngredientId: dto.mainIngredientId,
        mainIngredientQty: dto.mainIngredientQty,
        cookingLossPct: dto.cookingLossPct ?? 0,
        kgPerSaleUnit: dto.kgPerSaleUnit,
        yieldManual: dto.yieldManual,
        wastePct: dto.wastePct ?? 0,
        laborHoursPerBatch: dto.laborHoursPerBatch ?? 0,
        marginRetailPct: dto.marginRetailPct,
        marginWholesalePct: dto.marginWholesalePct,
        marginCateringPct: dto.marginCateringPct,
        active: dto.active ?? true,
        notes: dto.notes,
      },
    });
    return this.findOne(dto.productId);
  }

  async findAll(
    page: number = PAGINATION.defaultPage,
    limit: number = PAGINATION.defaultLimit,
    businessLineId?: string,
    search?: string,
    includeDeactivated = false,
  ): Promise<PaginatedResponse<Record<string, unknown>>> {
    const where: Prisma.RecipeCostProfileWhereInput = {};
    const productFilter: Prisma.ProductWhereInput = {};
    if (businessLineId) productFilter.businessLineId = businessLineId;
    if (!includeDeactivated) productFilter.deactivationDate = null;
    const trimmed = search?.trim();
    if (trimmed) productFilter.name = { contains: trimmed, mode: "insensitive" };
    if (Object.keys(productFilter).length > 0) where.product = productFilter;

    const skip = (page - 1) * limit;
    const [rows, total] = await Promise.all([
      this.prisma.recipeCostProfile.findMany({
        where,
        orderBy: { product: { name: "asc" } },
        include: { product: { select: { id: true, name: true, unit: true, deactivationDate: true } } },
        skip,
        take: limit,
      }),
      this.prisma.recipeCostProfile.count({ where }),
    ]);

    const data = await Promise.all(
      rows.map(async (row) => {
        const costing = await this.computeCosting(row.productId);
        return { ...row, product: row.product, costPerUnit: costing.costPerUnit, alerts: costing.alerts };
      }),
    );
    return buildPaginatedResponse(data, total, page, limit);
  }

  async findOne(productId: string) {
    const profile = await this.prisma.recipeCostProfile.findUnique({
      where: { productId },
      include: { product: true, mainIngredient: { select: { id: true, name: true, unit: true } } },
    });
    if (!profile) throw new NotFoundException(`Perfil de receta para producto "${productId}" no encontrado`);
    return profile;
  }

  async update(productId: string, dto: UpdateRecipeCostProfileDto) {
    await this.findOne(productId);
    await this.prisma.recipeCostProfile.update({
      where: { productId },
      data: {
        ...(dto.recipeType !== undefined && { recipeType: dto.recipeType }),
        ...(dto.saleUnitLabel !== undefined && { saleUnitLabel: dto.saleUnitLabel }),
        ...(dto.unitsPerPack !== undefined && { unitsPerPack: dto.unitsPerPack }),
        ...(dto.packName !== undefined && { packName: dto.packName }),
        ...(dto.mainIngredientId !== undefined && { mainIngredientId: dto.mainIngredientId }),
        ...(dto.mainIngredientQty !== undefined && { mainIngredientQty: dto.mainIngredientQty }),
        ...(dto.cookingLossPct !== undefined && { cookingLossPct: dto.cookingLossPct }),
        ...(dto.kgPerSaleUnit !== undefined && { kgPerSaleUnit: dto.kgPerSaleUnit }),
        ...(dto.yieldManual !== undefined && { yieldManual: dto.yieldManual }),
        ...(dto.wastePct !== undefined && { wastePct: dto.wastePct }),
        ...(dto.laborHoursPerBatch !== undefined && { laborHoursPerBatch: dto.laborHoursPerBatch }),
        ...(dto.marginRetailPct !== undefined && { marginRetailPct: dto.marginRetailPct }),
        ...(dto.marginWholesalePct !== undefined && { marginWholesalePct: dto.marginWholesalePct }),
        ...(dto.marginCateringPct !== undefined && { marginCateringPct: dto.marginCateringPct }),
        ...(dto.active !== undefined && { active: dto.active }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
    });
    return this.findOne(productId);
  }

  async remove(productId: string) {
    await this.findOne(productId);
    await this.prisma.recipeCostProfile.delete({ where: { productId } });
    return { success: true };
  }

  /** Resuelve el costo por unidad de cualquier producto: receta (recursivo) o ingrediente comprado (Cost). */
  private async resolveUnitCost(productId: string, visiting: Set<string>, alerts: string[]): Promise<number> {
    const profile = await this.prisma.recipeCostProfile.findUnique({ where: { productId } });
    if (profile) {
      const costing = await this.computeCostingInternal(productId, visiting, alerts);
      return costing.costPerUnit;
    }
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      alerts.push(`Ingrediente con id "${productId}" no existe`);
      return 0;
    }
    if (product.deactivationDate) {
      alerts.push(`Ingrediente "${product.name}" está desactivado`);
    }
    const cost = await this.prisma.cost.findFirst({
      where: { productId, deactivatedAt: null },
      orderBy: { createdAt: "desc" },
    });
    if (!cost) {
      alerts.push(`Ingrediente "${product.name}" no tiene costo cargado`);
      return 0;
    }
    return Number(cost.value);
  }

  async computeCosting(productId: string): Promise<CostingResult> {
    return this.computeCostingInternal(productId, new Set<string>(), []);
  }

  private async computeCostingInternal(
    productId: string,
    visiting: Set<string>,
    alerts: string[],
  ): Promise<CostingResult> {
    const zero = (name: string): CostingResult => ({
      productId,
      name,
      materialCost: 0,
      ownMaterialCost: 0,
      costWithWaste: 0,
      laborCost: 0,
      overheadCost: 0,
      costPerUnit: 0,
      rindeCalculado: null,
      rindeUsado: 1,
      perBatch: { materialCost: 0, costWithWaste: 0, laborCost: 0, overheadCost: 0, totalCost: 0 },
      alerts,
    });

    if (visiting.has(productId)) {
      alerts.push(`Ciclo de subreceta detectado en producto "${productId}"`);
      return zero(productId);
    }

    const profile = await this.prisma.recipeCostProfile.findUnique({
      where: { productId },
      include: { product: true },
    });
    if (!profile) {
      alerts.push(`Producto "${productId}" no tiene perfil de receta`);
      return zero(productId);
    }

    visiting.add(productId);

    const recipeItems = await this.prisma.recipeItem.findMany({
      where: { productId },
      include: { ingredient: { select: { id: true, name: true } } },
    });

    const subrecipeIngredientIds = new Set(
      (
        await this.prisma.recipeCostProfile.findMany({
          where: { productId: { in: recipeItems.map((i) => i.ingredientId) } },
          select: { productId: true },
        })
      ).map((r) => r.productId),
    );

    let materialCost = 0;
    let ownMaterialCost = 0;
    for (const item of recipeItems) {
      const unitCost = await this.resolveUnitCost(item.ingredientId, visiting, alerts);
      materialCost += item.quantity * unitCost;
      if (!subrecipeIngredientIds.has(item.ingredientId)) {
        ownMaterialCost += item.quantity * unitCost;
      }
    }

    visiting.delete(productId);

    let rindeCalculado: number | null = null;
    if (profile.mainIngredientQty != null && profile.kgPerSaleUnit != null && profile.kgPerSaleUnit > 0) {
      rindeCalculado = (profile.mainIngredientQty * (1 - profile.cookingLossPct)) / profile.kgPerSaleUnit;
    }
    let rindeUsado = profile.yieldManual ?? rindeCalculado ?? 0;
    if (!rindeUsado || rindeUsado <= 0) {
      alerts.push(`Receta "${profile.product.name}": no se pudo determinar el rinde (cargá rinde manual o insumo principal)`);
      rindeUsado = 1;
    }

    const rates = await this.operationalParametersService.getRates(profile.product.businessLineId);
    const costWithWaste = materialCost * (1 + profile.wastePct);
    const laborCost = (profile.laborHoursPerBatch * rates.laborRatePerHour) / rindeUsado;
    const overheadCost = (profile.laborHoursPerBatch * rates.fixedCostRatePerHour) / rindeUsado;
    const costPerUnit = costWithWaste + laborCost + overheadCost;

    return {
      productId,
      name: profile.product.name,
      materialCost,
      ownMaterialCost,
      costWithWaste,
      laborCost,
      overheadCost,
      costPerUnit,
      rindeCalculado,
      rindeUsado,
      perBatch: {
        materialCost: materialCost * rindeUsado,
        costWithWaste: costWithWaste * rindeUsado,
        laborCost: laborCost * rindeUsado,
        overheadCost: overheadCost * rindeUsado,
        totalCost: costPerUnit * rindeUsado,
      },
      alerts,
    };
  }

  async computePricing(productId: string) {
    const profile = await this.prisma.recipeCostProfile.findUnique({ where: { productId }, include: { product: true } });
    if (!profile) throw new NotFoundException(`Perfil de receta para producto "${productId}" no encontrado`);

    const costing = await this.computeCosting(productId);
    const commissions = await this.operationalParametersService.getChannelCommissionsMap(profile.product.businessLineId);
    const margins: Record<(typeof CHANNELS)[number], number | null> = {
      minorista: profile.marginRetailPct,
      mayorista: profile.marginWholesalePct,
      catering: profile.marginCateringPct,
    };

    const channels = await Promise.all(
      CHANNELS.map(async (channel) => {
        const marginPct = margins[channel];
        const commissionPct = commissions[channel] ?? 0;
        const calculatedPrice =
          marginPct != null ? (costing.costPerUnit * (1 + marginPct)) / (1 - commissionPct) : null;
        const overrideRow = await this.prisma.price.findFirst({
          where: { productId, deactivatedAt: null, description: { equals: channel, mode: "insensitive" } },
          orderBy: { createdAt: "desc" },
        });
        const overridePrice = overrideRow ? Number(overrideRow.value) : null;
        return {
          channel,
          marginPct,
          commissionPct,
          calculatedPrice,
          overridePrice,
          finalPrice: overridePrice ?? calculatedPrice,
        };
      }),
    );

    return { productId, costPerUnit: costing.costPerUnit, channels };
  }
}
