"use client";

import { apiClient } from "@/lib/api-client";
import type { CrmCustomerListItem, CrmDashboardResponse } from "@/lib/types";
import { formatStatusLabel } from "@/lib/utils";
import { MessageSquare, Users, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type StatusStyle = { color: string; bg: string; border: string };

const STATUS_STYLES: Record<string, StatusStyle> = {
  lead:      { color: "#60a5fa", bg: "#60a5fa22", border: "#60a5fa55" },
  prospecto: { color: "#818cf8", bg: "#818cf822", border: "#818cf855" },
  cliente:   { color: "#4ade80", bg: "#4ade8022", border: "#4ade8055" },
  activo:    { color: "#4ade80", bg: "#4ade8022", border: "#4ade8055" },
  pausado:   { color: "#fbbf24", bg: "#fbbf2422", border: "#fbbf2455" },
  perdido:   { color: "#f87171", bg: "#f8717122", border: "#f8717155" },
  inactivo:  { color: "#9ca3af", bg: "#9ca3af22", border: "#9ca3af55" },
};

function statusStyle(status: string | null): StatusStyle {
  const key = status ? formatStatusLabel(status).toLowerCase() : "";
  return STATUS_STYLES[key] ?? { color: "var(--ha-text-3)", bg: "var(--ha-bg-raised)", border: "var(--ha-border-2)" };
}

export default function CrmDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<CrmDashboardResponse | null>(null);
  const [stale, setStale] = useState<CrmCustomerListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [dashboard, customers] = await Promise.all([
          apiClient.getCrmDashboard(),
          apiClient.listCrmCustomers(1, 100),
        ]);
        setData(dashboard);
        const filtered = (customers.data ?? [])
          .filter((c) => c.daysSinceLastContact != null && c.daysSinceLastContact > 30)
          .sort((a, b) => (b.daysSinceLastContact ?? 0) - (a.daysSinceLastContact ?? 0))
          .slice(0, 6);
        setStale(filtered);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "60px 0" }}>
        <div style={{ width: 32, height: 32, borderRadius: "50%", border: "3px solid var(--ha-border-2)", borderTopColor: "var(--ha-amber)", animation: "ha-spin .7s linear infinite" }} />
      </div>
    );
  }

  if (!data) return null;

  const total = data.byStatus.reduce((sum, r) => sum + r.count, 0);

  return (
    <div>
      <div className="ha-page-header">
        <h1 className="ha-pagetitle">CRM — Dashboard</h1>
      </div>

      {/* KPI cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16, marginBottom: 24 }}>
        {([
          { icon: <Users size={22} />, value: data.profileCount, label: "Perfiles activos" },
          { icon: <MessageSquare size={22} />, value: data.interactionCount, label: "Total interacciones" },
          { icon: <Zap size={22} />, value: data.opportunityCount, label: "Oportunidades abiertas" },
        ] as const).map(({ icon, value, label }) => (
          <div key={label} style={{ padding: "22px 20px", borderRadius: 12, background: "var(--ha-bg-card)", border: "1px solid var(--ha-border)" }}>
            <div style={{
              width: 46, height: 46, borderRadius: "50%",
              background: "var(--ha-amber)", display: "flex",
              alignItems: "center", justifyContent: "center",
              color: "#0f1117", marginBottom: 16,
            }}>
              {icon}
            </div>
            <div style={{ fontSize: 40, fontWeight: 800, color: "var(--ha-text)", lineHeight: 1, marginBottom: 6 }}>
              {value}
            </div>
            <div style={{ fontSize: 14, color: "var(--ha-text-3)" }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Clientes por estado */}
      <div style={{ padding: "18px 20px", borderRadius: 12, background: "var(--ha-bg-card)", border: "1px solid var(--ha-border)", marginBottom: 20 }}>
        <h2 style={{ margin: "0 0 18px", fontSize: 15, fontWeight: 700, color: "var(--ha-text)" }}>Clientes por estado</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {data.byStatus.map((row) => {
            const label = formatStatusLabel(row.status) || "Sin estado";
            const pct = total > 0 ? (row.count / total) * 100 : 0;
            const s = statusStyle(row.status);
            return (
              <div key={row.status ?? "__null__"} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  width: 96, flexShrink: 0, padding: "3px 10px", borderRadius: 6,
                  fontSize: 13, fontWeight: 500,
                  background: s.bg, color: s.color, border: `1px solid ${s.border}`,
                }}>
                  {label}
                </span>
                <span style={{ width: 32, flexShrink: 0, fontWeight: 700, fontSize: 16, color: "var(--ha-text)", textAlign: "right" }}>
                  {row.count}
                </span>
                <span style={{ width: 52, flexShrink: 0, fontSize: 13, color: "var(--ha-text-3)" }}>
                  {pct.toFixed(1)}%
                </span>
                <div style={{ flex: 1, height: 6, borderRadius: 3, background: "var(--ha-bg-raised)", overflow: "hidden" }}>
                  <div style={{ width: `${pct}%`, height: "100%", borderRadius: 3, background: s.color, opacity: 0.65 }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sin interacciones recientes */}
      {stale.length > 0 && (
        <div style={{ padding: "18px 20px", borderRadius: 12, background: "var(--ha-bg-card)", border: "1px solid var(--ha-border)" }}>
          <h2 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "var(--ha-text)" }}>Sin interacciones recientes</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {stale.map((c) => (
              <div
                key={c.customerId}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  gap: 12, padding: "12px 14px", borderRadius: 10,
                  background: "var(--ha-bg-raised)", border: "1px solid var(--ha-border)",
                  borderLeft: "3px solid #f59e0b",
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: "var(--ha-text)" }}>{c.customerName}</div>
                  <div style={{ fontSize: 12, color: "#f87171", marginTop: 2 }}>
                    Sin contacto en {c.daysSinceLastContact} días
                  </div>
                </div>
                {c.profileId && (
                  <button
                    onClick={() => router.push(`/crm/customers/${c.profileId}`)}
                    style={{
                      flexShrink: 0, height: 34, padding: "0 14px",
                      border: "1.5px solid var(--ha-amber)", borderRadius: 8,
                      background: "transparent", color: "var(--ha-amber)",
                      fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
                    }}
                  >
                    Registrar interacción
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
