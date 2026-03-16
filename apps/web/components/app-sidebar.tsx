"use client";

import {
  AppstoreOutlined,
  BgColorsOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  DollarOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  ShoppingCartOutlined,
  ShoppingOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";
import type { MenuProps } from "antd";
import { Button, Layout, Menu } from "antd";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

interface AppSidebarProps {
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  isMobile?: boolean;
}

const { Sider } = Layout;

const menuItems: MenuProps["items"] = [
  { key: "/", icon: <DashboardOutlined />, label: "Inicio" },
  { key: "divider-1", type: "divider" },
  { key: "/categories", icon: <AppstoreOutlined />, label: "Categorías" },
  { key: "/products", icon: <ShoppingOutlined />, label: "Productos" },
  {
    key: "crm",
    icon: <TeamOutlined />,
    label: "CRM",
    children: [
      { key: "/crm", label: "Clientes" },
      { key: "/crm/dashboard", label: "Dashboard" },
    ],
  },
  { key: "divider-2", type: "divider" },
  {
    key: "orders",
    icon: <ShoppingCartOutlined />,
    label: "Órdenes",
    children: [
      { key: "/orders", label: "Listado" },
      { key: "/orders/calculator", label: "Calculadora de pedidos" },
    ],
  },
  { key: "/prices", icon: <DollarOutlined />, label: "Precios" },
  { key: "/costs", icon: <DollarOutlined />, label: "Costos" },
  { key: "divider-3", type: "divider" },
  { key: "/stock", icon: <DatabaseOutlined />, label: "Stock" },
  { key: "/recipes", icon: <BgColorsOutlined />, label: "Recetas" },
  { key: "/users", icon: <UserOutlined />, label: "Usuarios" },
];

export function AppSidebar({ collapsed = false, onCollapsedChange, isMobile = false }: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const selectedKey = pathname || "/";

  const pathBasedOpenKeys = useMemo(
    () =>
      [pathname?.startsWith("/crm") && "crm", pathname?.startsWith("/orders") && "orders"].filter(Boolean) as string[],
    [pathname],
  );

  const [openKeys, setOpenKeys] = useState<string[]>(pathBasedOpenKeys);
  useEffect(() => {
    setOpenKeys(pathBasedOpenKeys);
  }, [pathBasedOpenKeys]);

  const handleMenuClick: MenuProps["onClick"] = (e) => {
    if (e.key.startsWith("/")) {
      router.push(e.key);
      if (isMobile) onCollapsedChange?.(true);
    }
  };

  const menuContent = (
    <Menu
      mode="inline"
      selectedKeys={[selectedKey]}
      openKeys={openKeys}
      onOpenChange={setOpenKeys}
      items={menuItems}
      onClick={handleMenuClick}
      style={{ borderRight: "none" }}
    />
  );

  if (isMobile) {
    return menuContent;
  }

  return (
    <Sider
      trigger={null}
      collapsible
      collapsed={collapsed}
      width={250}
      collapsedWidth={80}
      style={{
        height: "100vh",
        position: "fixed",
        left: 0,
        top: 0,
        bottom: 0,
        backgroundColor: "#111111",
      }}
    >
      <div
        style={{
          padding: "24px 0",
          textAlign: "center",
          color: "#22c55e",
          fontSize: collapsed ? "14px" : "20px",
          fontWeight: "bold",
          marginBottom: "16px",
          whiteSpace: "nowrap",
          overflow: "hidden",
        }}
      >
        {collapsed ? "HA" : "Hop Ahumado"}
      </div>
      {menuContent}
    </Sider>
  );
}

export function ToggleSidebarButton({ collapsed, onClick }: { collapsed: boolean; onClick: () => void }) {
  return (
    <Button
      type="text"
      icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
      onClick={onClick}
      style={{ fontSize: "16px" }}
    />
  );
}
