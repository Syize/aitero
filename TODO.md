# TODO

## Phase 0 - Foundations and decisions
- [ ] Confirm the implementation boundary stays at `read-only local Zotero library`.
- [ ] Keep the existing PDF viewer architecture intact and treat it as a reusable reader workspace, not something to redesign now.
- [ ] Decide whether `TODO.md` should remain the execution contract for this feature and update it as phases complete.

## Phase 1 - App shell and workspace model
- [ ] Replace the current `App -> PDFViewer` single-view entry with an app shell.
- [ ] Add a top tab bar plus a main content region.
- [ ] Define the tab model:
  - [ ] One permanent `Library` tab.
  - [ ] Multiple closable `Reader` tabs.
  - [ ] Active tab drives which workspace is rendered.
- [ ] Create app-level state for workspace tabs; do not mix it into `PDFProvider`.
- [ ] Add minimal shared types:
  - [ ] `WorkspaceTab`
  - [ ] `ReaderTabState`
  - [ ] `LibraryFilterState`

### Acceptance
- [ ] The app can render a stable shell with a fixed library tab even before Zotero data is wired up.
- [ ] Switching active tabs changes the visible workspace without breaking the shell.

## Phase 2 - Main-process Zotero integration
- [ ] Add a main-process Zotero service for read-only library access.
- [ ] Add config persistence for the user-selected Zotero data directory.
- [ ] Implement directory validation:
  - [ ] Detect required Zotero database presence.
  - [ ] Detect required storage/attachment layout assumptions.
- [ ] Implement `selectZoteroDataDir()`.
- [ ] Implement `getZoteroConfig()`.
- [ ] Implement SQLite-backed queries for:
  - [ ] Collection tree
  - [ ] Item list summary
  - [ ] Item detail
  - [ ] Attachment metadata
  - [ ] Default PDF resolution
- [ ] Define the stable "default PDF" selection rule for multi-PDF items.
- [ ] Add robust error mapping so renderer receives user-facing failures instead of raw DB/file errors.

### Acceptance
- [ ] With a valid Zotero directory, the main process can return collections, items, details, and resolved PDF paths.
- [ ] With an invalid directory, the app returns a clear validation error.
- [ ] No renderer code directly reads SQLite or local filesystem paths.

## Phase 3 - Preload API and renderer data layer
- [ ] Expose a namespaced read-only API under `window.api.zotero.*`.
- [ ] Add renderer-side TypeScript DTOs:
  - [ ] `ZoteroLibrarySummary`
  - [ ] `ZoteroCollectionNode`
  - [ ] `ZoteroItemListEntry`
  - [ ] `ZoteroItemDetail`
  - [ ] `ZoteroAttachment`
- [ ] Add a renderer data-access layer that wraps preload calls instead of calling `window.api` inline in components.
- [ ] Ensure the DTO layer hides SQLite schema details from UI components.

### Acceptance
- [ ] Renderer components can fetch library data entirely through typed API wrappers.
- [ ] The preload contract is small and read-only.

## Phase 4 - First-run setup and empty/error states
- [ ] Build the first-run flow for missing Zotero directory configuration.
- [ ] Add a "select Zotero data directory" entry point.
- [ ] Add invalid-directory error state and retry action.
- [ ] Add loading states for initial library bootstrapping.
- [ ] Add a no-results state for empty searches/filter combinations.

### Acceptance
- [ ] Fresh startup with no config lands in a usable setup flow.
- [ ] Invalid configuration does not crash the app and can be corrected in-app.

## Phase 5 - Three-pane library workspace
- [ ] Build `LibraryWorkspace` as a three-pane layout.
- [ ] Left pane: collection tree
  - [ ] Show `All Items`.
  - [ ] Show real collection hierarchy.
  - [ ] Selecting a collection updates the item list filter.
- [ ] Center pane: item list
  - [ ] Show title.
  - [ ] Show compact author text.
  - [ ] Show year.
  - [ ] Support search by title, author, year.
  - [ ] Support double-click to open the item's default PDF.
