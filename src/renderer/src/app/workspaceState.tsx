import { createContext, ReactNode, useContext, useMemo, useState } from 'react'
import type { LibraryFilterState, LibraryTab, ReaderTab, WorkspaceTab } from './types'

const LIBRARY_TAB: LibraryTab = {
  id: 'library',
  type: 'library',
  label: 'Library',
  closable: false
}

const DEFAULT_LIBRARY_FILTERS: LibraryFilterState = {
  collectionId: null,
  query: '',
  selectedItemId: null
}

interface WorkspaceContextValue {
  tabs: WorkspaceTab[]
  activeTabId: string
  activeTab: WorkspaceTab
  libraryFilters: LibraryFilterState
  setActiveTab: (tabId: string) => void
  setLibraryFilters: (nextFilters: Partial<LibraryFilterState>) => void
  resetLibraryFilters: () => void
  createReaderTab: () => void
  closeTab: (tabId: string) => void
}

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined)

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [tabs, setTabs] = useState<WorkspaceTab[]>([
    LIBRARY_TAB,
    createReaderTabState(1)
  ])
  const [activeTabId, setActiveTabId] = useState<string>(LIBRARY_TAB.id)
  const [libraryFilters, setLibraryFiltersState] =
    useState<LibraryFilterState>(DEFAULT_LIBRARY_FILTERS)

  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? LIBRARY_TAB

  function setActiveTab(tabId: string) {
    setActiveTabId(tabId)
  }

  function setLibraryFilters(nextFilters: Partial<LibraryFilterState>) {
    setLibraryFiltersState((currentFilters) => ({
      ...currentFilters,
      ...nextFilters
    }))
  }

  function resetLibraryFilters() {
    setLibraryFiltersState(DEFAULT_LIBRARY_FILTERS)
  }

  function createReaderTab() {
    let nextTabId = 'reader-1'

    setTabs((prevTabs) => {
      const readerCount = prevTabs.filter((tab) => tab.type === 'reader').length
      const nextIndex = readerCount + 1
      nextTabId = `reader-${nextIndex}`

      return [...prevTabs, createReaderTabState(nextIndex)]
    })

    setActiveTabId(nextTabId)
  }

  function closeTab(tabId: string) {
    setTabs((prevTabs) => {
      const nextTabs = prevTabs.filter((tab) => tab.id !== tabId)

      setActiveTabId((currentActiveId) => {
        if (currentActiveId !== tabId) return currentActiveId

        const closedIndex = prevTabs.findIndex((tab) => tab.id === tabId)
        const fallbackTab = nextTabs[closedIndex - 1] ?? nextTabs[closedIndex] ?? LIBRARY_TAB

        return fallbackTab.id
      })

      return nextTabs
    })
  }

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      tabs,
      activeTabId,
      activeTab,
      libraryFilters,
      setActiveTab,
      setLibraryFilters,
      resetLibraryFilters,
      createReaderTab,
      closeTab
    }),
    [activeTab, activeTabId, libraryFilters, tabs]
  )

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext)

  if (!context) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider')
  }

  return context
}

function createReaderTabState(index: number): ReaderTab {
  return {
    id: `reader-${index}`,
    type: 'reader',
    label: `Reader ${index}`,
    closable: true,
    reader: {
      title: `Reader ${index}`
    }
  }
}
