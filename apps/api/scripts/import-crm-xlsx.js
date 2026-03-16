/**
 * Importa datos del Excel CRM (BierLife) a la DB: Customer, CustomerProfile, CustomerInteraction, CustomerOpportunity.
 * Uso: node scripts/import-crm-xlsx.js "ruta/al/CRM _ BierLife.xlsx"
 * Ejecutar desde apps/api (pnpm run import:crm "ruta")
 *
 * Hojas esperadas:
 *   1) DB_Clientes (o primera hoja): Nombre completo, Empresa, Tipo, Telefono, Email, Estado, Fuente, Responsable, próximo seguimiento, Notas generales
 *   2) Interacciones (o segunda hoja): nombre cliente / Nombre cliente, fecha, medios de contacto, resumen/notas, proximo paso
 *   3) Oportunidades (o tercera hoja): datos de oportunidad por cliente (etapa, valor, etc.)
 */
const XLSX = require("xlsx");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const { InteractionChannel } = require("@prisma/client");

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

function str(val) {
  if (val == null) return "";
  return String(val).trim();
}

function num(val) {
  if (val === "" || val == null) return null;
  const n = Number(String(val).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** Dado un objeto fila (claves pueden variar) y posibles nombres de columna, devuelve el valor. */
function col(row, ...names) {
  const keys = Object.keys(row || {});
  for (const name of names) {
    const lower = (name || "").toLowerCase();
    for (const k of keys) {
      if (k && String(k).trim().toLowerCase() === lower) return row[k];
      if (k && String(k).trim().toLowerCase().includes(lower)) return row[k];
    }
  }
  return undefined;
}

/** Mapea texto "medios de contacto" al enum InteractionChannel */
function mapChannel(val) {
  const v = (val || "").toString().trim().toLowerCase();
  if (v.includes("llamada") || v === "call") return InteractionChannel.CALL;
  if (v.includes("email") || v === "mail") return InteractionChannel.EMAIL;
  if (v.includes("whatsapp") || v === "wa") return InteractionChannel.WHATSAPP;
  if (
    v.includes("reunión") ||
    v.includes("reunion") ||
    v.includes("meeting") ||
    v.includes("presencial") ||
    v.includes("visita")
  )
    return InteractionChannel.MEETING;
  if (v.includes("instagram")) return InteractionChannel.OTHER;
  if (v) return InteractionChannel.OTHER;
  return null;
}

async function run(filePath) {
  const workbook = XLSX.readFile(filePath);
  const sheetNames = workbook.SheetNames;

  const clientsSheetName = sheetNames.find((n) => /clientes?|db_?clientes?/i.test(n)) || sheetNames[0];
  const interactionsSheetName = sheetNames.find((n) => /interacciones?/i.test(n)) || sheetNames[1] || sheetNames[0];
  const opportunitiesSheetName = sheetNames.find((n) => /oportunidades?/i.test(n)) || sheetNames[2];

  const clientsSheet = workbook.Sheets[clientsSheetName];
  const interactionsSheet = workbook.Sheets[interactionsSheetName];
  const opportunitiesSheet = opportunitiesSheetName ? workbook.Sheets[opportunitiesSheetName] : null;

  if (!clientsSheet) {
    throw new Error("No se encontró hoja de clientes. Hojas: " + sheetNames.join(", "));
  }

  const clientsData = XLSX.utils.sheet_to_json(clientsSheet, { defval: "" });
  const interactionsData = interactionsSheet ? XLSX.utils.sheet_to_json(interactionsSheet, { defval: "" }) : [];
  const opportunitiesData = opportunitiesSheet ? XLSX.utils.sheet_to_json(opportunitiesSheet, { defval: "" }) : [];

  console.log("Hoja clientes:", clientsSheetName, "->", clientsData.length, "filas");
  console.log("Hoja interacciones:", interactionsSheetName, "->", interactionsData.length, "filas");
  console.log("Hoja oportunidades:", opportunitiesSheetName || "—", "->", opportunitiesData.length, "filas");

  const users = await prisma.user.findMany({ select: { id: true, name: true } });
  const userByName = Object.fromEntries(users.map((u) => [u.name.trim().toLowerCase(), u.id]));

  function resolveResponsible(name) {
    if (!name) return null;
    const key = str(name).toLowerCase();
    return userByName[key] || null;
  }

  /** ID_Cliente del Excel -> profile (para vincular interacciones) */
  const profileByExcelId = {};
  /** Nombre contacto/empresa -> profile (para Oportunidades) */
  const profileByContactName = {};
  const profileByEmpresa = {};

  let clientsCreated = 0;
  for (const row of clientsData) {
    const empresa = str(col(row, "Empresa", "empresa"));
    const contactName = str(col(row, "Nombre Completo", "Nombre completo", "Contacto", "nombre"));

    if (!empresa && !contactName) continue;

    const idClienteRaw = col(row, "ID_Cliente", "ID Cliente", "id_cliente");
    const idCliente = idClienteRaw != null && idClienteRaw !== "" ? String(idClienteRaw).trim() : null;

    const customerName = empresa || contactName;
    const customer = await prisma.customer.create({
      data: { name: customerName },
    });

    const phone = str(col(row, "Teléfono", "Telefono", "telefono"));
    const email = str(col(row, "Email", "email"));
    const customerType = str(col(row, "Tipo", "tipo"));
    const status = str(col(row, "Estado", "estado"));
    const source = str(col(row, "Fuente", "fuente"));
    const responsibleName = str(col(row, "Responsable", "responsable"));
    const nextFollowUpAt = excelDateToJs(col(row, "Próximo Seguimiento", "Próximo seguimiento", "proximo seguimiento"));
    const generalNotes = str(col(row, "Notas Generales", "Notas generales", "Notas", "notas"));
    const responsibleId = resolveResponsible(responsibleName) || null;

    const profile = await prisma.customerProfile.create({
      data: {
        customerId: customer.id,
        contactName: contactName || null,
        phone: phone || null,
        email: email || null,
        customerType: customerType || null,
        status: status || null,
        source: source || null,
        responsibleId,
        generalNotes: generalNotes || null,
        nextFollowUpAt: nextFollowUpAt || null,
      },
    });

    if (idCliente) profileByExcelId[String(idCliente)] = profile;
    if (contactName) profileByContactName[contactName.toLowerCase()] = profile;
    if (empresa) profileByEmpresa[empresa.toLowerCase()] = profile;
    clientsCreated++;
  }

  console.log("Clientes/Perfiles creados:", clientsCreated);

  function findProfileByName(clienteNombre) {
    const key = str(clienteNombre).toLowerCase();
    return profileByContactName[key] || profileByEmpresa[key] || null;
  }

  let interactionsCreated = 0;
  for (const row of interactionsData) {
    const idClienteRaw = col(row, "ID_Cliente", "ID Cliente", "id_cliente");
    const idCliente = idClienteRaw != null && idClienteRaw !== "" ? String(idClienteRaw).trim() : null;
    let profile = idCliente ? profileByExcelId[idCliente] : null;
    if (!profile) {
      const clienteNombre = str(col(row, "Nombre Cliente", "nombre cliente", "Cliente", "empresa", "Empresa"));
      profile = clienteNombre ? findProfileByName(clienteNombre) : null;
    }
    if (!profile) continue;

    const dateVal = col(row, "Fecha", "fecha", "date");
    const date = excelDateToJs(dateVal) || new Date();
    const channel = mapChannel(col(row, "Medios de Contacto", "Medios de contacto", "medio", "canal"));
    const notes = str(col(row, "Resumen / Notas", "Resumen/notas", "notas", "resumen", "Notas"));
    const nextStep = str(col(row, "Próximo Paso", "Próximo paso", "proximo paso", "next step"));

    await prisma.customerInteraction.create({
      data: {
        profileId: profile.id,
        channel,
        date,
        notes: notes || null,
        nextStep: nextStep || null,
      },
    });
    interactionsCreated++;
  }
  console.log("Interacciones creadas:", interactionsCreated);

  if (opportunitiesData.length > 0 && opportunitiesSheet) {
    let opportunitiesCreated = 0;
    for (const row of opportunitiesData) {
      const clienteNombre = str(
        col(
          row,
          "Nombre de  cliente",
          "Nombre de cliente",
          "nombre cliente",
          "Nombre Cliente",
          "Cliente",
          "empresa",
          "Empresa",
        ),
      );
      if (!clienteNombre) continue;

      const profile = findProfileByName(clienteNombre);
      if (!profile) continue;

      const existing = await prisma.customerOpportunity.findUnique({
        where: { customerProfileId: profile.id },
      });
      if (existing) continue;

      const stage = str(col(row, "Etapa", "etapa", "stage", "estado"));
      const estimatedValue = num(col(row, "Valor Estimado", "Valor estimado", "valor", "Valor", "estimated value"));
      const expectedClosingDate = excelDateToJs(
        col(row, "Cierre Estimado", "Cierre estimado", "fecha cierre", "expected closing", "cierre"),
      );
      const notes = str(col(row, "Notas", "notes"));

      await prisma.customerOpportunity.create({
        data: {
          customerProfileId: profile.id,
          stage: stage || null,
          estimatedValue: estimatedValue != null ? estimatedValue : null,
          expectedClosingDate,
          notes: notes || null,
        },
      });
      opportunitiesCreated++;
    }
    console.log("Oportunidades creadas:", opportunitiesCreated);
  }

  console.log("Importación CRM finalizada.");
}

const path = process.argv[2] || "C:\\Users\\Federico Siri\\Downloads\\CRM _ BierLife.xlsx";
run(path)
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
