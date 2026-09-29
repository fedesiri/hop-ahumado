import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { COSTING_INPUTS_CHANGED } from "../common/costing-events";
import { CostService } from "../cost/cost.service";
import { PrismaService } from "../prisma/prisma.service";
import { RecipeCostProfileService } from "./recipe-cost-profile.service";

/**
 * Guarda en Cost el costo por unidad calculado de cada receta, para que stock, productos
 * y pedido sugerido (que leen Cost) vean el mismo valor que la pantalla Recetas.
 */
@Injectable()
export class RecipeCostSyncService implements OnApplicationBootstrap {
  private readonly logger = new Logger(RecipeCostSyncService.name);
  private queue: Promise<void> = Promise.resolve();

  constructor(
    private readonly prisma: PrismaService,
    private readonly recipeCostProfileService: RecipeCostProfileService,
    private readonly costService: CostService,
  ) {}

  onApplicationBootstrap() {
    void this.syncAll();
  }

  @OnEvent(COSTING_INPUTS_CHANGED)
  handleCostingInputsChanged() {
    return this.syncAll();
  }

  /** Corridas en serie: dos en paralelo podrían crear dos Cost activos para la misma receta. */
  syncAll(): Promise<void> {
    const run = this.queue.then(() => this.runSync());
    this.queue = run.catch(() => undefined);
    return run.catch((error) => {
      this.logger.error(`Error sincronizando costos de recetas: ${error instanceof Error ? error.message : error}`);
    });
  }

  private async runSync() {
    const profiles = await this.prisma.recipeCostProfile.findMany({
      where: { product: { deactivationDate: null } },
      select: { productId: true },
    });
    for (const { productId } of profiles) {
      const { costPerUnit } = await this.recipeCostProfileService.computeCosting(productId);
      const value = Math.round(costPerUnit * 100) / 100;
      // Sin costo calculable (receta sin ítems o sin costos cargados) no se pisa nada con 0.
      if (!(value > 0)) continue;
      const current = await this.prisma.cost.findFirst({
        where: { productId, deactivatedAt: null },
        orderBy: { createdAt: "desc" },
      });
      if (current && Math.abs(Number(current.value) - value) < 0.005) continue;
      if (current) {
        await this.costService.replace(current.id, { value }, { fromRecipeSync: true });
      } else {
        await this.costService.create({ productId, value }, { fromRecipeSync: true });
      }
    }
  }
}
