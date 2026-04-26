import { Decimal } from "@prisma/client/runtime/library";
import { OrderPaymentStatus } from "./order-payment-status.enum";

const ORDER_MONEY_TOLERANCE = 0.01;

type DecimalLike = number | string | Decimal;

type ComputableOrderItem = {
  quantity: number;
  price: DecimalLike;
};

type ComputablePayment = {
  amount: DecimalLike;
};

type ComputableOrder = {
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
};

function toNumber(value: DecimalLike): number {
  return Number(value);
}

export function computeOrderFields(order: ComputableOrder): OrderComputedFields {
  const totalPrice = order.orderItems.reduce((sum, item) => sum + toNumber(item.price) * Number(item.quantity), 0);
  const paidAmount = order.payments.reduce((sum, payment) => sum + toNumber(payment.amount), 0);
  const remainingAmount = Math.max(totalPrice - paidAmount, 0);
  const isDelivered = order.deliveredAt != null;

  let paymentStatus: OrderPaymentStatus = OrderPaymentStatus.PARTIALLY_PAID;
  if (Math.abs(paidAmount) < ORDER_MONEY_TOLERANCE) {
    paymentStatus = OrderPaymentStatus.UNPAID;
  } else if (Math.abs(paidAmount - totalPrice) < ORDER_MONEY_TOLERANCE || paidAmount > totalPrice) {
    paymentStatus = OrderPaymentStatus.PAID;
  }

  return {
    totalPrice,
    paidAmount,
    remainingAmount,
    paymentStatus,
    isDelivered,
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
