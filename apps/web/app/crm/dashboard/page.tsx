"use client";

import { apiClient } from "@/lib/api-client";
import type { CrmDashboardResponse } from "@/lib/types";
import { formatStatusLabel } from "@/lib/utils";
import { MessageSquare, TrendingUp, Users } from "lucide-react";
import { useEffect, useState } from "react";

export default function CrmDashboardPage() {
  const [data, setData] = useState<CrmDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .getCrmDashboard()
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="ha-empty">
        <span className="ha-empty__t">Cargando...</span>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div>
      <div className="ha-page-header">
        <h1 className="ha-pagetitle">CRM — Dashboard</h1>
      </div>

      <div className="ha-stats">
        <div className="ha-stat">
          <span className="ha-stat__icon">
            <Users size={18} />
          </span>
          <span className="ha-stat__label">Contactos</span>
          <span className="ha-stat__value">{data.profileCount}</span>
        </div>
        <div className="ha-stat">
          <span className="ha-stat__icon">
            <MessageSquare size={18} />
          </span>
          <span className="ha-stat__label">Interacciones</span>
          <span className="ha-stat__value">{data.interactionCount}</span>
        </div>
        <div className="ha-stat">
          <span className="ha-stat__icon">
            <TrendingUp size={18} />
          </span>
          <span className="ha-stat__label">Oportunidades</span>
          <span className="ha-stat__value">{data.opportunityCount}</span>
        </div>
      </div>

      <div className="ha-table-wrap" style={{ marginTop: 24 }}>
        <h2 className="ha-pagetitle" style={{ fontSize: 16, marginBottom: 12 }}>
          Por estado
        </h2>
        <table className="ha-table">
          <thead>
            <tr>
              <th>Estado</th>
              <th style={{ textAlign: "right" }}>Cantidad</th>
            </tr>
          </thead>
          <tbody>
            {data.byStatus.map((row) => (
              <tr key={row.status ?? "__null__"}>
                <td>{formatStatusLabel(row.status) || "—"}</td>
                <td style={{ textAlign: "right" }} className="ha-mono">
                  {row.count}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="ha-cardlist" style={{ marginTop: 24 }}>
        <h2 className="ha-pagetitle" style={{ fontSize: 16, marginBottom: 12 }}>
          Por estado
        </h2>
        {data.byStatus.map((row) => (
          <div key={row.status ?? "__null__"} className="ha-ordcard">
            <div className="ha-ordcard__header">
              <span className="ha-ordcard__id">
                {formatStatusLabel(row.status) || "—"}
              </span>
              <span className="ha-mono">{row.count}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
