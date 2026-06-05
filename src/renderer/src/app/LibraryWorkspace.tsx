import { FileText, Paperclip } from 'lucide-react'
import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import {
  zoteroApi,
  type ZoteroAttachment,
  type ZoteroItemDetail,
  type ZoteroItemListEntry
} from '@/zotero/api'
import { useLibraryBootstrap } from './libraryBootstrap'
import { LeftPanel } from './workspace/leftPanel'
import { PanelStateProvider, usePanelState } from './workspace/panelState'
import { useWorkspace } from './workspaceState'

const ITEM_ROW_HEIGHT = 92
const ITEM_ROW_GAP = 10
const ITEM_ROW_OVERSCAN = 6
const ITEM_EXPANSION_LOADING_HEIGHT = 52
const ITEM_EXPANSION_EMPTY_HEIGHT = 52
const ITEM_EXPANSION_ERROR_HEIGHT = 60
const ITEM_EXPANSION_PADDING_TOP = 10
const ITEM_EXPANSION_PADDING_BOTTOM = 10
const ITEM_ATTACHMENT_ROW_HEIGHT = 34
const ITEM_ATTACHMENT_ROW_GAP = 8

type ExpandedItemState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; attachments: ZoteroAttachment[] }
  | { status: 'error'; message: string }

export function LibraryWorkspace() {
  return (
    <PanelStateProvider>
      <LibraryWorkspaceContent />
    </PanelStateProvider>
  )
}

