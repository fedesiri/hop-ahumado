import { formatCurrency, formatQuantity } from "@/lib/format-currency";
import { PRICE_TYPE_LABELS, parsePriceListType } from "@/lib/order-calculator/price-types";
import type { Order, OrderItem } from "@/lib/types";

/**
 * Texto plano del pedido para portapapeles (misma idea que "Copiar pedido" en la calculadora).
 */
export function buildOrderClipboardText(order: Order): string | null {
  const items = order.orderItems ?? [];
  if (items.length === 0) return null;

  const customerName = order.customer?.name?.trim();
  const nameLine = customerName ? `Pedido para: ${customerName}` : "Pedido";
  const parts: string[] = [nameLine, ""];

  const listType = parsePriceListType(order.priceListType);
  if (listType) {
    parts.push(`Precio: ${PRICE_TYPE_LABELS[listType].toUpperCase()}`, "");
  }

  if (order.comment?.trim()) {
    parts.push(`Comentario: ${order.comment.trim()}`, "");
  }

  const lines = items.map((it: OrderItem) => {
    const name = it.product?.name?.trim() || it.productId;
    const qty = Number(it.quantity);
    const subtotal = qty * Number(it.price);
    return { name, qty, subtotal };
  });
  lines.sort((a, b) => b.qty - a.qty);

  lines.forEach(({ name, qty, subtotal }) => {
    parts.push(`- ${formatQuantity(qty)} ${name} --> ${formatCurrency(subtotal)}`);
  });

  parts.push("");
  parts.push("-------------------");
  parts.push(`Total ${formatCurrency(order.total)}`);

  return parts.join("\n");
}
