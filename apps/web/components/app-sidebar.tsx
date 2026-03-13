'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Layout, Menu, Button, Drawer } from 'antd'
import {
  DashboardOutlined,
  AppstoreOutlined,
  ShoppingOutlined,
  UserOutlined,
  ReconciliationOutlined,
  DollarOutlined,
  ShoppingCartOutlined,
  DatabaseOutlined,
  FileTextOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  BgColorsOutlined,
} from '@ant-design/icons'
import type { MenuProps } from 'antd'

interface AppSidebarProps {
  collapsed?: boolean
  onCollapsedChange?: (collapsed: boolean) => void
  isMobile?: boolean
}

const { Sider } = Layout

const menuItems: MenuProps['items'] = [
  {
    key: '/',
    icon: <DashboardOutlined />,
    label: <Link href="/">Inicio</Link>,
  },
  {
    key: 'divider-1',
    type: 'divider',
  },
  {
    key: 'categories',
    icon: <AppstoreOutlined />,
    label: <Link href="/categories">Categorías</Link>,
  },
  {
    key: 'products',
    icon: <ShoppingOutlined />,
    label: <Link href="/products">Productos</Link>,
  },
  {
    key: 'customers',
    icon: <UserOutlined />,
    label: <Link href="/customers">Clientes</Link>,
  },
  {
    key: 'customer-profiles',
    icon: <FileTextOutlined />,
    label: <Link href="/customer-profiles">Perfiles de Clientes</Link>,
  },
  {
    key: 'customer-interactions',
    icon: <ReconciliationOutlined />,
    label: <Link href="/customer-interactions">Interacciones</Link>,
  },
  {
    key: 'divider-2',
    type: 'divider',
  },
  {
    key: 'orders',
    icon: <ShoppingCartOutlined />,
    label: <Link href="/orders">Órdenes</Link>,
  },
  {
    key: 'prices',
    icon: <DollarOutlined />,
    label: <Link href="/prices">Precios</Link>,
  },
  {
    key: 'costs',
    icon: <DollarOutlined />,
    label: <Link href="/costs">Costos</Link>,
  },
  {
    key: 'divider-3',
    type: 'divider',
  },
  {
    key: 'stock',
    icon: <DatabaseOutlined />,
    label: <Link href="/stock">Stock</Link>,
  },
  {
    key: 'recipes',
    icon: <BgColorsOutlined />,
    label: <Link href="/recipes">Recetas</Link>,
  },
  {
    key: 'users',
    icon: <UserOutlined />,
    label: <Link href="/users">Usuarios</Link>,
  },
]

export function AppSidebar({
  collapsed = false,
  onCollapsedChange,
  isMobile = false,
}: AppSidebarProps) {
  const pathname = usePathname()

  // Extract the first part of the path for menu key
  const selectedKey = pathname === '/' ? '/' : `/${pathname.split('/')[1]}`

  const menuContent = (
    <Menu
      mode="inline"
      selectedKeys={[selectedKey]}
      items={menuItems}
      style={{ borderRight: 'none' }}
    />
  )

  if (isMobile) {
    return (
      <Drawer
        title="Navegación"
        placement="left"
        onClose={() => onCollapsedChange?.(true)}
        open={!collapsed}
        styles={{ body: { padding: 0 } }}
      >
        {menuContent}
      </Drawer>
    )
  }

  return (
    <Sider
      trigger={null}
      collapsible
      collapsed={collapsed}
      width={250}
      collapsedWidth={80}
      style={{
        height: '100vh',
        position: 'fixed',
        left: 0,
        top: 0,
        bottom: 0,
        backgroundColor: '#111111',
      }}
    >
      <div
        style={{
          padding: '24px 0',
          textAlign: 'center',
          color: '#22c55e',
          fontSize: collapsed ? '14px' : '20px',
          fontWeight: 'bold',
          marginBottom: '16px',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
        }}
      >
        {collapsed ? 'HA' : 'Hop Ahumado'}
      </div>
      <Menu
        mode="inline"
        selectedKeys={[selectedKey]}
        items={menuItems}
        style={{ borderRight: 'none' }}
      />
    </Sider>
  )
}

export function ToggleSidebarButton({ collapsed, onClick }: { collapsed: boolean; onClick: () => void }) {
  return (
    <Button
      type="text"
      icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
      onClick={onClick}
      style={{ fontSize: '16px' }}
    />
  )
}
