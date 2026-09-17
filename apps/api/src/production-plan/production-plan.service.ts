import { BadRequestException, Injectable } from "@nestjs/common";
import { OperationalParametersService } from "../operational-parameters/operational-parameters.service";
import { PrismaService } from "../prisma/prisma.service";
import { RecipeCostProfileService } from "../recipe-cost-profile/recipe-cost-profile.service";
import { UpsertProductionPlanDto } from "./dto/upsert-production-plan.dto";
import { UpsertProductionPlanLineDto } from "./dto/upsert-production-plan-line.dto";

@Injectable()
export class ProductionPlanService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recipeCostProfileService: RecipeCostProfileService,
    private readonly operationalParametersService: OperationalParametersService,
  ) {}

  private async getOrCreate(businessLineId: string, month: string) {
    const existing = await this.prisma.productionPlan.findUnique({ where: { businessLineId_month: { businessLineId, month } } });
    if (existing) return existing;
    const businessLine = await this.prisma.businessLine.findUnique({ where: { id: businessLineId } });
    if (!businessLine) throw new BadRequestException(`Línea de negocio con id "${businessLineId}" no encontrada`);
    return this.prisma.productionPlan.create({ data: { businessLineId, month } });
  }

  async getFull(businessLineId: string, month: string) {
    const plan = await this.getOrCreate(businessLineId, month);
    const lines = await this.prisma.productionPlanLine.findMany({
      where: { planId: plan.id },
      include: { product: { select: { id: true, name: true } } },
      orderBy: { product: { name: "asc" } },
    });
    return { id: plan.id, businessLineId, month, notes: plan.notes, lines };
  }

  async updateNotes(dto: UpsertProductionPlanDto) {
    const plan = await this.getOrCreate(dto.businessLineId, dto.month);
    await this.prisma.productionPlan.update({ where: { id: plan.id }, data: { notes: dto.notes } });
    return this.getFull(dto.businessLineId, dto.month);
  }

  async upsertLine(productId: string, dto: UpsertProductionPlanLineDto) {
    const plan = await this.getOrCreate(dto.businessLineId, dto.month);
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new BadRequestException(`Producto con id "${productId}" no encontrado`);

    if (dto.batchesPerMonth <= 0) {
      await this.prisma.productionPlanLine.deleteMany({ where: { planId: plan.id, productId } });
    } else {
      await this.prisma.productionPlanLine.upsert({
        where: { planId_productId: { planId: plan.id, productId } },
        create: { planId: plan.id, productId, batchesPerMonth: dto.batchesPerMonth },
        update: { batchesPerMonth: dto.batchesPerMonth },
      });
    }
    return this.getFull(dto.businessLineId, dto.month);
  }

  async computeSummary(businessLineId: string, month: string) {
    const plan = await this.getOrCreate(businessLineId, month);
    const lines = await this.prisma.productionPlanLine.findMany({
      where: { planId: plan.id },
      include: { product: { select: { id: true, name: true } } },
    });

    const lineResults = await Promise.all(
      lines.map(async (line) => {
        const [profile, costing, pricing] = await Promise.all([
          this.prisma.recipeCostProfile.findUnique({ where: { productId: line.productId } }),
          this.recipeCostProfileService.computeCosting(line.productId),
          this.recipeCostProfileService.computePricing(line.productId),
        ]);
        const laborHoursPerBatch = profile?.laborHoursPerBatch ?? 0;
        const horasHombreTotales = line.batchesPerMonth * laborHoursPerBatch;
        const unidadesProducidas = line.batchesPerMonth * costing.rindeUsado;
        const materiaPrimaPropia = line.batchesPerMonth * costing.ownMaterialCost * costing.rindeUsado;
        const precioMinorista = pricing.channels.find((c) => c.channel === "minorista")?.finalPrice ?? 0;
        const ingresoEstimado = unidadesProducidas * precioMinorista;
        const margenContribucion = ingresoEstimado - materiaPrimaPropia;
        return {
          productId: line.productId,
          productName: line.product.name,
          recipeType: profile?.recipeType ?? null,
          batchesPerMonth: line.batchesPerMonth,
          horasHombreTotales,
          unidadesProducidas,
          materiaPrimaPropia,
          ingresoEstimado,
          margenContribucion,
        };
      }),
    );

    const rates = await this.operationalParametersService.getRates(businessLineId);
    const horasHombreDelPlan = lineResults.reduce((sum, l) => sum + l.horasHombreTotales, 0);
    const ingresoEstimadoTotal = lineResults.reduce((sum, l) => sum + l.ingresoEstimado, 0);
    const margenContribucionTotal = lineResults.reduce((sum, l) => sum + l.margenContribucion, 0);
    const estructuraMensual = rates.monthlyStructureTotal;
    const estructuraAbsorbida = horasHombreDelPlan * rates.totalOperativeRatePerHour;
    const margenContribucionPct = ingresoEstimadoTotal > 0 ? margenContribucionTotal / ingresoEstimadoTotal : 0;

    return {
      businessLineId,
      month,
      lines: lineResults,
      horasHombreDelPlan,
      capacidadHorasMes: rates.capacityHoursPerMonth,
      pctCapacidadUsada: rates.capacityHoursPerMonth > 0 ? horasHombreDelPlan / rates.capacityHoursPerMonth : 0,
      estructuraMensual,
      estructuraAbsorbida,
      estructuraNoRecuperada: estructuraMensual - estructuraAbsorbida,
      ingresoEstimadoTotal,
      margenContribucionTotal,
      margenContribucionPct,
      ingresoNecesarioEquilibrio: margenContribucionPct > 0 ? estructuraMensual / margenContribucionPct : null,
      resultadoEstimado: margenContribucionTotal - estructuraMensual,
    };
  }
}
