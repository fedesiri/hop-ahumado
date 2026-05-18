"use client";

import { classifyBeerFormat, compareBeerFormatThenName, type ClassifiedBeerFormat } from "@/lib/beer-format.util";
import { parseStockQuantity } from "@/lib/format-box-quantity";
import { formatQuantity } from "@/lib/format-currency";
import type { StockBalanceRow } from "@/lib/types";
import { ProductUnit } from "@/lib/types";
import { InboxOutlined, SearchOutlined } from "@ant-design/icons";
import { Badge, Button, Empty, Input, Modal, Spin, Tag, Typography } from "antd";
import { useMemo, useState } from "react";

const { Text } = Typography;

const SECTIONS: {
  key: ClassifiedBeerFormat;
  title: string;
  short: string;
  accent: string;
  tagColor: string;
}[] = [
  { key: "HALF_LITER", title: "Medio litro", short: "½L", accent: "#0891b2", tagColor: "cyan" },
  { key: "LITER", title: "Litro", short: "1L", accent: "#2563eb", tagColor: "blue" },
  { key: "UNKNOWN", title: "Otros productos", short: "—", accent: "#64748b", tagColor: "default" },
];

const PANEL = {
  borderRadius: 10,
  border: "1px solid #334155",
  background: "#0f172a",
  overflow: "hidden" as const,
};

const HEADER_ROW = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) minmax(108px, auto)",
  gap: 16,
  padding: "10px 16px",
  background: "#1e293b",
  borderBottom: "1px solid #334155",
  position: "sticky" as const,
  top: 0,
  zIndex: 1,
};

type LocationStockModalProps = {
  open: boolean;
  locationName: string | null;
  loading: boolean;
  balances: StockBalanceRow[];
  onClose: () => void;
};

function StockQuantityCell({ quantity, unit }: { quantity: number; unit: ProductUnit }) {
  const parsed = parseStockQuantity(quantity, unit);

  if (parsed.kind === "other") {
    return (
      <span
        style={{
          display: "inline-block",
          padding: "4px 10px",
          borderRadius: 6,
          background: "#1f2937",
          border: "1px solid #374151",
          color: "#f3f4f6",
          fontSize: 13,
          fontWeight: 600,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {parsed.sign}
        {parsed.label}
      </span>
    );
  }

  const chips: { key: string; label: string; primary?: boolean }[] = [];
  if (parsed.boxes > 0) {
    chips.push({
      key: "boxes",
      label: `${parsed.boxes} ${parsed.boxes === 1 ? "caja" : "cajas"}`,
      primary: true,
    });
  }
  if (parsed.units > 0) {
    chips.push({ key: "units", label: `${parsed.units} u` });
  }
  if (chips.length === 0 && parsed.frac < 1e-6) {
    chips.push({ key: "zero", label: "0 u" });
  }
  if (parsed.frac >= 1e-6) {
    chips.push({ key: "frac", label: `${formatQuantity(parsed.frac)} u` });
  }

  const emphasize = chips.length === 1;

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "flex-end" }}>
      {parsed.sign ? (
        <span style={{ color: "#f87171", fontWeight: 700, alignSelf: "center" }}>{parsed.sign}</span>
      ) : null}
      {chips.map((chip) => {
        const primary = chip.primary || emphasize;
        return (
          <span
            key={chip.key}
            style={{
              padding: "4px 10px",
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 600,
              fontVariantNumeric: "tabular-nums",
              whiteSpace: "nowrap",
              background: primary ? "rgba(37, 99, 235, 0.2)" : "#1f2937",
              border: primary ? "1px solid rgba(59, 130, 246, 0.45)" : "1px solid #374151",
              color: primary ? "#bfdbfe" : "#e5e7eb",
            }}
          >
            {chip.label}
          </span>
        );
      })}
    </div>
  );
}

