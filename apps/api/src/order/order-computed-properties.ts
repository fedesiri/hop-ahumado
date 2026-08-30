import { Decimal } from "@prisma/client/runtime/library";
import { OrderPaymentStatus } from "./order-payment-status.enum";

const ORDER_MONEY_TOLERANCE = 0.01;

type DecimalLike = number | string | Decimal;

type ComputableOrderItem = {
  quantity: number;
  price: DecimalLike | null | undefined;
};

type ComputablePayment = {
  amount: DecimalLike;
};

type ComputableOrder = {
  isConsignment?: boolean | null;
  cancelledAt?: Date | null;
  deliveredAt?: Date | null;
  orderItems: ComputableOrderItem[];
  payments: ComputablePayment[];
};

export type OrderComputedFields = {
  totalPrice: number;
  paidAmount: number;
  remainingAmount: number;
  paymentStatus: OrderPaymentStatus;
  isDelivered: boolean;
  /** Consignación: hay unidades sin precio fijado que siguen en consignación. */
  hasPendingConsignmentUnits: boolean;
  /** Consignación: total de unidades sin cobrar todavía. */
  pendingConsignmentUnits: number;
};

function toNumber(value: DecimalLike): number {
  return Number(value);
}

export function computeOrderFields(order: ComputableOrder): OrderComputedFields {
  const isDelivered = order.deliveredAt != null;
  const isConsignment = order.isConsignment ?? false;

  const pendingConsignmentUnits = isConsignment
    ? order.orderItems.reduce(
        (sum, item) => (item.price == null ? sum + Number(item.quantity) : sum),
        0,
      )
    : 0;
  const hasPendingConsignmentUnits = pendingConsignmentUnits > 0;

  const isCancelled = isConsignment && order.cancelledAt != null;
  if (isCancelled) {
    return {
      totalPrice: 0,
      paidAmount: 0,
      remainingAmount: 0,
      paymentStatus: OrderPaymentStatus.CANCELLED,
      isDelivered,
      hasPendingConsignmentUnits: false,
      pendingConsignmentUnits: 0,
    };
  }

  const hasPricedItems = order.orderItems.some((i) => i.price != null);
  // Consignación sin ningún ítem con precio fijado: aún pendiente de cobro.
  // Si ya hay ítems cobrados, se calcula sobre esos y el resto queda en consignación.
  if (isConsignment && hasPendingConsignmentUnits && !hasPricedItems) {
    return {
      totalPrice: 0,
      paidAmount: 0,
      remainingAmount: 0,
      paymentStatus: OrderPaymentStatus.PENDING_PRICING,
      isDelivered,
      hasPendingConsignmentUnits,
      pendingConsignmentUnits,
    };
  }

  const totalPrice = order.orderItems.reduce(
    (sum, item) => sum + (item.price != null ? toNumber(item.price) : 0) * Number(item.quantity),
    0,
  );
  const paidAmount = order.payments.reduce((sum, payment) => sum + toNumber(payment.amount), 0);
  const remainingAmount = Math.max(totalPrice - paidAmount, 0);

  let paymentStatus: OrderPaymentStatus = OrderPaymentStatus.PARTIALLY_PAID;
  if (Math.abs(paidAmount) < ORDER_MONEY_TOLERANCE) {
    paymentStatus = OrderPaymentStatus.UNPAID;
  } else if (Math.abs(paidAmount - totalPrice) < ORDER_MONEY_TOLERANCE || paidAmount > totalPrice) {
    paymentStatus = OrderPaymentStatus.PAID;
  }

  // La consignación no está "pagada" mientras queden unidades sin vender/cobrar,
  // aunque lo ya vendido esté saldado por completo.
  if (
    isConsignment &&
    hasPendingConsignmentUnits &&
    paymentStatus === OrderPaymentStatus.PAID
  ) {
    paymentStatus = OrderPaymentStatus.OPEN_CONSIGNMENT;
  }

  return {
    totalPrice,
    paidAmount,
    remainingAmount,
    paymentStatus,
    isDelivered,
    hasPendingConsignmentUnits,
    pendingConsignmentUnits,
  };
}

export function enrichOrderWithComputedFields<T extends ComputableOrder>(order: T): T & OrderComputedFields {
  return {
    ...order,
    ...computeOrderFields(order),
  };
}

export function enrichOrdersWithComputedFields<T extends ComputableOrder>(orders: T[]): Array<T & OrderComputedFields> {
  return orders.map((order) => enrichOrderWithComputedFields(order));
}

export function validateNoOverpayment(totalPrice: number, currentPaidAmount: number, newAmount: number) {
  if (currentPaidAmount + newAmount > totalPrice + ORDER_MONEY_TOLERANCE) {
    throw new Error(
      `El pago excede el saldo pendiente. Pagado: ${currentPaidAmount.toFixed(2)} | Total: ${totalPrice.toFixed(2)} | Intento: ${newAmount.toFixed(2)}`,
    );
  }
}

export const ORDER_PAYMENT_TOLERANCE = ORDER_MONEY_TOLERANCE;
