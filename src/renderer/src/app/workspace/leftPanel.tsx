import type { CSSProperties } from 'react'
import { useEffect, useState } from 'react'
import { zoteroApi, type ZoteroCollectionNode } from '@/zotero/api'
import type { ZoteroLibrarySummary } from '@/zotero/types'
import { usePanelState } from './panelState'
import './leftPanel.css'

interface LeftPanelProps {
  isReady: boolean
  summary: ZoteroLibrarySummary | null
}

interface CollectionTreeNode extends ZoteroCollectionNode {
  children: CollectionTreeNode[]
}

type CollectionLoadState = 'idle' | 'loading' | 'ready' | 'error'

export function LeftPanel({ isReady, summary }: LeftPanelProps) {
  const { collectionId, setCollectionId, clearCollectionId } = usePanelState()
  const [collectionsStatus, setCollectionsStatus] = useState<CollectionLoadState>('idle')
  const [collections, setCollections] = useState<CollectionTreeNode[]>([])
  const [collectionsError, setCollectionsError] = useState<string | null>(null)
  const [expandedCollectionIds, setExpandedCollectionIds] = useState<number[]>([])

  useEffect(() => {
    if (!isReady) {
      setCollectionsStatus('idle')
      setCollections([])
      setCollectionsError(null)
      setExpandedCollectionIds([])
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
  }, [isReady])

  return (
    <aside className="library-pane library-pane--collections" aria-label="Collections pane">
      <div className="library-pane__header">
        <div>
          <span className="library-pane__eyebrow">Left Pane</span>
          <h2>Collections</h2>
        </div>
        <div className="library-pane__header-meta">
          <span
            className={`library-pane__db-badge library-pane__db-badge--${summary?.databaseAccess.mode ?? 'direct'}`}
            tabIndex={0}
          >
            {summary?.databaseAccess.mode ?? 'direct'}
            <span className="library-pane__db-tooltip" role="tooltip">
              {summary?.databaseAccess.mode === 'snapshot'
                ? summary.databaseAccess.notice
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
          className={`library-pane__nav-item${collectionId === null ? ' is-active' : ''}`}
          onClick={clearCollectionId}
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
              selectedCollectionId={collectionId}
              expandedCollectionIds={expandedCollectionIds}
              onSelectCollection={setCollectionId}
              onToggleCollection={(nextCollectionId) =>
                setExpandedCollectionIds((currentIds) =>
                  currentIds.includes(nextCollectionId)
                    ? currentIds.filter((id) => id !== nextCollectionId)
                    : [...currentIds, nextCollectionId]
                )
              }
            />
          </div>
        ) : null}
      </div>
    </aside>
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