- [ ] Right pane: item detail
  - [ ] Show key metadata.
  - [ ] Show attachment list.
  - [ ] Show "no PDF available" state clearly.
  - [ ] Show multiple attachments clearly even if only one default PDF opens on double-click.
- [ ] Keep the visual direction close to Zotero's density and utility, but do not chase full parity.

### Acceptance
- [ ] Users can browse collections, filter items, inspect details, and understand attachment state.
- [ ] Search updates the center pane predictably.
- [ ] The workspace remains usable at desktop window sizes.

## Phase 6 - Reader tab opening flow
- [ ] Implement the double-click open flow from item list to reader tab creation.
- [ ] Prevent duplicate tab explosions for the same attachment unless intentionally allowed.
- [ ] Define tab labeling:
  - [ ] Prefer item title.
  - [ ] Fall back to filename if needed.
- [ ] Implement no-PDF behavior:
  - [ ] Do not open a reader tab.
  - [ ] Show a clear notice in the library UI.
- [ ] Implement default-PDF open behavior for multi-PDF items using the Phase 2 rule.

### Acceptance
- [ ] Double-clicking a valid item opens a new reader tab inside the app.
- [ ] Double-clicking an item without PDF gives feedback and does not create a broken tab.
- [ ] Multiple reader tabs can coexist.

## Phase 7 - PDF viewer adapter
- [ ] Add a reader-facing adapter so the existing PDF viewer can open a PDF from `pdfPath` or equivalent loaded file data.
- [ ] Remove the current assumption that opening a PDF must begin with manual upload from the toolbar.
- [ ] Keep the existing upload path temporarily as a debug/development fallback until the main flow is stable.
- [ ] Ensure each reader tab owns its own reader state and teardown lifecycle.
- [ ] Ensure closing one reader tab does not destroy other reader instances.

### Acceptance
- [ ] A PDF opened from Zotero renders with the existing viewer.
- [ ] Existing zoom, rotation, and text selection still work.
- [ ] Reader lifecycle is isolated per tab.

## Phase 8 - Tab behavior and state hygiene
- [ ] Implement tab activation, close, and focus behavior.
- [ ] Keep the library tab non-closable.
- [ ] Ensure closing the active reader tab selects a sensible fallback tab.
- [ ] Decide whether reopening the same attachment should focus an existing tab or create a second tab; document the chosen rule and implement it consistently.
- [ ] Keep app-level tab state separate from PDF runtime state.

### Acceptance
- [ ] Tab interactions feel deterministic.
- [ ] Switching tabs does not corrupt current reader content or library selection state.

## Phase 9 - Regression checks
- [ ] Verify startup with no Zotero config.
- [ ] Verify selecting a valid Zotero directory.
- [ ] Verify invalid directory handling.
- [ ] Verify collection filtering.
- [ ] Verify search by title, author, year.
- [ ] Verify double-click open with:
  - [ ] Single PDF attachment
  - [ ] Multiple PDF attachments
  - [ ] No PDF attachment
- [ ] Verify opening multiple PDFs into multiple tabs.
- [ ] Verify closing one tab does not affect others.
- [ ] Verify PDF reader features still work:
  - [ ] Zoom
  - [ ] Rotation
  - [ ] Native text selection/copy
- [ ] Verify the temporary manual-upload path still works during transition.

## Phase 10 - Cleanup and follow-up decisions
- [ ] Remove or demote transitional reader UI that no longer fits the library-driven flow.
- [ ] Review whether the manual upload button should remain as a hidden debug entry or be removed.
- [ ] Document the chosen Zotero directory assumptions and the default PDF resolution rule.
- [ ] Capture next-phase items explicitly instead of leaking them into v1:
  - [ ] Auto-detect Zotero directory
  - [ ] Richer metadata search
  - [ ] Attachment chooser UI
  - [ ] Reading-state persistence
  - [ ] Write-back features
