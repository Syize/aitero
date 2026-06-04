import { useLibraryBootstrap } from './libraryBootstrap'

export function LibraryWorkspace() {
  const { status, summary, error, pendingLabel, retry, selectDataDir } = useLibraryBootstrap()
  const isSelectingDirectory = status === 'selecting-directory'
  const showsSetupSurface =
    status === 'needs-setup' ||
    (isSelectingDirectory && (!summary || !summary.isConfigured))
  const showsInvalidSurface =
    status === 'invalid-config' ||
    (isSelectingDirectory && !!summary && summary.isConfigured)

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
      <div className="library-workspace__hero">
        <span className="library-workspace__eyebrow">Ready State</span>
        <h1>Library bootstrap completed successfully.</h1>
        <p>
          The startup flow now promotes the library tab into a stable ready state once the
          saved Zotero configuration is present and valid. The full three-pane UI will be
          layered onto this surface in the next phases.
        </p>
      </div>

      <div className="library-workspace__grid">
        <article className="library-workspace__panel">
          <h2>Collections</h2>
          <p>Reserved for the validated collection tree pane.</p>
        </article>

        <article className="library-workspace__panel">
          <h2>Items</h2>
          <p>Reserved for the center literature list and search results.</p>
        </article>

        <article className="library-workspace__panel">
          <h2>Details</h2>
          <p>Reserved for metadata and attachment details.</p>
        </article>
      </div>
    </section>
  )
}
