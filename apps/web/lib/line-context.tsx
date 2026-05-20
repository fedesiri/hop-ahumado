'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { apiClient } from './api-client'
import { BusinessLine } from './types'

const STORAGE_KEY = 'hop_selected_line'

interface LineContextType {
  selectedLine: BusinessLine | null
  selectedLineId: string | null
  setSelectedLine: (line: BusinessLine | null) => void
}

const LineContext = createContext<LineContextType | undefined>(undefined)

export function LineProvider({ children }: { children: React.ReactNode }) {
  const [selectedLine, setSelectedLineState] = useState<BusinessLine | null>(() => {
    if (typeof window === 'undefined') return BusinessLine.BEER
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === BusinessLine.BEER || stored === BusinessLine.MEAT) return stored
    return BusinessLine.BEER
  })

  const [slugToId, setSlugToId] = useState<Record<string, string>>({})

  useEffect(() => {
    apiClient.getBusinessLines().then((lines) => {
      const map: Record<string, string> = {}
      for (const line of lines) {
        map[line.slug] = line.id
      }
      setSlugToId(map)
    }).catch(() => {})
  }, [])

  const setSelectedLine = (line: BusinessLine | null) => {
    setSelectedLineState(line)
    if (line) {
      localStorage.setItem(STORAGE_KEY, line)
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  }

  const selectedLineId = selectedLine ? (slugToId[selectedLine] ?? null) : null

  return (
    <LineContext.Provider value={{ selectedLine, selectedLineId, setSelectedLine }}>
      {children}
    </LineContext.Provider>
  )
}

export function useLineContext() {
  const context = useContext(LineContext)
  if (context === undefined) {
    throw new Error('useLineContext must be used within a LineProvider')
  }
  return context
}
