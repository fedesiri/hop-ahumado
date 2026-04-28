"use client";

import { AppLayout } from "@/components/app-layout";
import { ScreenInfoPanel } from "@/components/screen-info-panel";
import { apiClient } from "@/lib/api-client";
import { LineProvider } from "@/lib/line-context";
import type { DistributorSuggestedOrderItem, DistributorSuggestedOrderResponse } from "@/lib/types";
import { useMediaQuery } from "@/lib/use-media-query";
import { CopyOutlined, ShoppingCartOutlined } from "@ant-design/icons";
import { Alert, App, Button, Card, Collapse, InputNumber, Table, Tag } from "antd";
import { useMemo, useState } from "react";
import type { ColumnsType } from "antd/es/table";

function formatMoneyApprox(n: number) {
  return `~$${n.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function formatCostDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

export default function SuggestedOrderPage() {
  return (
    <LineProvider>
      <AppLayout>
        <SuggestedOrderContent />
      </AppLayout>
    </LineProvider>
  );
}

function SuggestedOrderContent() {
  const { message } = App.useApp();
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [loading, setLoading] = useState(false);
  const [distributorOrder, setDistributorOrder] = useState<DistributorSuggestedOrderResponse | null>(null);
  const [params, setParams] = useState({
    literTargetBoxes: 5,
    halfLiterTargetBoxes: 6,
    unitsPerBox: 12,
  });

  const load = async () => {
    try {
      setLoading(true);
      const res = await apiClient.getDistributorSuggestedOrder({
        literTargetBoxes: params.literTargetBoxes,
        halfLiterTargetBoxes: params.halfLiterTargetBoxes,
        unitsPerBox: params.unitsPerBox,
      });
      setDistributorOrder(res);
    } catch (err) {
      message.error("No se pudo generar el pedido sugerido");
      console.error(err);
      setDistributorOrder(null);
    } finally {
      setLoading(false);
    }
  };

  const copyText = async () => {
    if (!distributorOrder?.copyText) return;
    try {
      await navigator.clipboard.writeText(distributorOrder.copyText);
      message.success("Copiado al portapapeles");
    } catch {
      message.error("No se pudo copiar");
    }
  };

  const orderColumns: ColumnsType<DistributorSuggestedOrderItem> = useMemo(
    () => [
      {
        title: "Producto",
        dataIndex: "name",
        key: "name",
        ellipsis: { showTitle: true },
        minWidth: 200,
      },
      {
        title: "Formato",
        key: "format",
        width: 72,
        align: "center",
        onHeaderCell: () => ({
          style: { whiteSpace: "nowrap", textAlign: "center" as const, paddingInline: 8 },
        }),
        onCell: () => ({
          style: { whiteSpace: "nowrap", textAlign: "center" as const, paddingInline: 8 },
        }),
        render: (_: unknown, r) => {
          const label = r.format === "LITER" ? "1L" : "½L";
          return (
            <Tag
              color={r.format === "LITER" ? "blue" : "cyan"}
              style={{ margin: 0, lineHeight: "22px", padding: "0 6px", fontSize: 12 }}
            >
              {label}
            </Tag>
          );
        },
      },
      {
        title: "Stock",
        dataIndex: "currentStock",
        key: "stock",
        width: 72,
        align: "right",
        onHeaderCell: () => ({ style: { whiteSpace: "nowrap" } }),
        onCell: () => ({ style: { fontVariantNumeric: "tabular-nums" } }),
      },
      {
        title: "Obj. (u)",
        dataIndex: "targetUnits",
        key: "targetUnits",
        width: 80,
        align: "right",
        onHeaderCell: () => ({ style: { whiteSpace: "nowrap" } }),
        onCell: () => ({ style: { fontVariantNumeric: "tabular-nums" } }),
      },
      {
        title: "Pedido (u)",
        dataIndex: "suggestedUnits",
        key: "suggestedUnits",
        width: 88,
        align: "right",
        onHeaderCell: () => ({ style: { whiteSpace: "nowrap" } }),
        onCell: () => ({ style: { fontVariantNumeric: "tabular-nums" } }),
        render: (u: number) => <span style={{ color: u > 0 ? "#fbbf24" : undefined }}>{u}</span>,
      },
      {
        title: "Cajas",
        dataIndex: "suggestedBoxes",
        key: "suggestedBoxes",
        width: 64,
        align: "right",
        onHeaderCell: () => ({ style: { whiteSpace: "nowrap" } }),
        onCell: () => ({ style: { fontVariantNumeric: "tabular-nums" } }),
      },
      {
        title: "Costo u.",
        key: "unitCost",
        width: 100,
        align: "right",
        onHeaderCell: () => ({ style: { whiteSpace: "nowrap" } }),
        render: (_: unknown, r) => {
          if (r.unitCost == null) {
            return <span style={{ color: "#6b7280" }}>—</span>;
          }
          const d = formatCostDate(r.costRecordedAt);
          return (
            <div style={{ fontVariantNumeric: "tabular-nums", lineHeight: 1.25 }}>
              <div style={{ fontSize: 13 }}>{formatMoneyApprox(r.unitCost)}</div>
              {d && (
                <div style={{ fontSize: 10, color: "#6b7280" }} title="Fecha del registro de costo usado">
                  {d}
                </div>
              )}
            </div>
          );
        },
      },
      {
        title: "Aprox. línea",
        key: "lineApprox",
        width: 100,
        align: "right",
        onHeaderCell: () => ({ style: { whiteSpace: "nowrap" } }),
        render: (_: unknown, r) => {
          if (r.suggestedUnits === 0) {
            return <span style={{ color: "#4b5563" }}>—</span>;
          }
          if (r.lineApproximateTotal == null) {
            return <span style={{ color: "#6b7280" }}>—</span>;
          }
          return (
            <span style={{ color: "#34d399", fontVariantNumeric: "tabular-nums" }}>
              {formatMoneyApprox(r.lineApproximateTotal)}
            </span>
          );
        },
      },
      {
        title: "Estado",
        key: "baja",
        width: 72,
        align: "center",
        onHeaderCell: () => ({ style: { whiteSpace: "nowrap" } }),
        render: (_: unknown, r) =>
          r.isDeactivated ? (
            <Tag style={{ margin: 0, fontSize: 12 }}>baja</Tag>
          ) : (
            <span style={{ color: "#6b7280" }}>—</span>
          ),
      },
    ],
    [],
  );

  return (
    <div style={{ width: "100%", maxWidth: "100%", minWidth: 0, boxSizing: "border-box" }}>
      <div
        style={{
          marginBottom: "24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: isMobile ? "stretch" : "center",
          flexDirection: isMobile ? "column" : "row",
          gap: 12,
        }}
      >
        <h1 style={{ margin: 0, color: "#ffffff" }}>Pedido sugerido</h1>
        <Button type="primary" icon={<ShoppingCartOutlined />} onClick={load} loading={loading} block={isMobile}>
          Generar pedido
        </Button>
      </div>

      <ScreenInfoPanel title="Distribuidor — cerveza">
        Solo categoría Cerveza. Litro: objetivo en cajas (12 u/caja) para 1L; medio litro: otro objetivo en cajas para
        ½L. El pedido se redondea a cajas completas. Incluye productos dados de baja. Ajustá los valores y volvé a
        generar.
      </ScreenInfoPanel>

      <Card
        size="small"
        title={
          <span style={{ color: "#e5e7eb" }}>
            <ShoppingCartOutlined style={{ marginRight: 8 }} />
            Parámetros
          </span>
        }
        style={{
          marginTop: 20,
          marginBottom: 20,
          background: "#111827",
          borderColor: "#374151",
        }}
        styles={{ header: { borderBottomColor: "#374151" } }}
      >
        <div
          style={{
            display: "flex",
            gap: 16,
            marginBottom: 12,
            flexDirection: isMobile ? "column" : "row",
            alignItems: isMobile ? "stretch" : "center",
            flexWrap: isMobile ? undefined : "wrap",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ color: "#9ca3af" }}>Cajas obj. 1L</span>
            <InputNumber
              min={1}
              max={1000}
              value={params.literTargetBoxes}
              onChange={(v) => setParams((p) => ({ ...p, literTargetBoxes: v ?? 5 }))}
              style={{ width: isMobile ? "100%" : undefined }}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ color: "#9ca3af" }}>Cajas obj. ½L</span>
            <InputNumber
              min={1}
              max={1000}
              value={params.halfLiterTargetBoxes}
              onChange={(v) => setParams((p) => ({ ...p, halfLiterTargetBoxes: v ?? 6 }))}
              style={{ width: isMobile ? "100%" : undefined }}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ color: "#9ca3af" }}>U. por caja</span>
            <InputNumber
              min={1}
              max={1000}
              value={params.unitsPerBox}
              onChange={(v) => setParams((p) => ({ ...p, unitsPerBox: v ?? 12 }))}
              style={{ width: isMobile ? "100%" : undefined }}
            />
          </div>
        </div>

        {distributorOrder && (
          <>
            {distributorOrder.unknownFormat.length > 0 && (
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 12 }}
                message="Productos de cerveza sin clasificar 1L / ½L"
                description="No entran al cálculo de pedido. Renombrá o usá unidad L (litro) o ML (medio) en el producto, o
                incluí “litro”, “medio litro” o “500” en el nombre."
              />
            )}

            <div style={{ color: "#9ca3af", fontSize: 12, marginBottom: 8 }}>
              Parámetros: {distributorOrder.parameters.categoryName} — 1L:{" "}
              {distributorOrder.parameters.literTargetBoxes} cajas, ½L:{" "}
              {distributorOrder.parameters.halfLiterTargetBoxes} cajas, {distributorOrder.parameters.unitsPerBox}{" "}
              u/caja.
            </div>

            {distributorOrder.costSummary.orderLinesWithSuggestedUnits > 0 && (
              <div
                style={{
                  marginBottom: 12,
                  padding: 12,
                  borderRadius: 8,
                  background: "linear-gradient(135deg, #0c4a6e 0%, #0f172a 100%)",
                  border: "1px solid #0369a1",
                }}
              >
                <div style={{ color: "#e0f2fe", fontSize: 16, fontWeight: 700, marginBottom: 6 }}>
                  Costo aprox. del pedido: {formatMoneyApprox(distributorOrder.costSummary.approximateTotal)}
                </div>
                <p style={{ margin: 0, color: "#94a3b8", fontSize: 12, lineHeight: 1.45 }}>
                  {distributorOrder.costSummary.basis}
                </p>
                {distributorOrder.costSummary.orderLinesMissingCost > 0 && (
                  <Alert
                    type="warning"
                    showIcon
                    style={{ marginTop: 10 }}
                    message="Productos del pedido sin costo activo en el sistema"
                    description={distributorOrder.costSummary.missingCostProductNames.join(", ")}
                  />
                )}
              </div>
            )}

            <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
              <Button type="default" icon={<CopyOutlined />} onClick={copyText} block={isMobile}>
                Copiar texto (WhatsApp)
              </Button>
            </div>

            <Collapse
              size="small"
              defaultActiveKey={[]}
              bordered={false}
              style={{ marginBottom: 12, background: "transparent" }}
              items={[
                {
                  key: "preview",
                  label: <span style={{ color: "#9ca3af", fontSize: 13 }}>Ver vista previa del texto</span>,
                  children: (
                    <div
                      style={{
                        maxHeight: 220,
                        overflow: "auto",
                        padding: 10,
                        background: "#0f172a",
                        border: "1px solid #334155",
                        borderRadius: 6,
                        color: "#e5e7eb",
                        fontSize: 13,
                        whiteSpace: "pre-wrap",
                        fontFamily: "ui-monospace, monospace",
                      }}
                    >
                      {distributorOrder.copyText}
                    </div>
                  ),
                },
              ]}
            />

            <div
              style={{
                width: "100%",
                maxWidth: "100%",
                minWidth: 0,
                overflowX: "auto",
                WebkitOverflowScrolling: "touch",
                borderRadius: 6,
              }}
            >
              <Table<DistributorSuggestedOrderItem>
                size="small"
                tableLayout="auto"
                style={{ background: "#1f2937", minWidth: 860 }}
                pagination={false}
                dataSource={distributorOrder.items}
                rowKey="productId"
                scroll={{ x: 860 }}
                onRow={(record) => ({
                  style: record.suggestedUnits > 0 ? { background: "rgba(251, 191, 36, 0.06)" } : undefined,
                })}
                columns={orderColumns}
              />
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
