"use client";

import { useEffect, useRef, useState } from "react";
import { type ToastType } from "@/lib/toast";

interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration: number;
}

const DURATIONS: Record<ToastType, number> = {
  success: 4000,
  info: 4000,
  warning: 4000,
  error: 6000,
};

const ICONS: Record<ToastType, string> = {
  success: "✓",
  error: "✕",
  info: "ℹ",
  warning: "⚠",
};

const COLORS: Record<ToastType, string> = {
  success: "var(--ha-green)",
  error: "var(--ha-red)",
  info: "var(--ha-blue)",
  warning: "var(--ha-amber)",
};

function ToastEl({ item, onClose }: { item: ToastItem; onClose: () => void }) {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = barRef.current;
    if (!el) return;
    el.style.animation = `ha-toast-bar ${item.duration}ms linear forwards`;
    const t = setTimeout(onClose, item.duration);
    return () => clearTimeout(t);
  }, [item.duration, onClose]);

  const color = COLORS[item.type];

  return (
    <div
      className="ha-toast"
      style={{ "--ha-toast-accent": color } as React.CSSProperties}
    >
      <div className="ha-toast__ic" style={{ fontSize: 18 }}>
        {ICONS[item.type]}
      </div>
      <div className="ha-toast__body">
        <div className="ha-toast__msg">{item.title}</div>
        {item.description && (
          <div className="ha-toast__sub">{item.description}</div>
        )}
      </div>
      <button className="ha-toast__x" onClick={onClose} aria-label="Cerrar">
        ✕
      </button>
      <div ref={barRef} className="ha-toast__bar" />
    </div>
  );
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    function handler(e: Event) {
      const { type, title, description, duration } = (e as CustomEvent).detail;
      const id = crypto.randomUUID();
      setToasts((prev) => [
        ...prev,
        { id, type, title, description, duration: duration ?? DURATIONS[type as ToastType] },
      ]);
    }
    window.addEventListener("ha-toast", handler);
    return () => window.removeEventListener("ha-toast", handler);
  }, []);

  function remove(id: string) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  if (toasts.length === 0) return null;

  return (
    <div className="ha-toast-container">
      {toasts.map((t) => (
        <ToastEl key={t.id} item={t} onClose={() => remove(t.id)} />
      ))}
    </div>
  );
}
