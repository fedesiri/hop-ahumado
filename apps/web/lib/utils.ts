import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Devuelve solo el nombre del estado sin el prefijo numérico (ej. "2. Prospecto" → "Prospecto"). */
export function formatStatusLabel(status: string | null | undefined): string {
  if (status == null || status === "") return "";
  return status.replace(/^\d+\.\s*/, "").trim() || status;
}
