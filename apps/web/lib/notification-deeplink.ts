/** Resolución MVP `entityType` + `entityId` → app router path (ver PRD notificaciones). */
export function pathForNotificationEntity(entityType: string, entityId: string): string {
  switch (entityType) {
    case "customer_profile":
      return `/crm/customers/${encodeURIComponent(entityId)}`;
    case "product":
      return `/stock`;
    default:
      return "/";
  }
}