export function LocationStockModal({ open, locationName, loading, balances, onClose }: LocationStockModalProps) {
  const [filter, setFilter] = useState("");

  const handleClose = () => {
    setFilter("");
    onClose();
  };

  const nonzeroBalances = useMemo(() => balances.filter((r) => Math.abs(Number(r.quantity)) > 1e-6), [balances]);

  const displayedBalances = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const filtered = q
      ? nonzeroBalances.filter((r) => (r.product?.name ?? r.productId).toLowerCase().includes(q))
      : nonzeroBalances;

    return [...filtered].sort((a, b) => {
      const nameA = a.product?.name ?? a.productId;
      const nameB = b.product?.name ?? b.productId;
      const unitA = a.product?.unit ?? ProductUnit.UNIT;
      const unitB = b.product?.unit ?? ProductUnit.UNIT;
      return compareBeerFormatThenName({ name: nameA, unit: unitA }, { name: nameB, unit: unitB });
    });
  }, [nonzeroBalances, filter]);

  const balancesBySection = useMemo(() => {
    const map = new Map<ClassifiedBeerFormat, StockBalanceRow[]>();
    for (const section of SECTIONS) {
      map.set(section.key, []);
    }
    for (const row of displayedBalances) {
      const name = row.product?.name ?? row.productId;
      const unit = row.product?.unit ?? ProductUnit.UNIT;
      const format = classifyBeerFormat(name, unit);
      map.get(format)!.push(row);
    }
    return map;
  }, [displayedBalances]);

  const hasUnitProducts = nonzeroBalances.some((r) => (r.product?.unit ?? ProductUnit.UNIT) === ProductUnit.UNIT);
  const visibleSections = SECTIONS.filter((s) => (balancesBySection.get(s.key)?.length ?? 0) > 0);

  return (
    <Modal
      title={
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#f9fafb" }}>
            {locationName ? `Stock en «${locationName}»` : "Stock por ubicación"}
          </div>
          {!loading && nonzeroBalances.length > 0 ? (
            <Text type="secondary" style={{ fontSize: 13, fontWeight: 400 }}>
              {nonzeroBalances.length} producto{nonzeroBalances.length === 1 ? "" : "s"} con stock
            </Text>
          ) : null}
        </div>
      }
      open={open}
      onCancel={handleClose}
      destroyOnClose
      footer={
        <Button type="primary" onClick={handleClose}>
          Cerrar
        </Button>
      }
      width="min(680px, calc(100vw - 24px))"
      styles={{
        body: { paddingTop: 4, paddingBottom: 8 },
        content: { paddingBottom: 12 },
      }}
    >
      {loading ? (
        <div style={{ textAlign: "center", padding: "48px 0" }}>
          <Spin size="large" />
        </div>
      ) : nonzeroBalances.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="No hay stock en esta ubicación"
          style={{ padding: "32px 0" }}
        />
      ) : (
        <>
          <Input
            allowClear
            size="large"
            prefix={<SearchOutlined style={{ color: "#64748b" }} />}
            placeholder="Buscar producto…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{ marginBottom: 12 }}
            aria-label="Filtrar productos"
          />

          {hasUnitProducts ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 12,
                padding: "8px 12px",
                borderRadius: 8,
                background: "#1e293b",
                border: "1px solid #334155",
              }}
            >
              <InboxOutlined style={{ color: "#60a5fa" }} />
              <Text style={{ color: "#94a3b8", fontSize: 13, margin: 0 }}>
                Unidades en cajas de <strong style={{ color: "#e2e8f0" }}>12</strong>
              </Text>
            </div>
          ) : null}

          {displayedBalances.length === 0 ? (
            <Empty description="Ningún producto coincide con la búsqueda" style={{ padding: "24px 0" }} />
          ) : (
            <div className="app-panel-scroll" style={{ ...PANEL, maxHeight: "min(58vh, 520px)", overflowY: "auto" }}>
              <div style={HEADER_ROW}>
                <Text style={{ color: "#94a3b8", fontSize: 12, fontWeight: 600 }}>Producto</Text>
                <Text style={{ color: "#94a3b8", fontSize: 12, fontWeight: 600, textAlign: "right" }}>Cantidad</Text>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 20, padding: "16px 12px 20px" }}>
                {visibleSections.map((section) => {
                  const rows = balancesBySection.get(section.key) ?? [];

                  return (
                    <section
                      key={section.key}
                      style={{
                        borderRadius: 8,
                        overflow: "hidden",
                        border: "1px solid #334155",
                        background: "#131c2e",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 12,
                          padding: "10px 16px",
                          background: "#162032",
                          borderLeft: `3px solid ${section.accent}`,
                          borderBottom: "1px solid #293548",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                          {section.key !== "UNKNOWN" ? (
                            <Tag color={section.tagColor} style={{ margin: 0, fontWeight: 600 }}>
                              {section.short}
                            </Tag>
                          ) : null}
                          <Text style={{ color: "#e2e8f0", fontWeight: 600, fontSize: 13 }}>{section.title}</Text>
                        </div>
                        <Badge
                          count={rows.length}
                          showZero
                          color={section.accent}
                          style={{ color: "#fff" }}
                          styles={{ indicator: { fontSize: 11, minWidth: 20, height: 20, lineHeight: "20px" } }}
                        />
                      </div>

                      {rows.map((row, rowIndex) => {
                        const name = row.product?.name ?? row.productId;
                        const unit = row.product?.unit ?? ProductUnit.UNIT;
                        const isLastRow = rowIndex === rows.length - 1;

                        return (
                          <div
                            key={row.id}
                            style={{
                              display: "grid",
                              gridTemplateColumns: "minmax(0, 1fr) minmax(108px, auto)",
                              gap: 16,
                              alignItems: "center",
                              padding: "12px 16px",
                              background: rowIndex % 2 === 1 ? "rgba(30, 41, 59, 0.35)" : "transparent",
                              borderBottom: isLastRow ? undefined : "1px solid #1e293b",
                            }}
                          >
                            <Text
                              style={{
                                color: "#f1f5f9",
                                fontSize: 14,
                                lineHeight: 1.4,
                                wordBreak: "break-word",
                              }}
                            >
                              {name}
                            </Text>
                            <StockQuantityCell quantity={Number(row.quantity)} unit={unit} />
                          </div>
                        );
                      })}
                    </section>
                  );
                })}
              </div>
            </div>
          )}

          {displayedBalances.length > 0 && filter.trim() ? (
            <Text type="secondary" style={{ display: "block", marginTop: 10, fontSize: 12, textAlign: "center" }}>
              Mostrando {displayedBalances.length} de {nonzeroBalances.length}
            </Text>
          ) : null}
        </>
      )}
    </Modal>
  );
}
