import { TextLayer as PDFJSTextLayer } from 'pdfjs-dist'
import type { CSSProperties } from 'react'
import { useCallback, useEffect, useEffectEvent, useMemo, useRef } from 'react'
import './pdfCanvas.css'
import { useCanvasRegistry } from './pdfCanvas/canvas'
import { usePDFDocument } from './pdfCanvas/document'
import { Priority, useRenderScheduler } from './pdfCanvas/render'
import { useScaleHandler } from './pdfCanvas/scale'
import { TextLayerHelpers, useTextLayer } from './pdfCanvas/textLayer'
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
  const canvasContainerDiv = useRef<HTMLDivElement>(null)
  const isCanvasRenderedMap = useRef<Set<number>>(new Set())
  const canvasInstanceMap = useRef<Map<number, HTMLCanvasElement>>(new Map())
  const textLayerInstanceMap = useRef<Map<number, HTMLDivElement>>(new Map())

  // Custom hook
  const { pageNum, pageSizes, isLoading } = usePDFDocument(pdfDocument, rotation)
  const { currentPage, mountedPages, registerPage, isProgramScroll, setIsProgramScroll } =
    useViewportManager(containerDiv, pageNum)
  const canvasRegistry = useCanvasRegistry()

  // Executor
  const renderTextLayerExecutor = useCallback(
    async (
      pageIndex: number,
      version: number,
      force: boolean,
      getVersion: (pageIndex: number) => number,
      helpers: TextLayerHelpers
    ) => {
      if (!pdfDocument) {
        pdfLogger('TextLayer', 'PDF not ready, skip text layer render', 'debug')
        return
      }

      const root = helpers.getTextLayer(pageIndex)
      if (!root) {
        pdfLogger('TextLayer', `Text layer root doesn't exist for page ${pageIndex}, skip`, 'debug')
        return
      }

      if (helpers.isRendered(pageIndex) && !force) {
        pdfLogger('TextLayer', `No need to rerender text layer for page ${pageIndex}`, 'debug')
        return
      }

      let textContent = helpers.getTextContent(pageIndex)
      if (!textContent || force) {
        const page = await pdfDocument.getPage(pageIndex)
        textContent = await page.getTextContent()

        if (version !== getVersion(pageIndex)) {
          pdfLogger('TextLayer', `Outdated text content for page ${pageIndex}, discard`, 'debug')
          return
        }

        helpers.setTextContent(pageIndex, textContent)
      }

      helpers.clearRenderedTextLayer(pageIndex)

      const page = await pdfDocument.getPage(pageIndex)
      if (version !== getVersion(pageIndex)) {
        pdfLogger('TextLayer', `Outdated text layer task for page ${pageIndex}, skip`, 'debug')
        return
      }

      const viewport = page.getViewport({ scale, rotation })
      const textLayer = new PDFJSTextLayer({
        textContentSource: textContent,
        container: root,
        viewport
      })

      helpers.setRenderInstance(pageIndex, textLayer)
      await textLayer.render()

      if (version !== getVersion(pageIndex)) {
        textLayer.cancel()
        helpers.setRenderInstance(pageIndex, null)
        helpers.unmarkRendered(pageIndex)
        return
      }

      helpers.markRendered(pageIndex)
      pdfLogger('TextLayer', `Text layer rendered for page ${pageIndex}`, 'debug')
    },
    [pdfDocument, scale, rotation]
  )
  const {
    registerTextLayer,
    scheduleTextLayerTask,
    cancelTextLayerTask,
    clearRenderedTextLayer,
    // clearAllTextLayers,
    newTextLayerVersion
  } = useTextLayer(renderTextLayerExecutor)
  const { visualScale, isScaling, resetVisualScale } = useScaleHandler(
    canvasContainerDiv,
    containerDiv,
    scale,
    currentPage,
    pageSizes,
    setScale,
    setIsProgramScroll
  )

  // Render function used by custom hook
  const renderCanvasExecutor = useCallback(
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

      if (isCanvasRenderedMap.current.has(pageIndex) && !force) {
        pdfLogger('Render', `No need to rerender page ${pageIndex}`, 'debug')
        return Promise.resolve()
      }

      pdfLogger('Render', `Render page ${pageIndex}`, 'debug')

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

  const { scheduleRenderTask, newRenderVersion, cancelRenderTask } =
    useRenderScheduler(renderCanvasExecutor)

  // =========================== Utility functions =================================

  const requestRenderCanvas = useEffectEvent(
    useCallback(
      (pageIndex: number) => {
        scheduleRenderTask(pageIndex, computePriority(pageIndex, currentPage))
      },
      [currentPage]
    )
  )

  const requestRenderTextLayer = useEffectEvent(
    useCallback(
      (pageIndex: number, force: boolean = false) => {
        scheduleTextLayerTask(pageIndex, computePriority(pageIndex, currentPage), force)
      },
      [currentPage]
    )
  )

  const getMountedPages = useEffectEvent(useCallback(() => mountedPages, [mountedPages]))
  const getPDFDocument = useEffectEvent(useCallback(() => pdfDocument, [pdfDocument]))

  // ===============================================================================

  // =========================== Function definition ===============================

  // Map page index to array index.
  const pages = useMemo(() => {
    if (pageNum !== pageSizes.length) {
      pdfLogger('Main', 'pageNum and pageSizes is not euqal.', 'debug')
      return []
    } else return Array.from({ length: pageNum }, (_, i) => i + 1)
  }, [pageNum, pageSizes])

  const createCanvas = useEffectEvent(
    useCallback(
      (el: HTMLCanvasElement | null, pageIndex: number) => {
        const isMounted = mountedPages.has(pageIndex)
        canvasRegistry.registerCanvas(pageIndex, el, !isMounted)

        if (el) {
          const existingInstance = canvasInstanceMap.current.get(pageIndex)

          if (existingInstance === el && isCanvasRenderedMap.current.has(pageIndex)) {
            pdfLogger('Main', 'Rebind cached canvas, skip', 'debug')
            return
          }

          canvasInstanceMap.current.set(pageIndex, el)

          requestRenderCanvas(pageIndex)
        } else {
          if (!isMounted) {
            canvasInstanceMap.current.delete(pageIndex)
            isCanvasRenderedMap.current.delete(pageIndex)
            cancelRenderTask(pageIndex)
          } else {
            pdfLogger('Main', 'Unbind canvas temporarily, keep cached canvas', 'debug')
          }
        }
      },
      [mountedPages]
    )
  )

  const createTextLayer = useEffectEvent(
    useCallback(
      (el: HTMLDivElement | null, pageIndex: number) => {
        const isMounted = mountedPages.has(pageIndex)
        registerTextLayer(pageIndex, el, !isMounted)

        if (el) {
          const existingInstance = textLayerInstanceMap.current.get(pageIndex)

          if (existingInstance === el) {
            pdfLogger('TextLayer', 'Rebind cached text layer root, skip', 'debug')
            return
          }

          textLayerInstanceMap.current.set(pageIndex, el)
          requestRenderTextLayer(pageIndex)
        } else {
          if (!isMounted) {
            textLayerInstanceMap.current.delete(pageIndex)
            cancelTextLayerTask(pageIndex)
            clearRenderedTextLayer(pageIndex)
          } else {
            pdfLogger('TextLayer', 'Unbind text layer root temporarily, keep cached root', 'debug')
          }
        }
      },
      [
        mountedPages,
        currentPage,
        registerTextLayer,
        scheduleTextLayerTask,
        cancelTextLayerTask,
        clearRenderedTextLayer
      ]
    )
  )

  /**
   * Create canvases and divs.
   * @returns JSX.Element[]
   */
  function createCanvases() {
    return pages.map((pageIndex, i) => {
      const height = pageSizes[i]?.height ?? 0
      const width = pageSizes[i]?.width ?? 0
      const isMounted = mountedPages.has(pageIndex)
      const isSelectionDisabled = isScaling || isProgramScroll
      const textLayerScaleStyle = {
        '--scale-factor': String(scale),
        '--user-unit': '1'
      } as CSSProperties

      return (
        <div
          key={pageIndex}
          className="pdf-page bg-white shadow"
          data-page={pageIndex}
          style={{
            height: height * visualScale,
            width: width * visualScale
          }}
          ref={(el) => {
            registerPage(pageIndex, el)
          }}
        >
          <div className="pdf-page-content" style={textLayerScaleStyle}>
            {isMounted ? (
              <>
                <div className="pdf-canvas-layer">
                  <canvas
                    ref={(el) => {
                      createCanvas(el, pageIndex)
                    }}
                    className="pdf-page-canvas"
                    style={{ width: '100%', height: '100%' }}
                  />
                </div>
                <div
                  ref={(el) => {
                    createTextLayer(el, pageIndex)
                  }}
                  className={`pdf-text-layer textLayer${isSelectionDisabled ? ' selection-disabled' : ''}`}
                  data-page={pageIndex}
                  aria-hidden="true"
                />
              </>
            ) : (
              <div className="pdf-page-placeholder">
                <div className="animate-pulse text-gray-400">Loading...</div>
              </div>
            )}
          </div>
        </div>
      )
    })
  }

  // =============================================================================

  // ========================= Listen on variable changes ========================

  // Useless effect to print logs.
  useEffect(() => {
    if (!getPDFDocument()) return

    pdfLogger('Main', `mounted page: ${Array.from(mountedPages)}`, 'debug')
  }, [mountedPages])

  useEffect(() => {
    if (!(isScaling || isProgramScroll)) return

    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return

    selection.removeAllRanges()
  }, [isScaling, isProgramScroll])

  useEffect(() => {
    if (!getPDFDocument()) return

    newRenderVersion()
    isCanvasRenderedMap.current.clear()
    newTextLayerVersion()

    getMountedPages().forEach((pageIndex) => {
      requestRenderCanvas(pageIndex)
      requestRenderTextLayer(pageIndex)
    })
  }, [scale]) // No need to depende on mountedPages and functions.

  useEffect(() => {
    if (!getPDFDocument()) return

    newRenderVersion()
    isCanvasRenderedMap.current.clear()
    newTextLayerVersion()

    getMountedPages().forEach((pageIndex) => {
      requestRenderCanvas(pageIndex)
      requestRenderTextLayer(pageIndex)
    })
  }, [rotation])

  // Reset visual scale after opening new PDF
  useEffect(() => {
    if (!pdfDocument) return

    newTextLayerVersion()
    resetVisualScale(1.2)
    // No need to explicitly request render.
    // This will be handled by react.
  }, [pdfDocument])

  // useEffect(() => {
  //   return () => {
  //     clearAllRenderedTextLayers()
  //   }
  // }, [])

  // ===============================================================================

  return (
    <div
      ref={containerDiv}
      className="pdf-viewer relative w-full h-full overflow-auto"
      style={{ overflowX: 'auto' }} // Fix bug: horizontal scroll bar not show
    >
      {isLoading ? (
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
          <div>Loading PDF...</div>
        </div>
      ) : (
        <div
          ref={canvasContainerDiv}
          className="flex flex-col items-start gap-4"
          style={{ width: 'max-content' }}
        >
          <div style={{ height: '50px', width: '100%' }} />
          {createCanvases()}
        </div>
      )}
    </div>
  )
}
