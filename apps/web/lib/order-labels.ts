import { OrderPaymentStatus, PaymentMethod, type OrderPayment } from "@/lib/types";

export function orderPaymentStatusLabel(status: OrderPaymentStatus | string): string {
  if (status === OrderPaymentStatus.PAID) return "Pagada";
  if (status === OrderPaymentStatus.PARTIALLY_PAID) return "Pago parcial";
  if (status === OrderPaymentStatus.UNPAID) return "Impaga";
  return String(status);
}

/** Etiqueta de medio de pago alineada con el resto de la app (CARD se muestra como transferencia). */
export function paymentMethodLabel(method: PaymentMethod | string): string {
  if (method === PaymentMethod.CASH || method === "CASH") return "Efectivo";
  if (method === PaymentMethod.CARD || method === "CARD") return "Transferencia";
  return String(method);
}

/** Medios usados (sin montos), en el orden de aparición de los pagos. */
export function formatPaymentMethodsOnly(payments: OrderPayment[] | undefined): string {
  if (!payments?.length) return "—";
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const p of payments) {
    const key = String(p.method);
    if (seen.has(key)) continue;
    seen.add(key);
    labels.push(paymentMethodLabel(p.method));
  }
  return labels.join(" · ");
}
