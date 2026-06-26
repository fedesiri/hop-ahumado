"use client";

import {
  ArrowLeftRight,
  BarChart2,
  ClipboardList,
  PanelLeftClose,
  PanelLeftOpen,
  DollarSign,
  FilePlus,
  FlaskConical,
  LayoutGrid,
  List,
  LogOut,
  MapPin,
  Menu,
  Moon,
  ShoppingBag,
  Sun,
  Tag,
  TrendingDown,
  TrendingUp,
  UserCog,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useLineContext } from "@/lib/line-context";
import { BusinessLine } from "@/lib/types";
import { BusinessLineSelector } from "./business-line-selector";
import { NotificationsBell } from "./notifications-bell";

type NavItem = { type: "item"; path: string; label: string; icon: ReactNode; sub?: boolean };
type NavDivider = { type: "divider"; key: string };
type NavGroup = { type: "group"; label: string; key: string };
type NavRow = NavItem | NavDivider | NavGroup;

const navRows: NavRow[] = [
  { type: "item", path: "/", label: "Inicio", icon: <LayoutGrid size={18} /> },
  { type: "divider", key: "d1" },
  { type: "item", path: "/categories", label: "Categorías", icon: <LayoutGrid size={18} /> },
  { type: "item", path: "/products", label: "Productos", icon: <ShoppingBag size={18} /> },
  { type: "group", label: "CRM", key: "g-crm" },
  { type: "item", path: "/crm", label: "Clientes", icon: <Users size={18} />, sub: true },
  { type: "item", path: "/crm/dashboard", label: "Dashboard", icon: <BarChart2 size={18} />, sub: true },
  { type: "divider", key: "d2" },
  { type: "group", label: "Órdenes", key: "g-orders" },
  { type: "item", path: "/orders", label: "Listado", icon: <List size={18} />, sub: true },
  { type: "item", path: "/orders/calculator", label: "Nueva orden", icon: <FilePlus size={18} />, sub: true },
  { type: "item", path: "/orders/metrics", label: "Métricas", icon: <TrendingUp size={18} />, sub: true },
  { type: "item", path: "/prices", label: "Precios", icon: <Tag size={18} /> },
  { type: "item", path: "/costs", label: "Costos", icon: <DollarSign size={18} /> },
  { type: "item", path: "/expenses", label: "Egresos", icon: <TrendingDown size={18} /> },
  { type: "divider", key: "d3" },
  { type: "group", label: "Stock", key: "g-stock" },
  { type: "item", path: "/stock", label: "Movimientos", icon: <ArrowLeftRight size={18} />, sub: true },
  { type: "item", path: "/stock/locations", label: "Ubicaciones", icon: <MapPin size={18} />, sub: true },
  { type: "item", path: "/stock/suggested-order", label: "Pedido sugerido", icon: <ClipboardList size={18} />, sub: true },
  { type: "item", path: "/recipes", label: "Recetas", icon: <FlaskConical size={18} /> },
  { type: "item", path: "/users", label: "Usuarios", icon: <UserCog size={18} /> },
];

