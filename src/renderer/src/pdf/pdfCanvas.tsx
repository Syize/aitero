import { useCallback, useEffect, useEffectEvent, useMemo, useRef } from 'react'
import './pdfCanvas.css'
import { useCanvasRegistry } from './pdfCanvas/canvas'
import { usePDFDocument } from './pdfCanvas/document'
import { Priority, useRenderScheduler } from './pdfCanvas/render'
import { useScaleHandler } from './pdfCanvas/scale'
import { useViewportManager } from './pdfCanvas/viewport'
import { usePDFContext } from './pdfState'
import { pdfLogger } from './utils'

function computePriority(pageIndex: number, currentPage: number): Priority {
  let dist = Math.abs(pageIndex - currentPage)

  switch (dist) {
    case 0:
      return 0

    case 1:
      return 1

    default:
      return 2
  }
}

export default function PDFCanvas() {
  const { state, setScale } = usePDFContext()
  const { scale, rotation, document: pdfDocument } = state

  const containerDiv = useRef<HTMLDivElement>(null)
  const transformContainerDiv = useRef<HTMLDivElement>(null)
  const isCanvasRenderedMap = useRef<Set<number>>(new Set())

  // Custom hook
  const { pageNum, pageSizes, isLoading } = usePDFDocument(pdfDocument, rotation)
  const { currentPage, mountedPages, registerPage, setIsProgramScroll, getIsProgramScroll } =
    useViewportManager(containerDiv, pageNum)
  const canvasRegistry = useCanvasRegistry(getIsProgramScroll)
  const { visualScale } = useScaleHandler(
    transformContainerDiv,
    containerDiv,
    scale,
    currentPage,
    pageSizes,
    setScale,
    setIsProgramScroll
  )

  // Render function used by custom hook
  const renderExecutor = useCallback(
    async (
      pageIndex: number,
      version: number,
      force: boolean,
      getVersion: (pageIndex: number) => number
    ) => {
      if (!pdfDocument) {
        pdfLogger('Render', `PDF not ready, skip`, 'debug')
        return
      }

      const canvas = canvasRegistry.getCanvas(pageIndex)
      if (!canvas) {
        pdfLogger('Render', `Canvas doesn't exist for page ${pageIndex}, skip`, 'debug')
        return
      }

      pdfLogger('Render', `Render page ${pageIndex}`, 'debug')

      if (isCanvasRenderedMap.current.has(pageIndex) && !force) {
        pdfLogger('Render', `No need to rerender page ${pageIndex}`, 'debug')
        return Promise.resolve()
      }

      const page = await pdfDocument.getPage(pageIndex)
      const offscreen = canvasRegistry.getOffscreenCanvas(pageIndex)
      const dpr = window.devicePixelRatio || 1
      const viewport = page.getViewport({ scale, rotation })

      offscreen.height = Math.floor(viewport.height * dpr)
      offscreen.width = Math.floor(viewport.width * dpr)

      const offscreenCtx = offscreen.getContext('2d')!
      offscreenCtx.setTransform(dpr, 0, 0, dpr, 0, 0)

      const task = page.render({
        canvasContext: offscreenCtx,
        canvas: offscreen,
        viewport: page.getViewport({
          scale,
          rotation
        })
      })

      // Copied rendered results to onscreen canvas
      task.promise
        .then(() => {
          if (version !== getVersion(pageIndex)) {
            pdfLogger('Render', `Outdated results for page ${pageIndex}, skip`, 'debug')
            return
          }

          const visible = canvasRegistry.getCanvas(pageIndex)
          if (!visible) {
            pdfLogger('Render', `Canvas doesn't exist for page ${pageIndex}, skip`, 'debug')
            return
          }

          visible.width = offscreen.width
          visible.height = offscreen.height
          visible.getContext('2d')!.drawImage(offscreen, 0, 0)

          isCanvasRenderedMap.current.add(pageIndex)

          pdfLogger('Render', `Page rendered with scale=${scale}, rotation=${rotation}`)
        })
        .catch((e) => {
          if (e?.name !== 'RenderingCancelledException') {
            pdfLogger('Render', `Failed to copy render results: ${e}`, 'error')
          }
        })

      return task
    },
    [canvasRegistry, pdfDocument, scale, rotation]
  )

  const { schedule, newVersion, cancel } = useRenderScheduler(renderExecutor)

  // =========================== Utility functions =================================

  const requestRender = useCallback(
    (pageIndex: number) => {
      schedule(pageIndex, computePriority(pageIndex, currentPage))
    },
    [currentPage]
  )

  const stableRequestRender = useEffectEvent(requestRender)

  // ===============================================================================

  // =========================== Function definition ===============================

  // Map page index to array index.
  const pages = useMemo(() => {
    if (pageNum !== pageSizes.length) {
      pdfLogger('Main', 'pageNum and pageSizes is not euqal.', 'debug')
      return []
    } else return Array.from({ length: pageNum }, (_, i) => i + 1)
  }, [pageNum, pageSizes])

  /**
   * Create canvases and divs.
   * @returns JSX.Element[]
   */
  function createCanvases() {
    return pages.map((pageIndex, i) => {
      const height = pageSizes[i]?.height ?? 0
      const width = pageSizes[i]?.width ?? 0
      const isMounted = mountedPages.has(pageIndex)

      return (
        <div
          key={pageIndex}
          className="pdf-page bg-white shadow"
          data-page={pageIndex}
          style={{
            height: height,
            width: width
          }}
          ref={(el) => {
            registerPage(pageIndex, el)
          }}
        >
          {isMounted ? (
            <canvas
              ref={(el) => {
                canvasRegistry.registerCanvas(pageIndex, el)

                if (el) stableRequestRender(pageIndex)
                else {
                  if (!getIsProgramScroll()) isCanvasRenderedMap.current.delete(pageIndex)
                  cancel(pageIndex)
                }
              }}
              style={{ width: '100%', height: '100%' }}
            />
          ) : (
            <div
              style={{
                height: '100%',
                width: '100%',
                background: '#f3f4f6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <div className="animate-pulse text-gray-400">Loading...</div>
            </div>
          )}
        </div>
      )
    })
  }

  // =============================================================================

  // ========================= Listen on variable changes ========================

  // Useless effect to print logs.
  useEffect(() => {
    if (!pdfDocument) return

    pdfLogger('Main', `mounted page: ${Array.from(mountedPages)}`, 'debug')
  }, [mountedPages])

  useEffect(() => {
    if (!pdfDocument) return

    newVersion()
    isCanvasRenderedMap.current.clear()

    mountedPages.forEach((pageIndex) => {
      stableRequestRender(pageIndex)
    })
  }, [scale])

  // ===============================================================================

  return (
    <div ref={containerDiv} className="pdf-viewer relative w-full h-full overflow-auto">
      {isLoading ? (
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
          <div>Loading PDF...</div>
        </div>
      ) : (
        <div
          ref={transformContainerDiv}
          style={{
            transform: `scale(1)`,
            transformOrigin: '0 0',
            willChange: 'transform'
          }}
          className="flex flex-col items-center w-full gap-4"
        >
          <div style={{ height: '50px', width: '100%' }} />
          {createCanvases()}
        </div>
      )}
    </div>
  )
}
