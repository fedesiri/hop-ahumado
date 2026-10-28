"use client";

import { apiClient } from "@/lib/api-client";
import { pathForNotificationEntity } from "@/lib/notification-deeplink";
import { toast } from "@/lib/toast";
import type { UserNotificationRow } from "@/lib/types";
import { formatDistanceToNow } from "date-fns";
import { es as esLocale } from "date-fns/locale";
import { Bell, Boxes, UsersRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const POLL_DEFAULT_MS = 30_000;
const PAGE_SIZE = 30;
const LAPSED_EVENT = "crm.customer_lapsed";

function categoryIcon(eventType: string) {
  const color = "var(--ha-green)";
  if (eventType.startsWith("stock."))
    return <Boxes size={18} strokeWidth={2} color={color} style={{ flexShrink: 0 }} />;
  if (eventType.startsWith("crm."))
    return <UsersRound size={18} strokeWidth={2} color={color} style={{ flexShrink: 0 }} />;
  return <Bell size={18} strokeWidth={2} color={color} style={{ flexShrink: 0 }} />;
}

function relativeTime(iso: string): string {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: esLocale });
  } catch {
    return iso;
  }
}

export function NotificationsBell() {
  const router = useRouter();
  const pollMs = useMemo(
    () => Number(process.env.NEXT_PUBLIC_NOTIFICATIONS_POLL_INTERVAL_MS ?? POLL_DEFAULT_MS),
    [],
  );

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<UserNotificationRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  // Páginas siguientes a la primera; la primera se refresca con el polling sin perder lo ya cargado.
  const [extraRows, setExtraRows] = useState<UserNotificationRow[]>([]);
  const nextPageRef = useRef(2);
  const wrapRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.getNotifications(1, PAGE_SIZE, false);
      setRows(res.data);
      setTotal(res.meta.total);
      setUnreadCount(res.unreadCount);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMore = async () => {
    try {
      setLoadingMore(true);
      const res = await apiClient.getNotifications(nextPageRef.current, PAGE_SIZE, false);
      nextPageRef.current += 1;
      setExtraRows((prev) => [...prev, ...res.data]);
      setTotal(res.meta.total);
    } catch {
      toast.error("No se pudieron cargar más notificaciones");
    } finally {
      setLoadingMore(false);
    }
  };

  const allRows = useMemo(() => {
    const seen = new Set(rows.map((r) => r.id));
    return [...rows, ...extraRows.filter((r) => !seen.has(r.id))];
  }, [rows, extraRows]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (pollMs <= 0) return;
    const id = window.setInterval(() => void load(), pollMs);
    return () => window.clearInterval(id);
  }, [load, pollMs]);

  useEffect(() => {
    if (!open) return;
    function onOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [open]);

  const onMarkAll = async () => {
    try {
      await apiClient.markAllNotificationsRead();
      const now = new Date().toISOString();
      setExtraRows((prev) => prev.map((r) => ({ ...r, readAt: r.readAt ?? now })));
      toast.success("Todas marcadas como leídas");
      await load();
    } catch {
      toast.error("No se pudo marcar todo como leído");
    }
  };

  const onRowClick = async (row: UserNotificationRow) => {
    const path = pathForNotificationEntity(row.entityType, row.entityId);
    try {
      if (!row.readAt) {
        await apiClient.markNotificationRead(row.id);
        const now = new Date().toISOString();
        setExtraRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, readAt: now } : r)));
      }
    } catch {
      toast.error("No se pudo marcar como leída");
    }
    setOpen(false);
    router.push(path);
    void load();
  };

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <button
        className={`ha-bell${open ? " is-open" : ""}`}
        onClick={() => {
          if (open) {
            setExtraRows([]);
            nextPageRef.current = 2;
          }
          setOpen(!open);
          if (!open) void load();
        }}
        aria-label="Notificaciones"
      >
        <Bell size={20} strokeWidth={2} />
        {unreadCount > 0 && (
          <span className="ha-bell__badge">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="ha-notif">
          <div className="ha-notif__hd">
            <span className="ha-notif__title">Notificaciones</span>
            <button
              className="ha-notif__mark"
              disabled={unreadCount === 0}
              onClick={onMarkAll}
            >
              Marcar todas
            </button>
          </div>

          <div className="ha-notif__scroll">
            {loading ? (
              <>
                {[1, 2, 3].map((i) => (
                  <div key={i} className="ha-skelrow">
                    <div className="ha-skel__ic" />
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                      <div className="ha-skel" style={{ width: "70%" }} />
                      <div className="ha-skel" style={{ width: "40%" }} />
                    </div>
                  </div>
                ))}
              </>
            ) : allRows.length === 0 ? (
              <div className="ha-notif__empty">
                <Bell size={24} strokeWidth={1.5} />
                <span className="t">Sin notificaciones</span>
              </div>
            ) : (
              allRows.map((row) => {
                const unread = !row.readAt;
                const href = pathForNotificationEntity(row.entityType, row.entityId);
                return (
                  <Link
                    key={row.id}
                    href={href}
                    className={`ha-nrow${unread ? " unread" : ""}`}
                    onClick={(e) => { e.preventDefault(); void onRowClick(row); }}
                  >
                    <div className="ha-nrow__ic">{categoryIcon(row.eventType)}</div>
                    <div className="ha-nrow__mid">
                      <div className={`ha-nrow__msg${unread ? " unread" : ""}`}>
                        {row.message}
                      </div>
                      <div className="ha-nrow__time">{relativeTime(row.createdAt)}</div>
                    </div>
                    {unread && <div className="ha-nrow__dot" />}
                  </Link>
                );
              })
            )}
          </div>

          {allRows.length < total && (
            <button className="ha-notif__mark" style={{ width: "100%", padding: "10px 0" }} disabled={loadingMore} onClick={() => void loadMore()}>
              {loadingMore ? "Cargando…" : `Ver más (${total - allRows.length} restantes)`}
            </button>
          )}
          {allRows.some((r) => r.eventType === LAPSED_EVENT) && (
            <Link
              href="/crm?lapsedWholesale=true"
              className="ha-notif__mark"
              style={{ display: "block", textAlign: "center", padding: "10px 0" }}
              onClick={() => setOpen(false)}
            >
              Ver mayoristas sin comprar
            </Link>
          )}
          <div className="ha-notif__ft">
            Actualiza cada {Math.round(pollMs / 1000)}s
          </div>
        </div>
      )}
    </div>
  );
}
