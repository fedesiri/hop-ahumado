/**
 * Formato único de moneda en la app: $ sin decimales, separador de miles es-AR (ej: $10.400).
 */
export function formatCurrency(value: number | string | null | undefined): string {
  return `$${Number(value ?? 0).toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
}
