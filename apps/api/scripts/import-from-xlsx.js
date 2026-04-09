/**
 * Importa desde el Excel: categorías, productos, clientes, precios (Mayorista/Minorista/Fábrica), costos, stock y movimientos.
 * El stock del Excel se consolida en la ubicación predeterminada "San Luis" (StockBalance + campo product.stock).
 * Uso: node scripts/import-from-xlsx.js "ruta/al/archivo.xlsx"
 * Ejecutar desde apps/api (pnpm run import:xlsx "ruta")
 */
const XLSX = require("xlsx");
const { PrismaClient, StockMovementType } = require("@prisma/client");

const prisma = new PrismaClient();

function excelDateToJs(serial) {
  if (serial == null || serial === "" || typeof serial !== "number") return null;
  const utc = (serial - 25569) * 86400 * 1000;
  return new Date(utc);
}

function num(val) {
  if (val === "" || val == null) return 0;
  const n = Number(val);
  return Number.isFinite(n) ? n : 0;
}

function str(val) {
  if (val == null) return "";
  return String(val).trim();
}

/** Descarta códigos que son basura del Excel (rangos "de X a Y", etc.). Solo SKU tipo XXX-05, GOLD-10, etc. */
function isValidProductCode(codigo) {
  if (!codigo) return false;
  if (/ a /i.test(codigo)) return false;
  if (/^de\s*\d/i.test(codigo)) return false;
  return /^[A-Za-z0-9]+-\d+$/.test(codigo);
}

const DEFAULT_LOCATION_NAME = "San Luis";

/** Crea o reutiliza la ubicación "San Luis" y la marca como predeterminada (demás isDefault = false). */
async function ensureDefaultLocationSanLuis() {
  let loc = await prisma.stockLocation.findFirst({
    where: { name: DEFAULT_LOCATION_NAME },
  });
  await prisma.stockLocation.updateMany({ data: { isDefault: false } });
  if (loc) {
    loc = await prisma.stockLocation.update({
      where: { id: loc.id },
      data: { isDefault: true },
    });
  } else {
    loc = await prisma.stockLocation.create({
      data: { name: DEFAULT_LOCATION_NAME, isDefault: true },
    });
  }
  return loc;
}

/**
 * Stock del Excel = saldo total en la ubicación predeterminada (consolida en San Luis; borra otros saldos del producto).
 */
async function syncProductStockToDefaultLocation(productId, quantity, locationId) {
  const q = Math.max(0, Math.floor(Number(quantity) || 0));
  await prisma.$transaction(async (tx) => {
    await tx.stockBalance.deleteMany({ where: { productId } });
    if (q > 0) {
      await tx.stockBalance.create({
        data: { productId, locationId, quantity: q },
      });
    }
    await tx.product.update({ where: { id: productId }, data: { stock: q } });
  });
}

