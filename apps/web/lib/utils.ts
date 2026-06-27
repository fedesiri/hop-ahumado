/** Devuelve solo el nombre del estado sin el prefijo numérico (ej. "2. Prospecto" → "Prospecto"). */
export function formatStatusLabel(status: string | null | undefined): string {
  if (status == null || status === "") return "";
  return status.replace(/^\d+\.\s*/, "").trim() || status;
}
