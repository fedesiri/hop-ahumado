export async function fetchAllPages<T>(
  fetcher: (page: number) => Promise<{ data: T[]; meta: { totalPages: number } }>,
): Promise<T[]> {
  const first = await fetcher(1);
  const remaining = Array.from({ length: first.meta.totalPages - 1 }, (_, i) => fetcher(i + 2));
  const rest = await Promise.all(remaining);
  return [first, ...rest].flatMap((r) => r.data);
}

/** Devuelve solo el nombre del estado sin el prefijo numérico (ej. "2. Prospecto" → "Prospecto"). */
export function formatStatusLabel(status: string | null | undefined): string {
  if (status == null || status === "") return "";
  return status.replace(/^\d+\.\s*/, "").trim() || status;
}
