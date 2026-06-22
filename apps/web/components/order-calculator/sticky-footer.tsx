"use client";

import { formatCurrency } from "@/lib/format-currency";
import { CheckCircle, Copy, RotateCcw, Trash2 } from "lucide-react";

interface StickyFooterProps {
  total: number;
  hasItems: boolean;
  onCopy: () => void;
  onClear: () => void;
  onNewOrder: () => void;
  onConfirmOrder?: () => void;
  confirmButtonLabel?: string;
  footerNote?: string;
}

export function StickyFooter({
  total,
  hasItems,
  onCopy,
  onClear,
  onNewOrder,
  onConfirmOrder,
  confirmButtonLabel = "Confirmar pedido (descontar stock)",
  footerNote,
}: StickyFooterProps) {
  return (
    <div className="oc-footer">
      <div className="oc-finner">
        <div className="oc-totrow">
          <span className="oc-totlbl">Total</span>
          <span className={`oc-totamt ha-mono${total > 0 ? " pos" : ""}`}>
            {formatCurrency(total)}
          </span>
        </div>
        {footerNote && <p className="oc-promo">{footerNote}</p>}
        <div className="oc-actions">
          <button className="oc-iconbtn" onClick={onNewOrder} title="Nueva orden">
            <RotateCcw size={17} />
          </button>
          <button className="oc-iconbtn" onClick={onClear} disabled={!hasItems} title="Limpiar">
            <Trash2 size={17} />
          </button>
          <button
            className="oc-btn oc-btn--primary oc-grow"
            onClick={onCopy}
            disabled={!hasItems}
          >
            <Copy size={15} />
            Copiar pedido
          </button>
          {onConfirmOrder && (
            <button
              className="oc-btn oc-btn--success oc-grow"
              onClick={onConfirmOrder}
              disabled={!hasItems}
            >
              <CheckCircle size={15} />
              {confirmButtonLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
