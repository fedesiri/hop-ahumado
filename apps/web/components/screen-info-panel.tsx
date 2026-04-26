"use client";

import { InfoCircleOutlined } from "@ant-design/icons";
import { Collapse } from "antd";
import type { CSSProperties, ReactNode } from "react";

const defaultRootStyle: CSSProperties = {
  marginBottom: 16,
  background: "#111827",
  border: "1px solid #2d3748",
  borderRadius: 8,
  overflow: "hidden",
};

type ScreenInfoPanelProps = {
  /** Título de la sección plegable (barra de encabezado). */
  title: string;
  children: ReactNode;
  style?: CSSProperties;
  /** Ajuste fino de estilos del Collapse (Ant Design 5+). */
  className?: string;
};

/**
 * Texto informativo plegable: cerrado por defecto; el usuario abre para leer.
 */
export function ScreenInfoPanel({ title, children, style, className }: ScreenInfoPanelProps) {
  return (
    <Collapse
      className={className}
      defaultActiveKey={[]}
      expandIconPosition="end"
      bordered={false}
      size="small"
      style={{ ...defaultRootStyle, ...style }}
      items={[
        {
          key: "info",
          label: (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <InfoCircleOutlined style={{ color: "#3b82f6", fontSize: 16 }} />
              <span>{title}</span>
            </span>
          ),
          children: (
            <div
              style={{
                lineHeight: 1.65,
                color: "rgba(255, 255, 255, 0.88)",
                borderTop: "1px solid #2d3748",
                paddingTop: 10,
                paddingBottom: 2,
              }}
            >
              {children}
            </div>
          ),
        },
      ]}
    />
  );
}