function SidebarNav({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="ha-nav">
      {navRows.map((row) => {
        if (row.type === "divider") return <div key={row.key} className="ha-nav__divider" />;
        if (row.type === "group") return <div key={row.key} className="ha-nav__group">{row.label}</div>;
        const active = (() => {
          if (row.path === "/") return pathname === "/";
          if (pathname === row.path) return true;
          if (pathname.startsWith(row.path + "/")) {
            const moreSpecific = navRows.some(
              (r) =>
                r.type === "item" &&
                r.path !== row.path &&
                r.path.length > row.path.length &&
                (pathname === r.path || pathname.startsWith(r.path + "/")),
            );
            return !moreSpecific;
          }
          return false;
        })();
        return (
          <Link
            key={row.path}
            href={row.path}
            className={`ha-nav__item${row.sub ? " is-sub" : ""}${active ? " is-active" : ""}`}
            onClick={onNavigate}
          >
            <span className="ha-nav__icon">{row.icon}</span>
            <span className="ha-nav__label">{row.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function AppLayout({ children }: { children: ReactNode }) {
  useEffect(() => {
    console.log("[AppLayout] mounted");
    return () => console.log("[AppLayout] unmounted");
  }, []);

  const pathname = usePathname();
  const { selectedLine } = useLineContext();
  const brandLogo = selectedLine === BusinessLine.MEAT ? "/logo-alumo.png" : "/logo-hop.png";
  const brandName = selectedLine === BusinessLine.MEAT ? "Alumo" : "Hop";
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("ha-sidebar-collapsed") === "true";
    return false;
  });
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("ha-theme") as "dark" | "light" | null;
      if (saved === "dark" || saved === "light") return saved;
    }
    return "light";
  });

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("ha-theme", next);
  };

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem("ha-sidebar-collapsed", String(next));
      return next;
    });
  };

  const closeMobileNav = () => setMobileNavOpen(false);

  return (
    <div
      className={`ha-app${collapsed ? " is-collapsed" : ""}`}
      data-theme={theme}
    >
      {/* Desktop sidebar */}
      <aside className="ha-sidebar">
        <div className="ha-sidebar__brand">
          <div className="ha-logo">
            <img src={brandLogo} alt={brandName} style={{ width: "76%", height: "76%", objectFit: "contain" }} />
          </div>
          <div className="ha-brandtext">{brandName}</div>
        </div>
        <SidebarNav pathname={pathname} />
      </aside>

      {/* Header */}
      <header className="ha-header">
        {/* Mobile hamburger */}
        <button
          className="ha-hamburger"
          onClick={() => setMobileNavOpen(true)}
          aria-label="Abrir menú"
        >
          <Menu size={22} />
        </button>

        {/* Desktop collapse toggle */}
        <button
          className="ha-sidetoggle"
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expandir menú" : "Contraer menú"}
        >
          {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>

        <div className="ha-header__spacer" />

        <BusinessLineSelector />
        <NotificationsBell />
        <HeaderUserMenu theme={theme} onToggleTheme={toggleTheme} />
      </header>

      {/* Page content */}
      <main className="ha-content">{children}</main>

      {/* Mobile sidebar overlay */}
      {mobileNavOpen && (
        <div className="ha-msidebar">
          <div className="ha-msidebar__back" onClick={closeMobileNav} />
          <div className="ha-msidebar__panel">
            <div className="ha-sidebar__brand">
              <div className="ha-logo">
                <img src={brandLogo} alt={brandName} style={{ width: "76%", height: "76%", objectFit: "contain" }} />
              </div>
              <div className="ha-brandtext">{brandName}</div>
              <button
                className="ha-iconbtn"
                style={{ marginLeft: "auto" }}
                onClick={closeMobileNav}
                aria-label="Cerrar menú"
              >
                <X size={18} />
              </button>
            </div>
            <SidebarNav pathname={pathname} onNavigate={closeMobileNav} />
          </div>
        </div>
      )}
    </div>
  );
}

function HeaderUserMenu({
  theme,
  onToggleTheme,
}: {
  theme: "dark" | "light";
  onToggleTheme: () => void;
}) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const initials = (user?.name || user?.email || "U")[0].toUpperCase();

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div
        className="ha-avatar"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: 34, height: 34, borderRadius: "50%",
          background: "linear-gradient(135deg, var(--ha-amber), var(--ha-amber-deep))",
          display: "grid", placeItems: "center",
          color: "#0f1117", fontWeight: 700, fontSize: 13,
          cursor: "pointer", flexShrink: 0,
        }}
      >
        {initials}
      </div>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 8px)", right: 0,
          background: "var(--ha-bg-card)", border: "1px solid var(--ha-border-2)",
          borderRadius: 10, minWidth: 180, boxShadow: "0 12px 32px rgba(0,0,0,.4)",
          zIndex: 50, overflow: "hidden",
        }}>
          <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--ha-border)" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ha-text)" }}>
              {user?.name || user?.email || "Usuario"}
            </div>
            {user?.email && user?.name && (
              <div style={{ fontSize: 12, color: "var(--ha-text-3)", marginTop: 2 }}>{user.email}</div>
            )}
          </div>
          <button
            onClick={onToggleTheme}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              width: "100%", padding: "10px 14px", border: "none",
              background: "transparent", color: "var(--ha-text-2)",
              fontSize: 13, cursor: "pointer", textAlign: "left",
            }}
          >
            {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />} {theme === "dark" ? "Modo claro" : "Modo oscuro"}
          </button>
          <button
            onClick={() => { router.push("/users"); setOpen(false); }}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              width: "100%", padding: "10px 14px", border: "none",
              background: "transparent", color: "var(--ha-text-2)",
              fontSize: 13, cursor: "pointer", textAlign: "left",
            }}
          >
            <UserCog size={15} /> Usuarios
          </button>
          <div style={{ height: 1, background: "var(--ha-border)", margin: "4px 0" }} />
          <button
            onClick={async () => { setOpen(false); await logout(); }}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              width: "100%", padding: "10px 14px", border: "none",
              background: "transparent", color: "var(--ha-red)",
              fontSize: 13, cursor: "pointer", textAlign: "left",
            }}
          >
            <LogOut size={15} /> Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}
