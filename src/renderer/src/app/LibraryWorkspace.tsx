import { useLibraryBootstrap } from './libraryBootstrap'
import { useWorkspace } from './workspaceState'

export function LibraryWorkspace() {
  const { status, summary, error, pendingLabel, retry, selectDataDir } = useLibraryBootstrap()
  const { libraryFilters, setLibraryFilters, resetLibraryFilters } = useWorkspace()
  const isSelectingDirectory = status === 'selecting-directory'
  const showsSetupSurface =
    status === 'needs-setup' ||
    (isSelectingDirectory && (!summary || !summary.isConfigured))
  const showsInvalidSurface =
    status === 'invalid-config' ||
    (isSelectingDirectory && !!summary && summary.isConfigured)
  const hasActiveLibraryFilters =
    libraryFilters.query.trim().length > 0 || libraryFilters.collectionId !== null

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
        <aside className="library-pane library-pane--collections" aria-label="Collections pane">
          <div className="library-pane__header">
            <div>
              <span className="library-pane__eyebrow">Left Pane</span>
              <h2>Collections</h2>
            </div>
            <span className="library-pane__count">2 preview nodes</span>
          </div>

          <div className="library-pane__body">
            <button
              type="button"
              className={`library-pane__nav-item${libraryFilters.collectionId === null ? ' is-active' : ''}`}
              onClick={() => setLibraryFilters({ collectionId: null })}
            >
              <strong>All Items</strong>
              <span>Default root view for the future library tree.</span>
            </button>

            <button
              type="button"
              className={`library-pane__nav-item${libraryFilters.collectionId === 1 ? ' is-active' : ''}`}
              onClick={() => setLibraryFilters({ collectionId: 1 })}
            >
              <strong>Preview Collection</strong>
              <span>Temporary node used to exercise collection-driven empty states.</span>
            </button>

            <div className="library-pane__note">
              The real Zotero collection tree will replace these preview nodes in the next
              Phase 5 steps.
            </div>
          </div>
        </aside>

        <section className="library-pane library-pane--items" aria-label="Items pane">
          <div className="library-pane__header">
            <div>
              <span className="library-pane__eyebrow">Center Pane</span>
              <h2>Items</h2>
            </div>
            <span className="library-pane__count">
              {hasActiveLibraryFilters ? '0 matching items' : 'List scaffold'}
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

          <div className="library-pane__body">
            {hasActiveLibraryFilters ? (
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
            ) : (
              <div className="library-pane__placeholder-list">
                <div className="library-pane__placeholder-item">
                  <strong>Item list region</strong>
                  <span>Search, sorting, and result rows will render here in later tasks.</span>
                </div>
                <div className="library-pane__placeholder-item">
                  <strong>Current behavior</strong>
                  <span>Applying a query or collection filter flips this pane into the no-results state.</span>
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
