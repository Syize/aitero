import type { CSSProperties } from 'react'
import { useEffect, useState } from 'react'
import { zoteroApi, type ZoteroCollectionNode, type ZoteroItemListEntry } from '@/zotero/api'
import { useLibraryBootstrap } from './libraryBootstrap'
import { useWorkspace } from './workspaceState'

const ITEM_ROW_HEIGHT = 72
const ITEM_ROW_GAP = 10
const ITEM_ROW_PITCH = ITEM_ROW_HEIGHT + ITEM_ROW_GAP
const ITEM_ROW_OVERSCAN = 6

interface CollectionTreeNode extends ZoteroCollectionNode {
  children: CollectionTreeNode[]
}

export function LibraryWorkspace() {
  const { status, summary, error, pendingLabel, retry, selectDataDir } = useLibraryBootstrap()
  const { libraryFilters, setLibraryFilters, resetLibraryFilters } = useWorkspace()
  const [runtimeSummary, setRuntimeSummary] = useState(summary)
  const [expandedCollectionIds, setExpandedCollectionIds] = useState<number[]>([])
  const [collectionsStatus, setCollectionsStatus] =
    useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [collections, setCollections] = useState<CollectionTreeNode[]>([])
  const [collectionsError, setCollectionsError] = useState<string | null>(null)
  const [itemsStatus, setItemsStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [items, setItems] = useState<ZoteroItemListEntry[]>([])
  const [itemsError, setItemsError] = useState<string | null>(null)
  const [itemsViewportElement, setItemsViewportElement] = useState<HTMLDivElement | null>(null)
  const [itemsViewportHeight, setItemsViewportHeight] = useState(0)
  const [itemsScrollTop, setItemsScrollTop] = useState(0)
  const isSelectingDirectory = status === 'selecting-directory'
  const showsSetupSurface =
    status === 'needs-setup' ||
    (isSelectingDirectory && (!summary || !summary.isConfigured))
  const showsInvalidSurface =
    status === 'invalid-config' ||
    (isSelectingDirectory && !!summary && summary.isConfigured)
  const hasSearchPreview = libraryFilters.query.trim().length > 0

  useEffect(() => {
    setRuntimeSummary(summary)
  }, [summary])

  useEffect(() => {
    if (status !== 'ready') {
      setCollectionsStatus('idle')
      setCollections([])
      setCollectionsError(null)
      setExpandedCollectionIds([])
      setItemsStatus('idle')
      setItems([])
      setItemsError(null)
      return
    }

    let isActive = true

    setCollectionsStatus('loading')
    setCollectionsError(null)

    zoteroApi
      .listCollections()
      .then((nodes) => {
        if (!isActive) return

        setCollections(buildCollectionTree(nodes))
        setCollectionsStatus('ready')
        setExpandedCollectionIds([])

        void zoteroApi.getZoteroConfig().then((nextSummary) => {
          if (!isActive) return
          setRuntimeSummary(nextSummary)
        })
      })
      .catch((collectionError: unknown) => {
        if (!isActive) return

        setCollections([])
        setCollectionsError(
          collectionError instanceof Error
            ? collectionError.message
            : 'Unable to load Zotero collections.'
        )
        setCollectionsStatus('error')
      })

    return () => {
      isActive = false
    }
  }, [status])

  useEffect(() => {
    if (!itemsViewportElement) {
      return
    }

    const updateViewportHeight = () => {
      setItemsViewportHeight(itemsViewportElement.clientHeight)
    }

    updateViewportHeight()

    const resizeObserver = new ResizeObserver(() => {
      updateViewportHeight()
    })

    resizeObserver.observe(itemsViewportElement)

    return () => {
      resizeObserver.disconnect()
    }
  }, [itemsViewportElement])

  useEffect(() => {
    setItemsScrollTop(0)
    itemsViewportElement?.scrollTo({ top: 0 })
  }, [itemsViewportElement, libraryFilters.collectionId, libraryFilters.query])

  useEffect(() => {
    if (status !== 'ready') {
      return
    }

    let isActive = true

    setItemsStatus('loading')
    setItemsError(null)

    zoteroApi
      .listItems({ collectionId: libraryFilters.collectionId })
      .then((nextItems) => {
        if (!isActive) return

        setItems(nextItems)
        setItemsStatus('ready')
      })
      .catch((itemError: unknown) => {
        if (!isActive) return

        setItems([])
        setItemsError(
          itemError instanceof Error
            ? itemError.message
            : 'Unable to load Zotero items.'
        )
        setItemsStatus('error')
      })

    return () => {
      isActive = false
    }
  }, [libraryFilters.collectionId, status])

  if (status === 'loading-config') {
    return (
      <section className="library-workspace" aria-label="Library workspace">
        <div className="library-workspace__bootstrap">
          <span className="library-workspace__eyebrow">Phase 4</span>
          <h1>Checking your Zotero setup.</h1>
          <p>
            The library tab is loading the saved Zotero configuration before it decides
            whether to enter setup, show an error state, or continue into the workspace.
          </p>

          <div className="library-workspace__loading-card" aria-live="polite">
            <span className="library-workspace__loading-dot" aria-hidden="true" />
            <div>
              <strong>Bootstrap in progress</strong>
              <p>{pendingLabel ?? 'Loading saved Zotero configuration...'}</p>
            </div>
          </div>
        </div>
      </section>
    )
  }

  if (showsSetupSurface) {
    return (
      <section className="library-workspace" aria-label="Library workspace">
        <div className="library-workspace__bootstrap">
          <span className="library-workspace__eyebrow">First Run</span>
          <h1>Zotero data directory is not configured yet.</h1>
          <p>
            This setup surface now owns the Zotero directory entry point. Once a valid
            directory is selected, the library tab can advance into the ready workspace.
          </p>

          <div className="library-workspace__status-card">
            <strong>Current state</strong>
            <p>
              The app has confirmed there is no saved Zotero data directory, so the
              library workspace is holding on the setup surface instead of rendering the
              normal three-pane view.
            </p>
          </div>

          {isSelectingDirectory ? (
            <div className="library-workspace__loading-card" aria-live="polite">
              <span className="library-workspace__loading-dot" aria-hidden="true" />
              <div>
                <strong>Directory selection in progress</strong>
                <p>{pendingLabel ?? 'Waiting for Zotero directory selection...'}</p>
              </div>
            </div>
          ) : null}

          {error ? (
            <div className="library-workspace__status-card">
              <strong>{error.code}</strong>
              <p>{error.message}</p>
            </div>
          ) : null}

          <div className="library-workspace__actions">
            <button
              type="button"
              className="library-workspace__action"
              onClick={selectDataDir}
              disabled={isSelectingDirectory}
            >
              {isSelectingDirectory ? 'Opening Directory Picker...' : 'Select Zotero Data Directory'}
            </button>
          </div>
        </div>
      </section>
    )
  }

  if (showsInvalidSurface) {
    return (
      <section className="library-workspace" aria-label="Library workspace">
        <div className="library-workspace__bootstrap">
          <span className="library-workspace__eyebrow">Invalid Config</span>
          <h1>The saved Zotero directory needs attention.</h1>
          <p>
            The app found a saved Zotero directory, but the current validation check did
            not pass. You can either re-check the current saved directory or choose a
            different one.
          </p>

          <div className="library-workspace__status-card">
            <strong>Saved path</strong>
            <p>{summary?.dataDir ?? 'No saved path available.'}</p>
          </div>

          <div className="library-workspace__status-card">
            <strong>Validation issues</strong>
            <ul className="library-workspace__issues">
              {(summary?.validation.issues ?? []).map((issue) => (
                <li key={`${issue.code}-${issue.path ?? 'none'}`}>
                  <span>{issue.message}</span>
                  {issue.path ? <code>{issue.path}</code> : null}
                </li>
              ))}
            </ul>
          </div>

          {isSelectingDirectory ? (
            <div className="library-workspace__loading-card" aria-live="polite">
              <span className="library-workspace__loading-dot" aria-hidden="true" />
              <div>
                <strong>Directory selection in progress</strong>
                <p>{pendingLabel ?? 'Waiting for Zotero directory selection...'}</p>
              </div>
            </div>
          ) : null}

          {error ? (
            <div className="library-workspace__status-card">
              <strong>{error.code}</strong>
              <p>{error.message}</p>
            </div>
          ) : null}

          <div className="library-workspace__actions">
            <button
              type="button"
              className="library-workspace__action library-workspace__action--secondary"
              onClick={retry}
              disabled={isSelectingDirectory}
            >
              Retry Current Directory
            </button>
            <button
              type="button"
              className="library-workspace__action"
              onClick={selectDataDir}
              disabled={isSelectingDirectory}
            >
              {isSelectingDirectory ? 'Opening Directory Picker...' : 'Choose Another Directory'}
            </button>
          </div>
        </div>
      </section>
    )
  }

  if (status === 'load-failed') {
    return (
      <section className="library-workspace" aria-label="Library workspace">
        <div className="library-workspace__bootstrap">
          <span className="library-workspace__eyebrow">Config Error</span>
          <h1>The Zotero startup check failed.</h1>
          <p>
            This state catches configuration read failures before the main workspace is
            rendered, so startup errors stay inside the library tab instead of crashing
            the shell.
          </p>

          <div className="library-workspace__status-card">
            <strong>{error?.code ?? 'unknown'}</strong>
            <p>{error?.message ?? 'Unable to read Zotero startup state.'}</p>
          </div>

          <button
            type="button"
            className="library-workspace__action"
            onClick={retry}
          >
            Retry Startup Check
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="library-workspace" aria-label="Library workspace">
      <header className="library-workspace__header">
        <div className="library-workspace__hero">
          <span className="library-workspace__eyebrow">Phase 5</span>
          <h1>Library workspace is now a real three-pane layout.</h1>
          <p>
            The startup flow has handed control to a desktop-style library shell with
            dedicated collection, item, and detail regions. Later tasks can now fill each
            pane without reshaping the whole workspace.
          </p>
        </div>

        <div className="library-workspace__meta-card">
          <span className="library-workspace__meta-label">Zotero data directory</span>
          <strong>{runtimeSummary?.dataDir ?? 'Unavailable'}</strong>
          <p>
            The workspace only reaches this state after the saved configuration validates
            successfully.
          </p>
        </div>
      </header>

      <div className="library-workspace__layout">
        <aside className="library-pane library-pane--collections" aria-label="Collections pane">
          <div className="library-pane__header">
            <div>
              <span className="library-pane__eyebrow">Left Pane</span>
              <h2>Collections</h2>
            </div>
            <div className="library-pane__header-meta">
              <span
                className={`library-pane__db-badge library-pane__db-badge--${runtimeSummary?.databaseAccess.mode ?? 'direct'}`}
                tabIndex={0}
              >
                {runtimeSummary?.databaseAccess.mode ?? 'direct'}
                <span className="library-pane__db-tooltip" role="tooltip">
                  {runtimeSummary?.databaseAccess.mode === 'snapshot'
                    ? runtimeSummary.databaseAccess.notice
                    : 'Aitero is reading directly from the Zotero database. New Zotero changes can appear on the next refresh.'}
                </span>
              </span>
              <span className="library-pane__count">
                {collectionsStatus === 'ready'
                  ? `${countCollectionNodes(collections)} collections`
                  : 'Root view scaffold'}
              </span>
            </div>
          </div>

          <div className="library-pane__body">
            <button
              type="button"
              className={`library-pane__nav-item${libraryFilters.collectionId === null ? ' is-active' : ''}`}
              onClick={() => setLibraryFilters({ collectionId: null })}
            >
              <strong>All Items</strong>
              <span>Stable root entry for browsing the full library before any collection is selected.</span>
            </button>

            {collectionsStatus === 'loading' ? (
              <div className="library-pane__tree-placeholder" aria-live="polite">
                <strong>Loading collections</strong>
                <p>Reading the Zotero collection hierarchy from the local database.</p>
              </div>
            ) : null}

            {collectionsStatus === 'error' ? (
              <div className="library-pane__tree-placeholder">
                <strong>Collections unavailable</strong>
                <p>{collectionsError ?? 'Unable to load Zotero collections.'}</p>
              </div>
            ) : null}

            {collectionsStatus === 'ready' && collections.length === 0 ? (
              <div className="library-pane__tree-placeholder">
                <strong>No collections yet</strong>
                <p>This Zotero library does not currently define any collections.</p>
              </div>
            ) : null}

            {collectionsStatus === 'ready' && collections.length > 0 ? (
              <div className="library-pane__collection-tree" aria-label="Zotero collection hierarchy">
                <CollectionTree
                  nodes={collections}
                  selectedCollectionId={libraryFilters.collectionId}
                  expandedCollectionIds={expandedCollectionIds}
                  onSelectCollection={(collectionId) => setLibraryFilters({ collectionId })}
                  onToggleCollection={(collectionId) =>
                    setExpandedCollectionIds((currentIds) =>
                      currentIds.includes(collectionId)
                        ? currentIds.filter((id) => id !== collectionId)
                        : [...currentIds, collectionId]
                    )
                  }
                />
              </div>
            ) : null}
          </div>
        </aside>

        <section className="library-pane library-pane--items" aria-label="Items pane">
          <div className="library-pane__header">
            <div>
              <span className="library-pane__eyebrow">Center Pane</span>
              <h2>Items</h2>
            </div>
            <span className="library-pane__count">
              {itemsStatus === 'loading'
                ? 'Loading items...'
                : hasSearchPreview
                  ? 'Search preview'
                  : itemsStatus === 'ready'
                    ? `${items.length} items`
                    : 'List scaffold'}
            </span>
          </div>

          <div className="library-pane__toolbar">
            <label className="library-pane__search">
              <span>Search preview</span>
              <input
                type="text"
                value={libraryFilters.query}
                onChange={(event) => setLibraryFilters({ query: event.target.value })}
                placeholder="Type to preview the no-results state"
              />
            </label>

            <button
              type="button"
              className="library-workspace__action library-workspace__action--secondary"
              onClick={resetLibraryFilters}
            >
              Reset Preview Filters
            </button>
          </div>

          <div className="library-pane__body library-pane__body--items">
            {itemsStatus === 'loading' ? (
              <div className="library-pane__placeholder-list">
                <div className="library-pane__placeholder-item">
                  <strong>Loading items</strong>
                  <span>Reading the Zotero item list from the local database.</span>
                </div>
              </div>
            ) : itemsStatus === 'error' ? (
              <div className="library-pane__placeholder-list">
                <div className="library-pane__placeholder-item">
                  <strong>Items unavailable</strong>
                  <span>{itemsError ?? 'Unable to load Zotero items.'}</span>
                </div>
              </div>
            ) : hasSearchPreview ? (
              <div className="library-workspace__no-results">
                <span className="library-workspace__eyebrow">No Results</span>
                <h3>No items match the current search or collection filter.</h3>
                <p>
                  This empty state is now anchored inside the real center pane, so the
                  future list implementation can reuse it directly when filters produce no
                  matches.
                </p>
                <div className="library-workspace__filter-summary">
                  <span>
                    Search: <strong>{libraryFilters.query.trim() || 'none'}</strong>
                  </span>
                  <span>
                    Collection:{' '}
                    <strong>{libraryFilters.collectionId === null ? 'All Items' : `#${libraryFilters.collectionId}`}</strong>
                  </span>
                </div>
                <button
                  type="button"
                  className="library-workspace__action"
                  onClick={resetLibraryFilters}
                >
                  Clear Filters
                </button>
              </div>
            ) : items.length > 0 ? (
              <div
                ref={setItemsViewportElement}
                className="library-pane__items-viewport"
                onScroll={(event) => setItemsScrollTop(event.currentTarget.scrollTop)}
              >
                <VirtualizedItemList
                  items={items}
                  selectedItemId={libraryFilters.selectedItemId}
                  viewportHeight={itemsViewportHeight}
                  scrollTop={itemsScrollTop}
                  onSelectItem={(itemId) => setLibraryFilters({ selectedItemId: itemId })}
                />
              </div>
            ) : (
              <div className="library-pane__placeholder-list">
                <div className="library-pane__placeholder-item">
                  <strong>
                    {libraryFilters.collectionId === null ? 'No items yet' : 'No items in this collection'}
                  </strong>
                  <span>
                    {libraryFilters.collectionId === null
                      ? 'This Zotero library does not currently contain any top-level items to display.'
                      : 'The selected collection does not currently contain any top-level items to display.'}
                  </span>
                </div>
              </div>
            )}
          </div>
        </section>

        <aside className="library-pane library-pane--details" aria-label="Details pane">
          <div className="library-pane__header">
            <div>
              <span className="library-pane__eyebrow">Right Pane</span>
              <h2>Details</h2>
            </div>
            <span className="library-pane__count">Awaiting selection</span>
          </div>

          <div className="library-pane__body">
            <div className="library-pane__detail-card">
              <strong>Metadata preview</strong>
              <p>
                This pane is reserved for the selected item summary, creators, year, and
                attachments once the list/detail flow is wired in.
              </p>
            </div>

            <div className="library-pane__detail-card">
              <strong>Attachment context</strong>
              <p>
                Multi-attachment explanation and no-PDF messaging will live here without
                disturbing the outer three-pane layout.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </section>
  )
}

interface VirtualizedItemListProps {
  items: ZoteroItemListEntry[]
  selectedItemId: number | null
  viewportHeight: number
  scrollTop: number
  onSelectItem: (itemId: number) => void
}

function VirtualizedItemList({
  items,
  selectedItemId,
  viewportHeight,
  scrollTop,
  onSelectItem
}: VirtualizedItemListProps) {
  const visibleCount = Math.ceil(viewportHeight / ITEM_ROW_PITCH)
  const startIndex = Math.max(0, Math.floor(scrollTop / ITEM_ROW_PITCH) - ITEM_ROW_OVERSCAN)
  const endIndex = Math.min(
    items.length,
    startIndex + visibleCount + ITEM_ROW_OVERSCAN * 2
  )
  const totalHeight =
    items.length > 0 ? items.length * ITEM_ROW_PITCH - ITEM_ROW_GAP : 0

  return (
    <div
      className="library-pane__item-list library-pane__item-list--virtualized"
      style={{ height: totalHeight }}
      aria-label="Zotero item titles"
    >
      {items.slice(startIndex, endIndex).map((item, visibleIndex) => {
        const itemIndex = startIndex + visibleIndex

        return (
          <button
            key={item.id}
            type="button"
            className={`library-pane__item-row library-pane__item-row--virtualized${
              selectedItemId === item.id ? ' is-active' : ''
            }`}
            style={{ top: itemIndex * ITEM_ROW_PITCH, height: ITEM_ROW_HEIGHT }}
            onClick={() => onSelectItem(item.id)}
          >
            <strong>{item.title || 'Untitled item'}</strong>
          </button>
        )
      })}
    </div>
  )
}

interface CollectionTreeProps {
  nodes: CollectionTreeNode[]
  selectedCollectionId: number | null
  expandedCollectionIds: number[]
  onSelectCollection: (collectionId: number) => void
  onToggleCollection: (collectionId: number) => void
  depth?: number
}

function CollectionTree({
  nodes,
  selectedCollectionId,
  expandedCollectionIds,
  onSelectCollection,
  onToggleCollection,
  depth = 0
}: CollectionTreeProps) {
  return (
    <ul className="library-pane__collection-list" aria-label={depth === 0 ? 'Collections' : undefined}>
      {nodes.map((node) => {
        const hasChildren = node.children.length > 0
        const isExpanded = expandedCollectionIds.includes(node.id)
        const isSelected = selectedCollectionId === node.id

        return (
          <li key={node.id}>
            <div
              className={`library-pane__collection-node${isSelected ? ' is-active' : ''}`}
              style={{ '--collection-depth': depth } as CSSProperties}
            >
              {hasChildren ? (
                <button
                  type="button"
                  className={`library-pane__collection-toggle${isExpanded ? ' is-expanded' : ''}`}
                  aria-label={isExpanded ? `Collapse ${node.name}` : `Expand ${node.name}`}
                  aria-expanded={isExpanded}
                  onClick={() => onToggleCollection(node.id)}
                >
                  <span aria-hidden="true">▸</span>
                </button>
              ) : (
                <span className="library-pane__collection-spacer" aria-hidden="true" />
              )}

              <button
                type="button"
                className="library-pane__collection-select"
                onClick={() => onSelectCollection(node.id)}
              >
                <strong>{node.name}</strong>
                <span>#{node.id}</span>
              </button>
            </div>
            {hasChildren && isExpanded ? (
              <CollectionTree
                nodes={node.children}
                selectedCollectionId={selectedCollectionId}
                expandedCollectionIds={expandedCollectionIds}
                onSelectCollection={onSelectCollection}
                onToggleCollection={onToggleCollection}
                depth={depth + 1}
              />
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}

function buildCollectionTree(nodes: ZoteroCollectionNode[]): CollectionTreeNode[] {
  const nodeMap = new Map<number, CollectionTreeNode>()

  for (const node of nodes) {
    nodeMap.set(node.id, { ...node, children: [] })
  }

  const roots: CollectionTreeNode[] = []

  for (const node of nodeMap.values()) {
    if (node.parentId === null) {
      roots.push(node)
      continue
    }

    const parentNode = nodeMap.get(node.parentId)

    if (parentNode) {
      parentNode.children.push(node)
      continue
    }

    roots.push(node)
  }

  return roots
}

function countCollectionNodes(nodes: CollectionTreeNode[]): number {
  let count = 0

  for (const node of nodes) {
    count += 1
    count += countCollectionNodes(node.children)
  }

  return count
}
