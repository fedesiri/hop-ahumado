import { formatStatusLabel } from "@/lib/utils";

/** Estados de contacto canónicos (filtros y formularios). El listado en BD puede traer prefijos tipo "2. Prospecto". */
export const CRM_STATUS_OPTIONS = [
  { value: "Lead", label: "Lead" },
  { value: "Prospecto", label: "Prospecto" },
  { value: "Cliente", label: "Cliente" },
  { value: "Pausado", label: "Pausado" },
  { value: "Perdido", label: "Perdido" },
] as const;

export const CRM_CUSTOMER_TYPE_OPTIONS = [
  { value: "Empresa", label: "Empresa" },
  { value: "Particular", label: "Particular" },
] as const;

/** Orígenes sugeridos para reducir texto libre; si en BD hay otro valor, se agrega dinámicamente al Select. */
export const CRM_SOURCE_OPTIONS = [
  { value: "Web", label: "Web" },
  { value: "Referido", label: "Referido" },
  { value: "Evento", label: "Evento" },
  { value: "Redes sociales", label: "Redes sociales" },
  { value: "Google", label: "Google" },
  { value: "WhatsApp", label: "WhatsApp" },
  { value: "Local / Punto de venta", label: "Local / Punto de venta" },
  { value: "Otro", label: "Otro" },
] as const;

export type CrmSelectOption = { value: string; label: string };

/** Alinea valores guardados con prefijos ("2. Prospecto") al valor del Select. */
export function normalizeCrmStatusForForm(status: string | null | undefined): string | undefined {
  if (status == null || status === "") return undefined;
  const plain = formatStatusLabel(status);
  const found = CRM_STATUS_OPTIONS.find((o) => o.value.toLowerCase() === plain.toLowerCase());
  return found ? found.value : status;
}

/** Incluye en las opciones un valor actual que no esté en la lista base (datos históricos). */
export function mergeCrmSelectOptions(
  current: string | null | undefined,
  base: readonly CrmSelectOption[],
): CrmSelectOption[] {
  const list = [...base];
  const trimmed = current?.trim();
  if (!trimmed) return list;
  if (!list.some((o) => o.value === trimmed)) {
    list.unshift({ value: trimmed, label: trimmed });
  }
  return list;
}
