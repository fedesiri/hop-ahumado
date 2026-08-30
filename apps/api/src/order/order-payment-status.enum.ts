export enum OrderPaymentStatus {
  UNPAID = "UNPAID",
  PARTIALLY_PAID = "PARTIALLY_PAID",
  PAID = "PAID",
  PENDING_PRICING = "PENDING_PRICING",
  /** Consignación: lo vendido está pagado, pero quedan unidades en consignación sin cerrar. */
  OPEN_CONSIGNMENT = "OPEN_CONSIGNMENT",
  CANCELLED = "CANCELLED",
}
