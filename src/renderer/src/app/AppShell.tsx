import { Plus, X } from 'lucide-react'
import { PDFViewer } from '../pdf/pdfViewer'
import { LibraryWorkspace } from './LibraryWorkspace'
import { useWorkspace } from './workspaceState'
import './appShell.css'

export function AppShell() {
  const { tabs, activeTabId, activeTab, setActiveTab, createReaderTab, closeTab } =
    useWorkspace()

  return (
    <div className="app-shell">
      <header className="app-shell__topbar">
        <div className="app-shell__brand">
          <span className="app-shell__brand-mark">A</span>
          <div className="app-shell__brand-copy">
            <strong>Aitero</strong>
            <span>Workspace shell prototype</span>
          </div>
        </div>

        <div className="app-shell__tab-strip">
          <nav className="app-shell__tabs" aria-label="Workspace tabs">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={`app-shell__tab${tab.id === activeTabId ? ' is-active' : ''}${tab.closable ? '' : ' is-static'}`}
            >
              <button
                type="button"
                className="app-shell__tab-trigger"
                onClick={() => setActiveTab(tab.id)}
                aria-current={tab.id === activeTabId ? 'page' : undefined}
              >
                {tab.label}
              </button>

              {tab.closable ? (
                <button
                  type="button"
                  className="app-shell__tab-close"
                  onClick={() => closeTab(tab.id)}
                  aria-label={`Close ${tab.label}`}
                >
                  <X size={14} />
                </button>
              ) : null}
            </div>
          ))}
          </nav>

          <button
            type="button"
            className="app-shell__add-tab"
            onClick={createReaderTab}
            aria-label="Open a new reader tab"
          >
            <Plus size={16} />
          </button>
        </div>
      </header>

      <main className="app-shell__content">
        <section className="app-shell__workspace" aria-label="Main content region">
          {activeTab.type === 'library' ? <LibraryWorkspace /> : <PDFViewer reader={activeTab.reader} />}
        </section>
      </main>
    </div>
  )
}
