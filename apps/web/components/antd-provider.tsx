'use client'

import { ConfigProvider, App, theme } from 'antd'
import esES from 'antd/locale/es_ES'
import { useMediaQuery } from '@/lib/use-media-query'

const darkTheme = {
  token: {
    // Dark theme colors: Black and Green palette
    colorBgBase: '#0a0a0a',
    colorTextBase: '#ffffff',
    colorPrimary: '#22c55e', // Emerald green
    colorSuccess: '#22c55e',
    colorWarning: '#f97316',
    colorError: '#ef4444',
    colorInfo: '#3b82f6',
    borderRadius: 6,
    colorBorder: '#1f2937',
    colorBgContainer: '#111111',
    colorBgElevated: '#1f2937',
    colorBgLayout: '#0a0a0a',
  },
  algorithm: theme.darkAlgorithm,
  components: {
    Modal: {
      contentBg: '#111111',
      headerBg: '#111111',
    },
  },
}

export function AntdProvider({ children }: { children: React.ReactNode }) {
  const isMobile = useMediaQuery('(max-width: 768px)')
  return (
    <ConfigProvider
      theme={darkTheme}
      locale={esES}
      componentSize={isMobile ? 'small' : 'middle'}
    >
      <App>
        {children}
      </App>
    </ConfigProvider>
  )
}
