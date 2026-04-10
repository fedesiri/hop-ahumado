/**
 * Importa desde el Excel: productos, clientes, precios (Mayorista/Minorista/Fábrica), costos, stock, movimientos
 * y órdenes históricas desde Salidas (ventas reales). No importa Caja Diaria ni crea Expense desde el Excel.
 * Las órdenes son solo registro para métricas: no descuentan stock (el stock sigue viniendo de Stock General + sync).
 * Uso: node scripts/import-from-xlsx.js "ruta/al/archivo.xlsx"
 * Ejecutar desde apps/api (pnpm run import:xlsx "ruta")
 */
const XLSX = require("xlsx");
const { PrismaClient, PaymentMethod, StockMovementType } = require("@prisma/client");

const prisma = new PrismaClient();

function excelDateToJs(val) {
  if (val == null || val === "") return null;
  if (val instanceof Date) return val;
  const n = Number(val);
  if (Number.isFinite(n) && n > 0) {
    const utc = (n - 25569) * 86400 * 1000;
    return new Date(utc);
  }
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

function num(val) {
  if (val === "" || val == null) return 0;
  const n = Number(String(val).replace(",", "."));
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

/** Texto en columna Cliente de Salidas: no es venta a cliente (órdenes / clientes normales lo ignoran). */
function isGastoAjusteCliente(name) {
  const u = str(name).toUpperCase();
  return u.includes("GASTO") || u.includes("AJUSTE");
}

/** Order/Payment solo admiten CASH | CARD en Prisma. */
function mapPaymentMethod(raw) {
  const v = str(raw).toLowerCase();
  if (!v) return PaymentMethod.CASH;
  if (/efectivo|^ef\.?$|cash/i.test(v)) return PaymentMethod.CASH;
  if (/tarjeta|card|cr[eé]dito|d[eé]bito|visa|master/i.test(v)) return PaymentMethod.CARD;
  return PaymentMethod.CARD;
}

function dateKey(d) {
  if (!d) return "";
  return d.toISOString().slice(0, 10);
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

  // --- Salidas: fila 3 = headers, 4+ = datos.
  // 0=Fecha, 1=Cliente, 2=Código, 3=Descripción, 4=Salidas, 5=Condición, 6=Método de Pago, 7=Precio Unitario, 8=Venta total
  const salidasParsed = [];
  for (let i = 4; i < salidasData.length; i++) {
    const r = salidasData[i];
    const fecha = excelDateToJs(num(r[0]) || r[0]);
    const cliente = str(r[1]);
    const codigo = str(r[2]);
    const descripcion = str(r[3]);
    const salidas = Math.floor(num(r[4]));
    const metodo = str(r[6]);
    const precioUnit = num(r[7]);
    const ventaTotal = num(r[8]);
    if (!fecha && !cliente && !codigo) continue;
    salidasParsed.push({ fecha, cliente, codigo, descripcion, salidas, metodo, precioUnit, ventaTotal });
  }

  const salidasRows = salidasParsed.filter(
    (row) => row.codigo && row.fecha && isValidProductCode(row.codigo) && row.salidas > 0,
  );

  const clientesSet = new Set();
  for (const row of salidasParsed) {
    if (!row.cliente || isGastoAjusteCliente(row.cliente)) continue;
    clientesSet.add(row.cliente);
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

  // 6) Órdenes históricas — agrupar ventas por fecha + cliente (sin GASTO/AJUSTE). Solo persistencia; no toca stock.
  const ventasByGroup = new Map();
  for (const row of salidasParsed) {
    if (isGastoAjusteCliente(row.cliente) || !row.cliente || !row.fecha) continue;
    if (!row.codigo || !isValidProductCode(row.codigo) || row.salidas <= 0) continue;
    const productId = productByCode[row.codigo];
    if (!productId) continue;
    const gk = `${dateKey(row.fecha)}\t${row.cliente}`;
    if (!ventasByGroup.has(gk)) ventasByGroup.set(gk, []);
    ventasByGroup.get(gk).push(row);
  }

  let ordersCreated = 0;
  let ordersSkipped = 0;
  for (const [, lines] of ventasByGroup) {
    const first = lines[0];
    const deliveryDate = first.fecha;
    const customerId = customerByName[first.cliente] || null;

    const items = [];
    for (const line of lines) {
      const productId = productByCode[line.codigo];
      if (!productId) continue;
      const price =
        line.precioUnit > 0 ? line.precioUnit : line.salidas > 0 ? line.ventaTotal / line.salidas : 0;
      items.push({
        productId,
        quantity: line.salidas,
        price,
      });
    }
    if (items.length === 0) continue;

    const itemsTotal = items.reduce((s, it) => s + it.quantity * it.price, 0);
    const ventaSum = lines.reduce(
      (s, line) => s + (line.ventaTotal > 0 ? line.ventaTotal : line.salidas * line.precioUnit),
      0,
    );
    const total = itemsTotal;
    if (Math.abs(itemsTotal - ventaSum) > 0.05) {
      console.warn(
        `Aviso orden ${dateKey(deliveryDate)} / ${first.cliente}: total ítems ${itemsTotal} vs venta total Excel ${ventaSum}; se usa suma de ítems.`,
      );
    }

    const buckets = { [PaymentMethod.CASH]: 0, [PaymentMethod.CARD]: 0 };
    for (const line of lines) {
      const m = mapPaymentMethod(line.metodo);
      const lt = line.ventaTotal > 0 ? line.ventaTotal : line.salidas * line.precioUnit;
      buckets[m] += lt;
    }
    let payments;
    const bucketSum = buckets[PaymentMethod.CASH] + buckets[PaymentMethod.CARD];
    if (bucketSum > 0 && Math.abs(bucketSum - total) < 0.05) {
      payments = [];
      if (buckets[PaymentMethod.CASH] > 0.01) {
        payments.push({ amount: buckets[PaymentMethod.CASH], method: PaymentMethod.CASH });
      }
      if (buckets[PaymentMethod.CARD] > 0.01) {
        payments.push({ amount: buckets[PaymentMethod.CARD], method: PaymentMethod.CARD });
      }
    }
    if (!payments || payments.length === 0) {
      payments = [{ amount: total, method: mapPaymentMethod(first.metodo) }];
    }

    const payTotal = payments.reduce((s, p) => s + p.amount, 0);
    if (Math.abs(payTotal - total) > 0.05) {
      payments = [{ amount: total, method: mapPaymentMethod(first.metodo) }];
    }

    const existing = await prisma.order.findFirst({
      where: {
        ...(customerId ? { customerId } : { customerId: null }),
        total,
        deliveryDate: {
          gte: new Date(dateKey(deliveryDate) + "T00:00:00.000Z"),
          lte: new Date(dateKey(deliveryDate) + "T23:59:59.999Z"),
        },
      },
      include: { orderItems: true },
    });
    if (existing && existing.orderItems.length === items.length) {
      const sig = (arr) =>
        [...arr]
          .map((x) => `${x.productId}:${x.quantity}:${Number(x.price)}`)
          .sort()
          .join("|");
      if (sig(existing.orderItems) === sig(items)) {
        ordersSkipped++;
        continue;
      }
    }

    await prisma.order.create({
      data: {
        customerId,
        deliveryDate,
        createdAt: deliveryDate,
        total,
        fulfillmentLocationId: defaultLocationId,
        orderItems: {
          create: items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            price: i.price,
          })),
        },
        payments: {
          create: payments.map((p) => ({
            amount: p.amount,
            method: p.method,
          })),
        },
      },
    });
    ordersCreated++;
  }
  console.log("Órdenes (Salidas ventas): " + ordersCreated + " nuevas, " + ordersSkipped + " omitidas (duplicado).");

  // 7) Stock en ubicación predeterminada (paso 2). 8) Movimientos: Entradas → IN, Salidas → OUT
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
    const clientePart = r.cliente ? str(r.cliente).replace(/\|/g, " ") : "";
    const reason = `Importación Excel - Salida|${fechaStr}|${clientePart}|${r.codigo}|${r.salidas}`;
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