function LibraryWorkspaceContent() {
  const { status, summary, error, pendingLabel, retry, selectDataDir } = useLibraryBootstrap()
  const { openReaderTab } = useWorkspace()
  const {
    collectionId,
    query,
    selectedItemId,
    setQuery,
    setSelectedItemId,
    clearLibraryFilters
  } = usePanelState()
  const [itemsStatus, setItemsStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [items, setItems] = useState<ZoteroItemListEntry[]>([])
  const [itemsError, setItemsError] = useState<string | null>(null)
  const [itemOpenError, setItemOpenError] = useState<string | null>(null)
  const [expandedItemIds, setExpandedItemIds] = useState<number[]>([])
  const [expandedItemStates, setExpandedItemStates] = useState<Record<number, ExpandedItemState>>({})
  const [detailStatus, setDetailStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [itemDetail, setItemDetail] = useState<ZoteroItemDetail | null>(null)
  const [itemDetailError, setItemDetailError] = useState<string | null>(null)
  const [itemsViewportElement, setItemsViewportElement] = useState<HTMLDivElement | null>(null)
  const [itemsViewportHeight, setItemsViewportHeight] = useState(0)
  const [itemsScrollTop, setItemsScrollTop] = useState(0)
  const deferredQuery = useDeferredValue(query)
  const isSelectingDirectory = status === 'selecting-directory'
  const showsSetupSurface =
    status === 'needs-setup' ||
    (isSelectingDirectory && (!summary || !summary.isConfigured))
  const showsInvalidSurface =
    status === 'invalid-config' ||
    (isSelectingDirectory && !!summary && summary.isConfigured)
  const hasActiveSearchQuery = query.trim().length > 0

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
  }, [collectionId, deferredQuery, itemsViewportElement])

  useEffect(() => {
    if (status !== 'ready') {
      return
    }

    let isActive = true

    setItemsStatus('loading')
    setItemsError(null)
    setItemOpenError(null)
    setExpandedItemIds([])
    setExpandedItemStates({})

    zoteroApi
      .listItems({ collectionId, query: deferredQuery })
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
  }, [collectionId, deferredQuery, status])

  useEffect(() => {
    if (status !== 'ready' || selectedItemId === null) {
      setDetailStatus('idle')
      setItemDetail(null)
      setItemDetailError(null)
      return
    }

    let isActive = true

    setDetailStatus('loading')
    setItemDetailError(null)

    zoteroApi
      .getItemDetail(selectedItemId)
      .then((detail) => {
        if (!isActive) return

        setItemDetail(detail)
        setDetailStatus(detail ? 'ready' : 'idle')
      })
      .catch((detailError: unknown) => {
        if (!isActive) return

        setItemDetail(null)
        setItemDetailError(
          detailError instanceof Error
            ? detailError.message
            : 'Unable to load item details.'
        )
        setDetailStatus('error')
      })

    return () => {
      isActive = false
    }
  }, [selectedItemId, status])

  async function handleToggleItemExpansion(itemId: number) {
    const isExpanded = expandedItemIds.includes(itemId)

    if (isExpanded) {
      setExpandedItemIds((currentIds) => currentIds.filter((id) => id !== itemId))
      return
    }

    setExpandedItemIds((currentIds) => [...currentIds, itemId])

    const existingState = expandedItemStates[itemId]
    if (existingState?.status === 'ready' || existingState?.status === 'loading') {
      return
    }

    if (itemDetail && itemDetail.id === itemId) {
      setExpandedItemStates((currentState) => ({
        ...currentState,
        [itemId]: {
          status: 'ready',
          attachments: itemDetail.attachments
        }
      }))
      return
    }

    setExpandedItemStates((currentState) => ({
      ...currentState,
      [itemId]: { status: 'loading' }
    }))

    try {
      const detail = await zoteroApi.getItemDetail(itemId)

      setExpandedItemStates((currentState) => ({
        ...currentState,
        [itemId]: {
          status: 'ready',
          attachments: detail?.attachments ?? []
        }
      }))
    } catch (expandedItemError) {
      setExpandedItemStates((currentState) => ({
        ...currentState,
        [itemId]: {
          status: 'error',
          message:
            expandedItemError instanceof Error
              ? expandedItemError.message
              : 'Unable to load attachment list.'
        }
      }))
    }
  }

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
          <strong>{summary?.dataDir ?? 'Unavailable'}</strong>
          <p>
            The workspace only reaches this state after the saved configuration validates
            successfully.
          </p>
        </div>
      </header>

      <div className="library-workspace__layout">
        <LeftPanel isReady={status === 'ready'} summary={summary} />

        <section className="library-pane library-pane--items" aria-label="Items pane">
          <div className="library-pane__header">
            <div>
              <span className="library-pane__eyebrow">Center Pane</span>
              <h2>Items</h2>
            </div>
            <span className="library-pane__count">
              {itemsStatus === 'loading'
                ? 'Loading items...'
                : itemsStatus === 'ready'
                    ? `${items.length} items`
                    : 'List scaffold'}
            </span>
          </div>

          <div className="library-pane__toolbar">
            <label className="library-pane__search">
              <span>Search library</span>
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by title, author, or year"
              />
            </label>

            <button
              type="button"
              className="library-workspace__action library-workspace__action--secondary"
              onClick={clearLibraryFilters}
            >
              Reset Preview Filters
            </button>
          </div>

          <div className="library-pane__body library-pane__body--items">
            {itemOpenError ? (
              <div className="library-pane__inline-notice">
                <strong>Unable to open PDF.</strong>
                <span>{itemOpenError}</span>
              </div>
            ) : null}
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
            ) : items.length === 0 && (hasActiveSearchQuery || collectionId !== null) ? (
              <div className="library-workspace__no-results">
                <span className="library-workspace__eyebrow">No Results</span>
                <h3>No items match the current search or collection filter.</h3>
                <p>
                  The current search query and collection selection were applied in the
                  Zotero SQL query, but no matching items were found.
                </p>
                <div className="library-workspace__filter-summary">
                  <span>
                    Search: <strong>{query.trim() || 'none'}</strong>
                  </span>
                  <span>
                    Collection:{' '}
                    <strong>{collectionId === null ? 'All Items' : `#${collectionId}`}</strong>
                  </span>
                </div>
                <button
                  type="button"
                  className="library-workspace__action"
                  onClick={clearLibraryFilters}
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
                  selectedItemId={selectedItemId}
                  expandedItemIds={expandedItemIds}
                  expandedItemStates={expandedItemStates}
                  viewportHeight={itemsViewportHeight}
                  scrollTop={itemsScrollTop}
                  onSelectItem={setSelectedItemId}
                  onToggleItemExpansion={(itemId) => void handleToggleItemExpansion(itemId)}
                  onOpenItemPdf={async (item) => {
                    setItemOpenError(null)

                    try {
                      const resolvedPdf = await zoteroApi.resolveItemDefaultPdf(item.id)

                      if (!resolvedPdf) {
                        setItemOpenError('The selected item does not have a default PDF attachment.')
                        return
                      }

                      openReaderTab(
                        {
                          itemId: resolvedPdf.itemId,
                          attachmentId: resolvedPdf.attachmentId,
                          title: item.title || 'Untitled item',
                          pdfPath: resolvedPdf.pdfPath
                        },
                        item.title || 'Untitled item'
                      )
                    } catch (openError) {
                      setItemOpenError(
                        openError instanceof Error
                          ? openError.message
                          : 'Unable to resolve the default PDF for this item.'
                      )
                    }
                  }}
                />
              </div>
            ) : (
              <div className="library-pane__placeholder-list">
                <div className="library-pane__placeholder-item">
                  <strong>
                    {collectionId === null ? 'No items yet' : 'No items in this collection'}
                  </strong>
                  <span>
                    {collectionId === null
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
            <span className="library-pane__count">
              {detailStatus === 'loading'
                ? 'Loading detail...'
                : itemDetail
                  ? `Item #${itemDetail.id}`
                  : 'Awaiting selection'}
            </span>
          </div>

          <div className="library-pane__body">
            {detailStatus === 'loading' ? (
              <div className="library-pane__detail-card">
                <strong>Loading metadata</strong>
                <p>Reading the selected item's summary from the Zotero database.</p>
              </div>
            ) : detailStatus === 'error' ? (
              <div className="library-pane__detail-card">
                <strong>Detail unavailable</strong>
                <p>{itemDetailError ?? 'Unable to load item details.'}</p>
              </div>
            ) : itemDetail ? (
              <>
                <div className="library-pane__detail-card">
                  <span className="library-pane__detail-label">Title</span>
                  <strong>{itemDetail.title || 'Untitled item'}</strong>
                </div>

                <div className="library-pane__detail-card">
                  <span className="library-pane__detail-label">Authors</span>
                  {itemDetail.creators.length > 0 ? (
                    <ul className="library-pane__detail-list">
                      {itemDetail.creators.map((creator) => (
                        <li key={creator}>{creator}</li>
                      ))}
                    </ul>
                  ) : (
                    <p>No creator metadata</p>
                  )}
                </div>

                <div className="library-pane__detail-grid">
                  <div className="library-pane__detail-card">
                    <span className="library-pane__detail-label">Year</span>
                    <p>{itemDetail.year ?? 'n.d.'}</p>
                  </div>

                  <div className="library-pane__detail-card">
                    <span className="library-pane__detail-label">Attachments</span>
                    <p>{itemDetail.attachments.length} linked file(s)</p>
                  </div>
                </div>
              </>
            ) : (
              <div className="library-pane__detail-card">
                <strong>Select an item</strong>
                <p>
                  Choose an item in the center pane to inspect its key metadata here.
                </p>
              </div>
            )}
          </div>
        </aside>
      </div>
    </section>
  )
}

