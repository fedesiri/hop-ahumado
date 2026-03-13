'use client'

import React, { createContext, useContext, useState } from 'react'
import { BusinessLine } from './types'

interface LineContextType {
  selectedLine: BusinessLine | null
  setSelectedLine: (line: BusinessLine | null) => void
}

const LineContext = createContext<LineContextType | undefined>(undefined)

export function LineProvider({ children }: { children: React.ReactNode }) {
  const [selectedLine, setSelectedLine] = useState<BusinessLine | null>(BusinessLine.MEAT)

  return (
    <LineContext.Provider value={{ selectedLine, setSelectedLine }}>
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
