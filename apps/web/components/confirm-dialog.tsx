import type { ReactNode } from "react";

interface ConfirmDialogProps {
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  description,
  confirmLabel = "Eliminar",
  destructive = true,
  loading,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <div className="ha-dialog-back" onClick={onCancel}>
      <div className="ha-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="ha-dialog__head">
          <h3 className="ha-dialog__title">{title}</h3>
          {description && <p className="ha-dialog__sub">{description}</p>}
        </div>
        <div className="ha-dialog__foot">
          <button className="ha-btn ha-btn--secondary" onClick={onCancel}>Cancelar</button>
          <button
            className={"ha-btn " + (destructive ? "ha-btn--destructive" : "ha-btn--primary")}
            disabled={loading}
            onClick={onConfirm}
          >
            {loading ? "Guardando…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
