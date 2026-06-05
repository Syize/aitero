import { createContext, type ReactNode, useContext, useMemo, useState } from 'react'

interface PanelStateProviderProps {
  children: ReactNode
}

interface PanelStateContextValue {
  collectionId: number | null
  query: string
  selectedItemId: number | null
  setCollectionId: (collectionId: number | null) => void
  clearCollectionId: () => void
  setQuery: (query: string) => void
  clearQuery: () => void
  setSelectedItemId: (selectedItemId: number | null) => void
  clearSelectedItemId: () => void
  clearLibraryFilters: () => void
}

const PanelStateContext = createContext<PanelStateContextValue | undefined>(undefined)

export function PanelStateProvider({ children }: PanelStateProviderProps) {
  const [collectionId, setCollectionIdState] = useState<number | null>(null)
  const [query, setQueryState] = useState('')
  const [selectedItemId, setSelectedItemIdState] = useState<number | null>(null)

  function setCollectionId(collectionId: number | null) {
    setCollectionIdState(collectionId)
  }

  function clearCollectionId() {
    setCollectionIdState(null)
  }

  function setQuery(query: string) {
    setQueryState(query)
  }

  function clearQuery() {
    setQueryState('')
  }

  function setSelectedItemId(selectedItemId: number | null) {
    setSelectedItemIdState(selectedItemId)
  }

  function clearSelectedItemId() {
    setSelectedItemIdState(null)
  }

  function clearLibraryFilters() {
    setCollectionIdState(null)
    setQueryState('')
    setSelectedItemIdState(null)
  }

  const value = useMemo<PanelStateContextValue>(
    () => ({
      collectionId,
      query,
      selectedItemId,
      setCollectionId,
      clearCollectionId,
      setQuery,
      clearQuery,
      setSelectedItemId,
      clearSelectedItemId,
      clearLibraryFilters
    }),
    [collectionId, query, selectedItemId]
  )

  return <PanelStateContext.Provider value={value}>{children}</PanelStateContext.Provider>
}

export function usePanelState() {
  const context = useContext(PanelStateContext)

  if (!context) {
    throw new Error('usePanelState must be used within a PanelStateProvider')
  }

  return context
}
