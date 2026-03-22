/**
 * Formato único de moneda en la app: $ sin decimales, separador de miles es-AR (ej: $10.400).
 */
export function formatCurrency(value: number | string | null | undefined): string {
  return `$${Number(value ?? 0).toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
}

/** Stock y cantidades con hasta 4 decimales (ej. kg: 10,5). */
export function formatQuantity(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  if (Number.isNaN(n)) return "—";
  return n.toLocaleString("es-AR", { maximumFractionDigits: 4, minimumFractionDigits: 0 });
}
