// TODO:
//   1. Fix the bug that can't scale continuously.
import { useEffect, useMemo, useRef, useState } from 'react'
import './pdfCanvas.css'
import { usePDFContext } from './pdfState'

const RENDER_BUFFER_NUM = 3

export default function PDFCanvas() {
  const { state, setScale } = usePDFContext()

  const { scale, rotation, document: pdfDocument } = state
  const containerDiv = useRef<HTMLDivElement>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const canvasMap = useRef<Map<number, HTMLCanvasElement>>(new Map())
  const offscreenMap = useRef<Map<number, HTMLCanvasElement>>(new Map())

  const renderedPages = useRef<Set<number>>(new Set())
  const renderingPages = useRef<Set<number>>(new Set())
  const renderTasks = useRef<Map<number, any>>(new Map())

  const scaleTimerRef = useRef<NodeJS.Timeout | null>(null)
  const mountTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Page numbers of PDF document
  const [numPages, setNumPages] = useState(0)
  const [pageHeights, setPageHeights] = useState<number[]>([])
  const [pageWidths, setPageWidths] = useState<number[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Scale of the on screen canvas
  const [tempScale, setTempScale] = useState(scale)

  const currentPageRef = useRef(1)

  // Mounted canvas index.
  const [tempMountedPages, setTempMountedPages] = useState<Set<number>>(new Set())
  const [mountedPages, setMountedPages] = useState<Set<number>>(new Set())

  const [isAnimationFrame, setIsAnimationFrame] = useState(false)

  // =========================== Utility functions =================================

  /**
   * Cancel page render task.
   * @param pageIndex Page index.
   */
  function cancelRender(pageIndex: number) {
    const t = renderTasks.current.get(pageIndex)
    if (t) {
      try {
        t.cancel()
      } catch {}
      renderTasks.current.delete(pageIndex)
      renderingPages.current.delete(pageIndex)
    }
  }

  /**
   * Calculate all page size.
   */
  async function calculatePageSize() {
    const heights: number[] = []
    const widths: number[] = []

    for (let i = 1; i <= pdfDocument!.numPages; i++) {
      const page = await pdfDocument!.getPage(i)
      const viewport = page.getViewport({ scale, rotation })
      heights.push(viewport.height)
      widths.push(viewport.width)
    }

    setPageHeights(heights)
    setPageWidths(widths)
  }

  // =========================== Function definition ===============================

  /**
   * Initialize the page after uploading the PDF:
   *   1. Calculating page heights
   *   2. Turn off loading flag.
   */
  async function initialize() {
    setIsLoading(true)
    await calculatePageSize()
    setIsLoading(false)
  }

  /**
   * Render the specified PDF page.
   * @param pageIndex Page index.
   * @param force If force to render even it is rendered.
   * @returns
   */
  async function renderPage(pageIndex: number, force: boolean = false) {
    if (renderedPages.current.has(pageIndex) && !force) return

    renderedPages.current.delete(pageIndex)

    if (pageIndex < 1 || pageIndex > numPages) return

    // Stop existed task, and re-render.
    if (renderingPages.current.has(pageIndex)) {
      console.log(`Stop and rerender page ${pageIndex}`)
      cancelRender(pageIndex)
    }

    renderingPages.current.add(pageIndex)

    // if (isScaled) calculatePageSize()

    const page = await pdfDocument!.getPage(pageIndex)
    const viewPort = page.getViewport({ scale, rotation })
    const dpr = window.devicePixelRatio || 1

    if (!offscreenMap.current.has(pageIndex)) {
      offscreenMap.current.set(pageIndex, document.createElement('canvas'))
    }

    const offscreen = offscreenMap.current.get(pageIndex)
    if (!offscreen) {
      console.error(`Off screen canvas not created for page ${pageIndex}`)
      return
    }

    offscreen.width = Math.floor(viewPort.width * dpr)
    offscreen.height = Math.floor(viewPort.height * dpr)

    const ctx = offscreen.getContext('2d')!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const task = page.render({
      canvasContext: ctx,
      canvas: offscreen,
      viewport: viewPort
    })

    renderTasks.current.set(pageIndex, task)

    try {
      await task.promise

      // Copy offscreen result onto the visible canvas
      const visible = canvasMap.current.get(pageIndex)
      if (!visible) {
        console.error(`Canvas not created for page ${pageIndex}`)
        return
      }

      visible.width = offscreen.width
      visible.height = offscreen.height
      visible.getContext('2d')!.drawImage(offscreen, 0, 0)

      renderedPages.current.add(pageIndex)
    } catch (e: any) {
      if (e?.name !== 'RenderingCancelledException') {
        console.error(e)
      }
    } finally {
      renderingPages.current.delete(pageIndex)
      renderTasks.current.delete(pageIndex)
    }
  }

  /**
   * Register or unregister visible canvas.
   * @param pageIndex Page index.
   * @param element Canvas element.
   */
  function manageCanvas(pageIndex: number, element: HTMLCanvasElement | null) {
    if (element) {
      console.debug(`Canvas created for page ${pageIndex}`)

      // Element created
      canvasMap.current.set(pageIndex, element)
      offscreenMap.current.set(pageIndex, document.createElement('canvas'))

      // render page
      renderPage(pageIndex)
    } else {
      // Element destroied
      cancelRender(pageIndex)

      // clear rendered page
      renderedPages.current.delete(pageIndex)

      // delete offscreen cache
      const offscreenCanvas = offscreenMap.current.get(pageIndex)
      if (offscreenCanvas) {
        const ctx = offscreenCanvas.getContext('2d')
        ctx?.clearRect(0, 0, offscreenCanvas.width, offscreenCanvas.height)

        offscreenCanvas.width = 0
        offscreenCanvas.height = 0
        offscreenMap.current.delete(pageIndex)
      }
    }
  }

  // Map page index to array index.
  const pages = useMemo(() => Array.from({ length: numPages }, (_, i) => i + 1), [numPages])

  /**
   * Create canvases and divs.
   * @returns JSX.Element[]
   */
  function createCanvases() {
    return pages.map((pageIndex, i) => {
      const height = pageHeights[i]
      const width = pageWidths[i]
      const isMounted = mountedPages.has(pageIndex)

      return (
        <div
          key={pageIndex}
          className="pdf-page bg-white shadow"
          data-page={pageIndex}
          style={{
            height,
            width,
            transform: `scale(${tempScale / scale})`
          }}
        >
          {isMounted ? (
            <canvas ref={(el) => manageCanvas(pageIndex, el)} style={{ width, height }} />
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

  /**
   * Handle WheelEvent.
   * @param event Wheel event.
   * @returns void
   */
  function handleWheelEvent(event: WheelEvent) {
    // Only response to ctrl event
    if (!event.ctrlKey) return

    // Prevent default behavior
    event.preventDefault()
    event.stopPropagation()

    // Scale existed canvas
    const step = event.deltaY > 0 ? -0.1 : 0.1
    const newScale = Math.min(Math.max(tempScale + step, 0.5), 3.0)
    setTempScale(Number(newScale.toFixed(2)))
  }

  // =============================================================================

  // ========================= Listen on variable changes ========================

  // Initialization: Create empty div with page height.
  useEffect(() => {
    if (!pdfDocument) return
    setNumPages(pdfDocument.numPages)

    initialize()
  }, [pdfDocument, rotation])

  // Initialize IntersectionObserver
  useEffect(() => {
    if (!containerDiv.current) return

    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue

          const element = entry.target as HTMLElement
          const page = Number(element.dataset.page)

          currentPageRef.current = page
          console.log(`Current page change to page ${page}`)

          const next = new Set(mountedPages)

          // delete invisible page
          mountedPages.forEach((pageIndex) => {
            if (pageIndex < page - RENDER_BUFFER_NUM || pageIndex > page + RENDER_BUFFER_NUM) {
              next.delete(pageIndex)
            }
          })

          // add new visible page
          for (let i = page - RENDER_BUFFER_NUM; i <= page + RENDER_BUFFER_NUM; i++) {
            if (i >= 1 && i <= numPages) next.add(i)
          }

          // console.debug(`Mounted page changed to: ${Array.from(next)}`)
          setTempMountedPages(next)
        }
      },
      {
        root: containerDiv.current,
        rootMargin: '-1200px 0px 1200px 0px', // This seems to be right, doesn't know why
        threshold: 0.6
      }
    )

    return () => observerRef.current?.disconnect()
  }, [numPages])

  // Set scale after wheel stop (400ms later).
  useEffect(() => {
    if (scaleTimerRef.current) clearTimeout(scaleTimerRef.current)
    scaleTimerRef.current = setTimeout(() => {
      setScale(Number(tempScale.toFixed(2)))
    }, 400)
  }, [tempScale])

  // Set mounted page after scrolling stop (400ms later)
  useEffect(() => {
    if (mountTimerRef.current) clearTimeout(mountTimerRef.current)

    mountTimerRef.current = setTimeout(() => {
      if (!isAnimationFrame) {
        setIsAnimationFrame(true)
        requestAnimationFrame(() => {
          setMountedPages(new Set(tempMountedPages))
          console.debug(`Mounted page changed to: ${Array.from(mountedPages)}`)

          setIsAnimationFrame(false)
        })
      }
    }, 400)
  }, [tempMountedPages])

  // Observe all pages.
  useEffect(() => {
    const obs = observerRef.current
    if (!obs || !containerDiv.current) return

    const elements = containerDiv.current.querySelectorAll('.pdf-page')
    elements.forEach((el) => obs.observe(el))

    return () => {
      elements.forEach((el) => obs.unobserve(el))
    }
  }, [numPages, pageHeights])

  // Redraw when scale and rotation change
  useEffect(() => {
    calculatePageSize().then(() => {
      renderedPages.current.clear()

      const currentPageIndex = currentPageRef.current

      const renderOrder = [
        // Render the visible page first
        currentPageIndex - 1,
        // Then the page to be visibled
        currentPageIndex,
        currentPageIndex - 2,
        // Then the invisible page
        currentPageIndex + 1,
        currentPageIndex + 2,
        currentPageIndex + 3,
        currentPageIndex - 3
      ]

      renderOrder.forEach((page) => {
        renderPage(page, true)
      })
    })
  }, [scale, rotation])

  // Listen on zoom in/out event
  useEffect(() => {
    const container = containerDiv.current
    if (!container) return

    container.addEventListener('wheel', handleWheelEvent, { passive: false })

    return () => {
      container.removeEventListener('wheel', handleWheelEvent)
    }
  }, [scale, setScale])

  // ===============================================================================

  return (
    <div ref={containerDiv} className="pdf-viewer relative w-full h-full overflow-auto">
      {isLoading ? (
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
          <div>Loading PDF...</div>
        </div>
      ) : (
        <div className="flex flex-col items-center w-full gap-4">
          <div style={{ height: '50px', width: '100%' }} />
          {createCanvases()}
        </div>
      )}
    </div>
  )
}
