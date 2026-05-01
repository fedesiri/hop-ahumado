"use client";

import { apiClient } from "@/lib/api-client";
import { pathForNotificationEntity } from "@/lib/notification-deeplink";
import type { UserNotificationRow } from "@/lib/types";
import { useMediaQuery } from "@/lib/use-media-query";
import { App, Badge, Button, Divider, Dropdown, Empty, Spin, Typography } from "antd";
import type { Locale } from "date-fns";
import { formatDistanceToNow } from "date-fns";
import { es as esLocale } from "date-fns/locale";
import { Bell, BellDot, Boxes, UsersRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useState } from "react";

const POLL_DEFAULT_MS = 30_000;

function categoryIcon(eventType: string): React.ReactNode {
  const color = "#22c55e";
  if (eventType.startsWith("stock.")) {
    return <Boxes size={18} strokeWidth={2} style={{ flexShrink: 0, color }} />;
  }
  if (eventType.startsWith("crm.")) {
    return <UsersRound size={18} strokeWidth={2} style={{ flexShrink: 0, color }} />;
  }
  return <Bell size={18} strokeWidth={2} style={{ flexShrink: 0, color }} />;
}

function relativeTime(iso: string, locale: Locale): string {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true, locale });
  } catch {
    return iso;
  }
}

export function NotificationsBell() {
  const { message } = App.useApp();
  const router = useRouter();
  const isMobile = useMediaQuery("(max-width: 768px)");
  const pollMs = useMemo(() => Number(process.env.NEXT_PUBLIC_NOTIFICATIONS_POLL_INTERVAL_MS ?? POLL_DEFAULT_MS), []);

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<UserNotificationRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.getNotifications(1, 30, false);
      setRows(res.data);
      setUnreadCount(res.unreadCount);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (pollMs <= 0) return;
    const id = window.setInterval(() => {
      void load();
    }, pollMs);
    return () => window.clearInterval(id);
  }, [load, pollMs]);

  const onMarkAll = async () => {
    try {
      await apiClient.markAllNotificationsRead();
      message.success("Listo");
      await load();
    } catch {
      message.error("No se pudo marcar todo como leído");
    }
  };

  const onRowClick = async (row: UserNotificationRow) => {
    const path = pathForNotificationEntity(row.entityType, row.entityId);
    try {
      if (!row.readAt) {
        await apiClient.markNotificationRead(row.id);
      }
    } catch {
      message.error("No se pudo marcar como leída");
    }
    setOpen(false);
    router.push(path);
    void load();
  };

  const dropdownContent = (
    <div
      style={{
        width: isMobile ? Math.min(360, typeof window !== "undefined" ? window.innerWidth - 24 : 360) : 380,
        maxHeight: 420,
        overflow: "auto",
        background: "#111111",
        border: "1px solid #2d3748",
        borderRadius: 8,
        boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 12px",
          position: "sticky",
          top: 0,
          background: "#111111",
          zIndex: 1,
          borderBottom: "1px solid #1f2937",
        }}
      >
        <Typography.Text strong style={{ color: "#fff" }}>
          Notificaciones
        </Typography.Text>
        <Button type="link" size="small" onClick={onMarkAll} disabled={unreadCount === 0}>
          Marcar todas como leídas
        </Button>
      </div>
      {loading ? (
        <div style={{ padding: 24, textAlign: "center" }}>
          <Spin />
        </div>
      ) : rows.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Sin notificaciones" style={{ margin: 16 }} />
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {rows.map((row) => {
            const unread = !row.readAt;
            const href = pathForNotificationEntity(row.entityType, row.entityId);
            return (
              <li key={row.id} style={{ borderBottom: "1px solid #1f2937" }}>
                <Link
                  href={href}
                  className="notification-row-link"
                  onClick={(e) => {
                    e.preventDefault();
                    void onRowClick(row);
                  }}
                  style={{
                    display: "flex",
                    gap: 10,
                    padding: "10px 12px",
                    cursor: "pointer",
                    textDecoration: "none",
                    color: "#e5e7eb",
                    background: unread ? "rgba(34,197,94,0.06)" : "transparent",
                  }}
                >
                  {categoryIcon(row.eventType)}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Typography.Text style={{ color: "#fff", display: "block", fontWeight: unread ? 600 : 400 }}>
                      {row.message}
                    </Typography.Text>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      {relativeTime(row.createdAt, esLocale)}
                    </Typography.Text>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <Divider style={{ margin: 0 }} />
      <div style={{ padding: 8, textAlign: "center" }}>
        <Typography.Text type="secondary" style={{ fontSize: 11 }}>
          Actualización cada {Math.round(pollMs / 1000)}s
        </Typography.Text>
      </div>
    </div>
  );

  return (
    <Dropdown
      open={open}
      trigger={["click"]}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) void load();
      }}
      placement="bottomRight"
      dropdownRender={() => dropdownContent}
    >
      <span style={{ display: "inline-flex", cursor: "pointer", alignItems: "center" }}>
        <Badge count={unreadCount} size="small" offset={[-2, 2]}>
          <Button
            type="text"
            aria-label="Notificaciones"
            icon={
              unreadCount > 0 ? (
                <BellDot size={22} color="#e5e7eb" strokeWidth={2} />
              ) : (
                <Bell size={20} color="#e5e7eb" strokeWidth={2} />
              )
            }
            style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}
          />
        </Badge>
      </span>
    </Dropdown>
  );
}
