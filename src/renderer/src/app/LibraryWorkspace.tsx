export function LibraryWorkspace() {
  return (
    <section className="library-workspace" aria-label="Library workspace">
      <div className="library-workspace__hero">
        <span className="library-workspace__eyebrow">Phase 1</span>
        <h1>Library workspace is now a first-class tab.</h1>
        <p>
          This placeholder keeps the shell stable before Zotero data, collections, and the
          three-pane layout are wired in.
        </p>
      </div>

      <div className="library-workspace__grid">
        <article className="library-workspace__panel">
          <h2>Collections</h2>
          <p>Reserved for the left tree pane.</p>
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
