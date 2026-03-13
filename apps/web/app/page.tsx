'use client'

import { Dashboard } from '@/components/dashboard'
import { AppLayout } from '@/components/app-layout'
import { LineProvider } from '@/lib/line-context'

export default function Home() {
  return (
    <LineProvider>
      <AppLayout showLineTabs={false}>
        <Dashboard />
      </AppLayout>
    </LineProvider>
  )
}
