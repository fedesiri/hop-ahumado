/**
 * Catálogo de tipos de notificación. Para agregar un evento:
 * 1) Entrada aquí (messageTemplate + resolveEntity + dedupeHours opcional)
 * 2) Handler `@OnEvent(name)` en NotificationsService que llame `ingest(...)`
 * 3) Emitir el evento de dominio desde el módulo origen
 */

export type NotificationEntityType = "product" | "customer_profile" | "stock";

export type CatalogEntry = {
  /** Ventana anti-spam por entidad y tipo de evento (horas). */
  dedupeHours?: number;
  messageTemplate: (payload: unknown) => string;
  resolveEntity: (payload: unknown) => { entityType: NotificationEntityType; entityId: string };
};

export type StockQtyPayload = {
  productId: string;
  productName: string;
  quantity: number;
};

export type StockAtypicalPayload = {
  productId: string;
  productName: string;
  movementQuantity: number;
  movementType: string;
  priorStock: number;
  newStock: number;
};

export type CrmFollowupPayload = {
  profileId: string;
  customerName: string;
};

export type CrmInteractionPayload = {
  profileId: string;
  customerName: string;
  interactionId: string;
};

export type CrmAssignPayload = {
  profileId: string;
  customerName: string;
  opportunityId?: string;
  assignedUserId?: string | null;
};

export type CustomerLapsedPayload = {
  profileId: string;
  customerName: string;
  /** Días desde la última compra; sin compras, desde que se cargó el cliente al CRM. */
  daysSincePurchase: number;
  /** null si el cliente nunca compró. */
  lastPurchaseAt: string | null;
};

const as = <T>(p: unknown) => p as T;

export const NOTIFICATION_CATALOG: Record<string, CatalogEntry> = {
  "stock.low": {
    dedupeHours: 24,
    messageTemplate: (p: unknown) => {
      const x = as<StockQtyPayload>(p);
      return `Stock bajo: ${x.productName} (saldo ${x.quantity})`;
    },
    resolveEntity: (p: unknown) => ({
      entityType: "product" as const,
      entityId: as<StockQtyPayload>(p).productId,
    }),
  },

  "stock.out": {
    dedupeHours: 24,
    messageTemplate: (p: unknown) => {
      const x = as<StockQtyPayload>(p);
      return `Sin stock: ${x.productName}`;
    },
    resolveEntity: (p: unknown) => ({
      entityType: "product" as const,
      entityId: as<StockQtyPayload>(p).productId,
    }),
  },

  "stock.atypical_movement": {
    dedupeHours: 24,
    messageTemplate: (p: unknown) => {
      const x = as<StockAtypicalPayload>(p);
      return `Movimiento atípico de stock: ${x.productName} (${x.movementType}, Δ ${x.movementQuantity}, saldo ${x.priorStock} → ${x.newStock})`;
    },
    resolveEntity: (p: unknown) => ({
      entityType: "product" as const,
      entityId: as<StockAtypicalPayload>(p).productId,
    }),
  },

  "crm.followup_due": {
    dedupeHours: 12,
    messageTemplate: (p: unknown) => {
      const x = as<CrmFollowupPayload>(p);
      return `Seguimiento CRM vencido: ${x.customerName}`;
    },
    resolveEntity: (p: unknown) => ({
      entityType: "customer_profile" as const,
      entityId: as<CrmFollowupPayload>(p).profileId,
    }),
  },

  "crm.customer_lapsed": {
    dedupeHours: 24,
    messageTemplate: (p: unknown) => {
      const x = as<CustomerLapsedPayload>(p);
      if (!x.lastPurchaseAt) {
        return `Cliente mayorista sin compras registradas (cargado hace ${x.daysSincePurchase} días): ${x.customerName}`;
      }
      const last = new Date(x.lastPurchaseAt).toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" });
      return `Cliente mayorista sin comprar hace ${x.daysSincePurchase} días: ${x.customerName} (última compra ${last})`;
    },
    resolveEntity: (p: unknown) => ({
      entityType: "customer_profile" as const,
      entityId: as<CustomerLapsedPayload>(p).profileId,
    }),
  },

  "crm.interaction_created": {
    dedupeHours: 1,
    messageTemplate: (p: unknown) => {
      const x = as<CrmInteractionPayload>(p);
      return `Nueva interacción CRM: ${x.customerName}`;
    },
    resolveEntity: (p: unknown) => ({
      entityType: "customer_profile" as const,
      entityId: as<CrmInteractionPayload>(p).profileId,
    }),
  },

  "crm.opportunity_assigned": {
    dedupeHours: 6,
    messageTemplate: (p: unknown) => {
      const x = as<CrmAssignPayload>(p);
      return `Oportunidad / cuenta asignada: ${x.customerName}`;
    },
    resolveEntity: (p: unknown) => ({
      entityType: "customer_profile" as const,
      entityId: as<CrmAssignPayload>(p).profileId,
    }),
  },
};
