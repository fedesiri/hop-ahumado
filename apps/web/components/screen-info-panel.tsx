"use client";

import type { CSSProperties, ReactNode } from "react";
import { useState } from "react";

type ScreenInfoPanelProps = {
  title: string;
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
};

export function ScreenInfoPanel({ title, children, style, className }: ScreenInfoPanelProps) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className={`ha-collapse${open ? " is-open" : ""}${className ? " " + className : ""}`}
      style={{ marginBottom: 16, ...style }}
    >
      <div className="ha-collapse__head" onClick={() => setOpen(!open)}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ha-blue)" strokeWidth="2" style={{ flexShrink: 0 }}>
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <span>{title}</span>
        <svg className="ha-collapse__chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </div>
      {open && <div className="ha-collapse__body">{children}</div>}
    </div>
  );
}
