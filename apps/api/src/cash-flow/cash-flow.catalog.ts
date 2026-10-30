import { CashClassification, CashMovementType } from "@prisma/client";

export const CASH_BOX_PAYER = "Caja Alumo";

export const CASH_FLOW_CATEGORIES: ReadonlyArray<{
  name: string;
  type: CashMovementType;
  classification: CashClassification;
}> = [
  { name: "Eventos", type: "INCOME", classification: "OPERATING" },
  { name: "Catering", type: "INCOME", classification: "OPERATING" },
  { name: "Venta directa", type: "INCOME", classification: "OPERATING" },
  { name: "Venta Mayorista", type: "INCOME", classification: "OPERATING" },
  { name: "Otros ingresos", type: "INCOME", classification: "OPERATING" },
  { name: "Venta a socios", type: "INCOME", classification: "OPERATING" },
  { name: "Materia prima", type: "EXPENSE", classification: "OPERATING" },
  { name: "Carbón / Leña", type: "EXPENSE", classification: "OPERATING" },
  { name: "Packaging", type: "EXPENSE", classification: "OPERATING" },
  { name: "Transporte", type: "EXPENSE", classification: "OPERATING" },
  { name: "Marketing", type: "EXPENSE", classification: "OPERATING" },
  { name: "Equipamiento", type: "EXPENSE", classification: "INVESTMENT" },
  { name: "Servicios", type: "EXPENSE", classification: "OPERATING" },
  { name: "Impuestos", type: "EXPENSE", classification: "OPERATING" },
  { name: "Otros gastos", type: "EXPENSE", classification: "OPERATING" },
  { name: "Mantenimiento", type: "EXPENSE", classification: "OPERATING" },
];

export const CASH_FLOW_PAYMENT_METHODS = [
  "Efectivo",
  "Transferencia",
  "Mercado Pago",
  "Tarjeta de crédito",
] as const;

export const CASH_FLOW_PAYERS = [
  CASH_BOX_PAYER,
  "Fernando (Fer)",
  "Lucía (Lu)",
  "Federico (Fede)",
  "Francisco (Fran)",
  "Otro",
] as const;

export const CASH_FLOW_REIMBURSEMENT_STATUSES = ["Sí", "No", "Pendiente"] as const;

/** Reembolsos que todavía cuentan como deuda con el socio. */
export const OPEN_REIMBURSEMENT_STATUSES: readonly string[] = ["No", "Pendiente"];

export function findCategory(name: string) {
  return CASH_FLOW_CATEGORIES.find((c) => c.name === name);
}