interface VirtualizedItemListProps {
  items: ZoteroItemListEntry[]
  selectedItemId: number | null
  expandedItemIds: number[]
  expandedItemStates: Record<number, ExpandedItemState>
  viewportHeight: number
  scrollTop: number
  onSelectItem: (itemId: number) => void
  onToggleItemExpansion: (itemId: number) => void
  onOpenItemPdf: (item: ZoteroItemListEntry) => void | Promise<void>
}

function VirtualizedItemList({
  items,
  selectedItemId,
  expandedItemIds,
  expandedItemStates,
  viewportHeight,
  scrollTop,
  onSelectItem,
  onToggleItemExpansion,
  onOpenItemPdf
}: VirtualizedItemListProps) {
  const expandedItemIdSet = useMemo(() => new Set(expandedItemIds), [expandedItemIds])
  const virtualMetrics = useMemo(() => {
    const rowOffsets: number[] = []
    const rowHeights: number[] = []
    let runningOffset = 0

    for (const item of items) {
      rowOffsets.push(runningOffset)

      const rowHeight =
        ITEM_ROW_HEIGHT +
        (expandedItemIdSet.has(item.id)
          ? getExpandedHeight(expandedItemStates[item.id] ?? { status: 'idle' })
          : 0)
      rowHeights.push(rowHeight)
      runningOffset += rowHeight + ITEM_ROW_GAP
    }

    return {
      rowOffsets,
      rowHeights,
      totalHeight: items.length > 0 ? runningOffset - ITEM_ROW_GAP : 0
    }
  }, [expandedItemIdSet, expandedItemStates, items])

  const viewportBottom = scrollTop + viewportHeight
  let startIndex = 0

  while (
    startIndex < items.length &&
    virtualMetrics.rowOffsets[startIndex] + virtualMetrics.rowHeights[startIndex] < scrollTop
  ) {
    startIndex += 1
  }

  startIndex = Math.max(0, startIndex - ITEM_ROW_OVERSCAN)

  let endIndex = startIndex

  while (
    endIndex < items.length &&
    virtualMetrics.rowOffsets[endIndex] < viewportBottom
  ) {
    endIndex += 1
  }

  endIndex = Math.min(items.length, endIndex + ITEM_ROW_OVERSCAN)

  return (
    <div
      className="library-pane__item-list library-pane__item-list--virtualized"
      style={{ height: virtualMetrics.totalHeight }}
      aria-label="Zotero item titles"
    >
      {items.slice(startIndex, endIndex).map((item, visibleIndex) => {
        const itemIndex = startIndex + visibleIndex
        const isExpanded = expandedItemIdSet.has(item.id)

        return (
          <div
            key={item.id}
            className={`library-pane__item-entry library-pane__item-row--virtualized${
              selectedItemId === item.id ? ' is-active' : ''
            }`}
            style={{
              top: virtualMetrics.rowOffsets[itemIndex],
              height: virtualMetrics.rowHeights[itemIndex]
            }}
          >
            <div className={`library-pane__item-row${selectedItemId === item.id ? ' is-active' : ''}`}>
              <button
                type="button"
                className={`library-pane__collection-toggle${isExpanded ? ' is-expanded' : ''}`}
                aria-label={isExpanded ? `Collapse ${item.title}` : `Expand ${item.title}`}
                aria-expanded={isExpanded}
                onClick={() => onToggleItemExpansion(item.id)}
              >
                <span aria-hidden="true">▸</span>
              </button>

              <button
                type="button"
                className="library-pane__item-main"
                onClick={() => onSelectItem(item.id)}
                onDoubleClick={() => void onOpenItemPdf(item)}
              >
                <strong>{item.title || 'Untitled item'}</strong>
                <div className="library-pane__item-meta">
                  <span className="library-pane__item-authors">
                    {item.creatorsText || 'No creator metadata'}
                  </span>
                  <em>{item.year ?? 'n.d.'}</em>
                </div>
              </button>
            </div>

            {isExpanded ? (
              <ItemAttachmentExpansion
                state={expandedItemStates[item.id] ?? { status: 'idle' }}
              />
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

function ItemAttachmentExpansion({ state }: { state: ExpandedItemState }) {
  if (state.status === 'loading' || state.status === 'idle') {
    return (
      <div className="library-pane__item-expansion library-pane__item-expansion--status">
        <span className="library-pane__attachment-status">Loading attachments...</span>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="library-pane__item-expansion library-pane__item-expansion--status">
        <span className="library-pane__attachment-status">{state.message}</span>
      </div>
    )
  }

  if (state.attachments.length === 0) {
    return (
      <div className="library-pane__item-expansion library-pane__item-expansion--status">
        <span className="library-pane__attachment-status">No linked attachments for this item.</span>
      </div>
    )
  }

  return (
    <div className="library-pane__item-expansion">
      <ul className="library-pane__attachment-list" aria-label="Attachment list">
        {state.attachments.map((attachment) => (
          <li key={attachment.id} className="library-pane__attachment-item">
            <span className="library-pane__attachment-icon" aria-hidden="true">
              {isPdfAttachment(attachment) ? <FileText size={16} /> : <Paperclip size={16} />}
            </span>
            <span
              className="library-pane__attachment-name"
              title={getAttachmentDisplayName(attachment)}
            >
              {getAttachmentDisplayName(attachment)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function getExpandedHeight(state: ExpandedItemState): number {
  switch (state.status) {
    case 'idle':
    case 'loading':
      return ITEM_EXPANSION_LOADING_HEIGHT
    case 'error':
      return ITEM_EXPANSION_ERROR_HEIGHT
    case 'ready':
      if (state.attachments.length === 0) {
        return ITEM_EXPANSION_EMPTY_HEIGHT
      }

      return (
        ITEM_EXPANSION_PADDING_TOP +
        ITEM_EXPANSION_PADDING_BOTTOM +
        state.attachments.length * ITEM_ATTACHMENT_ROW_HEIGHT +
        Math.max(0, state.attachments.length - 1) * ITEM_ATTACHMENT_ROW_GAP
      )
  }
}

function isPdfAttachment(attachment: ZoteroAttachment): boolean {
  return attachment.contentType?.toLowerCase() === 'application/pdf'
}

function getAttachmentDisplayName(attachment: ZoteroAttachment): string {
  const fileName = getAttachmentFileName(attachment.path)

  if (fileName) {
    return fileName
  }

  const title = attachment.title.trim()
  return title || 'Untitled attachment'
}

function getAttachmentFileName(path: string | null): string | null {
  if (!path) {
    return null
  }

  const normalizedPath = path.replace(/\\/g, '/')
  const segments = normalizedPath.split('/')
  const lastSegment = segments.at(-1)?.trim()

  return lastSegment || null
}
