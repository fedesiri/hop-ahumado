'use client'

import React, { useState } from 'react'
import { Layout, Tabs, Button, Space, Drawer } from 'antd'
import { MenuFoldOutlined } from '@ant-design/icons'
import { AppSidebar, ToggleSidebarButton } from './app-sidebar'
import { BusinessLine } from '@/lib/types'
import { useLineContext } from '@/lib/line-context'
import { useMediaQuery } from '@/lib/use-media-query'

const { Header, Content } = Layout

interface AppLayoutProps {
  children: React.ReactNode
  showLineTabs?: boolean
}

export function AppLayout({ children, showLineTabs = true }: AppLayoutProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const { selectedLine, setSelectedLine } = useLineContext()
  const isMobile = useMediaQuery('(max-width: 768px)')

  const toggleCollapsed = () => {
    if (isMobile) {
      setDrawerOpen(!drawerOpen)
    } else {
      setCollapsed(!collapsed)
    }
  }

  const lineTabItems = [
    {
      key: BusinessLine.MEAT,
      label: '🥩 Carnes Ahumadas',
    },
    {
      key: BusinessLine.BEER,
      label: '🍺 Cerveza Artesanal',
    },
  ]

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {isMobile ? (
        <Drawer
          title="Navegación"
          placement="left"
          onClose={() => setDrawerOpen(false)}
          open={drawerOpen}
          bodyStyle={{ padding: 0 }}
          width={250}
        >
          <AppSidebar collapsed={false} onCollapsedChange={() => {}} isMobile={true} />
        </Drawer>
      ) : (
        <AppSidebar
          collapsed={collapsed}
          onCollapsedChange={setCollapsed}
          isMobile={false}
        />
      )}

      <Layout
        style={{
          marginLeft: isMobile ? 0 : collapsed ? 80 : 250,
          transition: 'margin-left 0.2s',
        }}
      >
        <Header
          style={{
            padding: '0 24px',
            background: '#1f2937',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #2d3748',
            height: 64,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <ToggleSidebarButton
              collapsed={isMobile ? drawerOpen : collapsed}
              onClick={toggleCollapsed}
            />
            <h1 style={{ margin: 0, color: '#ffffff', fontSize: '18px' }}>
              Hop Ahumado
            </h1>
          </div>

          {showLineTabs && selectedLine && (
            <Tabs
              activeKey={selectedLine}
              onChange={(key) => setSelectedLine(key as BusinessLine)}
              items={lineTabItems}
              style={{ marginBottom: 0 }}
              size="small"
            />
          )}
        </Header>

        <Content
          style={{
            padding: '24px',
            background: '#0a0a0a',
            minHeight: 'calc(100vh - 64px)',
          }}
        >
          {children}
        </Content>
      </Layout>
    </Layout>
  )
}
