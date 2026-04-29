/**
 * Crea CustomerProfile para cada cliente que ya tiene órdenes pero aún sin perfil.
 * Idempotente: los que ya tienen perfil se omiten.
 * Uso: desde apps/api: pnpm run backfill:crm-profiles
 */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function run() {
  const distinct = await prisma.order.findMany({
    where: { customerId: { not: null } },
    distinct: ["customerId"],
    select: { customerId: true },
  });
  const ids = [...new Set(distinct.map((r) => r.customerId).filter(Boolean))];
  let created = 0;
  for (const customerId of ids) {
    const existing = await prisma.customerProfile.findUnique({ where: { customerId } });
    if (existing) continue;
    await prisma.customerProfile.create({
      data: { customerId },
    });
    created++;
  }
  console.log(`Clientes con al menos una orden (distintos): ${ids.length}`);
  console.log(`Perfiles nuevos creados: ${created}`);
}

run()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