async function run(filePath) {
  const workbook = XLSX.readFile(filePath);

  const catalogSheet = workbook.Sheets["Catalogo de precios"];
  const stockSheet = workbook.Sheets["Stock General "];
  const entradasSheet = workbook.Sheets["Entradas"];
  const salidasSheet = workbook.Sheets["Salidas"];

  if (!catalogSheet || !stockSheet) {
    throw new Error("Faltan hojas 'Catalogo de precios' o 'Stock General ' en el Excel");
  }

  const defaultLocation = await ensureDefaultLocationSanLuis();
  const defaultLocationId = defaultLocation.id;
  console.log(`Ubicación predeterminada: "${defaultLocation.name}" (${defaultLocationId})`);

  const catalogData = XLSX.utils.sheet_to_json(catalogSheet, { header: 1, defval: "" });
  const stockData = XLSX.utils.sheet_to_json(stockSheet, { header: 1, defval: "" });
  const entradasData = entradasSheet ? XLSX.utils.sheet_to_json(entradasSheet, { header: 1, defval: "" }) : [];
  const salidasData = salidasSheet ? XLSX.utils.sheet_to_json(salidasSheet, { header: 1, defval: "" }) : [];

  // --- Catálogo: fila 0 = headers (Join, Código, Estilo, Producto, Presentación, Condición, Precio por botella, Precio Por caja)
  const catalogRows = [];
  for (let i = 1; i < catalogData.length; i++) {
    const r = catalogData[i];
    const codigo = str(r[1]);
    const estilo = str(r[2]);
    const producto = str(r[3]);
    const presentacion = str(r[4]);
    const condicion = str(r[5]);
    const precioBotella = num(r[6]);
    if (!codigo || !isValidProductCode(codigo)) continue;
    catalogRows.push({
      codigo,
      estilo,
      producto,
      presentacion,
      condicion: condicion || "Minorista",
      precioBotella,
    });
  }

  // --- Stock General: fila 2 = headers, 3+ = datos. 0=Código, 1=Descripción, 4=Stock actual
  const stockRows = [];
  for (let i = 3; i < stockData.length; i++) {
    const r = stockData[i];
    const codigo = str(r[0]);
    const descripcion = str(r[1]);
    const stockActual = Math.max(0, Math.floor(num(r[4])));
    if (!codigo || !isValidProductCode(codigo)) continue;
    stockRows.push({ codigo, descripcion, stockActual });
  }

  // --- Entradas: fila 3 = headers, 4+ = datos. 0=Fecha, 1=Código, 2=Nombre, 3=Ingresos, 4=Costo
  const entradasRows = [];
  for (let i = 4; i < entradasData.length; i++) {
    const r = entradasData[i];
    const fecha = excelDateToJs(num(r[0]) || r[0]);
    const codigo = str(r[1]);
    const ingresos = Math.floor(num(r[3]));
    const costo = num(r[4]);
    if (!codigo || !fecha || !isValidProductCode(codigo)) continue;
    entradasRows.push({ fecha, codigo, ingresos, costo });
  }

  // --- Salidas: fila 3 = headers, 4+ = datos. 0=Fecha, 1=Cliente, 2=Código, 4=Salidas
  const salidasRows = [];
  const clientesSet = new Set();
  for (let i = 4; i < salidasData.length; i++) {
    const r = salidasData[i];
    const fecha = excelDateToJs(num(r[0]) || r[0]);
    const cliente = str(r[1]);
    const codigo = str(r[2]);
    const salidas = Math.floor(num(r[4]));
    if (cliente) clientesSet.add(cliente);
    if (!codigo || !fecha || !isValidProductCode(codigo)) continue;
    salidasRows.push({ fecha, cliente, codigo, salidas });
  }

  // 1) Categorías: no se cargan; las creás vos (ej. Carne, Cerveza).

  // 2) Productos (por código; nombre desde Stock General descripción o catálogo)
  const productByCode = {};
  const descripcionByCode = Object.fromEntries(stockRows.map((s) => [s.codigo, s.descripcion]));
  const stockByCode = Object.fromEntries(stockRows.map((s) => [s.codigo, s.stockActual]));

  const codigosSet = new Set([...catalogRows.map((x) => x.codigo), ...stockRows.map((x) => x.codigo)]);
  for (const codigo of codigosSet) {
    const catRow = catalogRows.find((r) => r.codigo === codigo);
    const nombre =
      descripcionByCode[codigo] ||
      (catRow ? `${catRow.estilo} - ${catRow.producto} ${catRow.presentacion}`.trim() : codigo);
    const product = await prisma.product.upsert({
      where: { sku: codigo },
      create: {
        name: nombre,
        sku: codigo,
        stock: 0,
      },
      update: {
        name: nombre,
      },
    });
    productByCode[codigo] = product.id;
    await syncProductStockToDefaultLocation(product.id, stockByCode[codigo] ?? 0, defaultLocationId);
  }
  console.log("Productos:", Object.keys(productByCode).length);

  // 3) Clientes (únicos desde Salidas)
  const customerByName = {};
  for (const nombre of clientesSet) {
    if (!nombre) continue;
    let c = await prisma.customer.findFirst({ where: { name: nombre } });
    if (!c) c = await prisma.customer.create({ data: { name: nombre } });
    customerByName[nombre] = c.id;
  }
  console.log("Clientes:", Object.keys(customerByName).length);

  // 4) Precios: tres por producto (Mayorista, Minorista, Fábrica) desde Catálogo
  const condicionToDescription = (c) => {
    const t = (c || "").toLowerCase();
    if (t.includes("mayorista")) return "Mayorista";
    if (t.includes("minorista")) return "Minorista";
    if (t.includes("fabrica") || t.includes("fábrica")) return "Fábrica";
    return c || "Minorista";
  };
  const priceKeys = new Set();
  for (const r of catalogRows) {
    const productId = productByCode[r.codigo];
    if (!productId || r.precioBotella <= 0) continue;
    const desc = condicionToDescription(r.condicion);
    const key = `${productId}:${desc}`;
    if (priceKeys.has(key)) continue;
    priceKeys.add(key);
    const existing = await prisma.price.findFirst({
      where: { productId, description: desc },
    });
    if (existing) {
      await prisma.price.update({
        where: { id: existing.id },
        data: { value: r.precioBotella },
      });
    } else {
      await prisma.price.create({
        data: { productId, value: r.precioBotella, description: desc },
      });
    }
  }
  console.log("Precios (Mayorista/Minorista/Fábrica):", priceKeys.size);

  // 5) Costos: desde Entradas, último costo por producto
  const costByProduct = {};
  for (const r of entradasRows) {
    if (r.costo <= 0) continue;
    const productId = productByCode[r.codigo];
    if (!productId) continue;
    costByProduct[productId] = r.costo;
  }
  for (const [productId, value] of Object.entries(costByProduct)) {
    const existing = await prisma.cost.findFirst({
      where: { productId },
      orderBy: { createdAt: "desc" },
    });
    if (existing) {
      await prisma.cost.update({ where: { id: existing.id }, data: { value } });
    } else {
      await prisma.cost.create({ data: { productId, value } });
    }
  }
  console.log("Costos:", Object.keys(costByProduct).length);

  // 6) Stock en ubicación predeterminada (paso 2). 7) Movimientos: Entradas → IN, Salidas → OUT
  let entradasCreados = 0;
  let entradasOmitidos = 0;
  for (const r of entradasRows) {
    const productId = productByCode[r.codigo];
    if (!productId || r.ingresos <= 0) continue;
    const fechaStr = r.fecha ? r.fecha.toISOString().slice(0, 10) : "";
    const reason = `Importación Excel - Entrada|${fechaStr}|${r.codigo}|${r.ingresos}`;
    const existente = await prisma.stockMovement.findFirst({
      where: { reason, type: StockMovementType.IN },
    });
    if (existente) {
      entradasOmitidos++;
      continue;
    }
    await prisma.stockMovement.create({
      data: {
        productId,
        quantity: r.ingresos,
        type: StockMovementType.IN,
        reason,
        createdAt: r.fecha,
        locationId: defaultLocationId,
      },
    });
    entradasCreados++;
  }
  let salidasCreados = 0;
  let salidasOmitidos = 0;
  for (const r of salidasRows) {
    const productId = productByCode[r.codigo];
    if (!productId || r.salidas <= 0) continue;
    const fechaStr = r.fecha ? r.fecha.toISOString().slice(0, 10) : "";
    const reason = `Importación Excel - Salida|${fechaStr}|${r.codigo}|${r.salidas}`;
    const existente = await prisma.stockMovement.findFirst({
      where: { reason, type: StockMovementType.OUT },
    });
    if (existente) {
      salidasOmitidos++;
      continue;
    }
    await prisma.stockMovement.create({
      data: {
        productId,
        quantity: r.salidas,
        type: StockMovementType.OUT,
        reason,
        createdAt: r.fecha,
        locationId: defaultLocationId,
      },
    });
    salidasCreados++;
  }
  console.log(
    "Movimientos: " +
      (entradasCreados + salidasCreados) +
      " nuevos, " +
      (entradasOmitidos + salidasOmitidos) +
      " ya existían (omitidos).",
  );
  console.log("Listo.");
}

const path = process.argv[2] || "C:\\Users\\Federico Siri\\Downloads\\Plantilla de control de inventario 🍻.xlsx";
run(path)
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
