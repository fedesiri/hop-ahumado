import type { CSSProperties } from "react";

interface EmptyStateProps {
  title: string;
  subtitle?: string;
  style?: CSSProperties;
}

export function EmptyState({ title, subtitle, style }: EmptyStateProps) {
  return (
    <div className="ha-empty" style={style}>
      <p className="ha-empty__t">{title}</p>
      {subtitle && <p className="ha-empty__s">{subtitle}</p>}
    </div>
  );
}
