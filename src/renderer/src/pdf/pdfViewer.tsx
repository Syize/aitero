import { useEffect, useState } from 'react'
import type { ReaderTabState } from '@/app/types'
import PDFCanvas from './pdfCanvas'
import { PDFManager } from './pdfManager'
import { CanvasProvider, PDFProvider, useCanvasContext, usePDFContext } from './pdfState'
import PDFToolBar from './pdfToolBar'
import './pdfViewer.css'

const manager = new PDFManager()

export function PDFViewer({ reader }: { reader: ReaderTabState }) {
  return (
    <PDFProvider>
      <div className="pdf-viewer-container">
        <CanvasProvider>
          <PDFViewerLoader reader={reader} />
          <PDFToolBar
            manager={manager}
          ></PDFToolBar>
          <PDFCanvas></PDFCanvas>
        </CanvasProvider>
      </div>
    </PDFProvider>
  )
}

function PDFViewerLoader({ reader }: { reader: ReaderTabState }) {
  const { setDocument, setIsLoading, _reset } = usePDFContext()
  const { setIsInitialized } = useCanvasContext()
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let isActive = true

    if (!reader.pdfPath) {
      manager.destroy()
      _reset()
      setIsInitialized(false)
      setLoadError('This reader tab does not have a PDF file yet.')
      return
    }

    setLoadError(null)
    manager.destroy()
    _reset()
    setIsLoading(true)
    setIsInitialized(false)

    void window.api.reader
      .readPdfFile(reader.pdfPath)
      .then(async (bytes) => {
        if (!isActive) return

        manager.destroy()

        const file = new File([bytes], `${reader.title || 'document'}.pdf`, {
          type: 'application/pdf'
        })
        const doc = await manager.loadFromFile(file)

        if (!isActive) return

        setIsLoading(false)
        setDocument(doc, 1, doc.numPages, 1.2, 0, false)
      })
      .catch((error: unknown) => {
        if (!isActive) return

        setIsLoading(false)
        setLoadError(error instanceof Error ? error.message : 'Unable to load the selected PDF.')
      })

    return () => {
      isActive = false
    }
  }, [reader.attachmentId, reader.pdfPath, reader.title, _reset, setDocument, setIsInitialized, setIsLoading])

  if (!loadError) {
    return null
  }

  return <div className="pdf-viewer__notice">{loadError}</div>
}
