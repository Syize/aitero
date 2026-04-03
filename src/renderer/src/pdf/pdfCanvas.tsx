// TODO:
//   1. Review the code.
//   2. Fix the issue that page won't be rendered when scroll too fast.
//   3. Fix the issue that performence bad in tauri.
//   4. Possible solution for #2: Add render queue.
import { useEffect, useMemo, useRef, useState } from 'react'
import './pdfCanvas.css'
import { usePDFContext } from './pdfState'

const PAGE_BUFFER_NUM = 6
const RENDER_BUFFER_NUM = 2
const MAX_RENDER_NUM = 2

export default function PDFCanvas() {
  const { state } = usePDFContext()
  // const { canvasState, setPanelOffset, setIsInitialized } = useCanvasContext()
  const { scale, rotation, document } = state
  const containerDiv = useRef<HTMLDivElement>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const canvasMap = useRef<Map<number, HTMLCanvasElement>>(new Map())

  const renderedPages = useRef<Set<number>>(new Set())
  const renderingPages = useRef<Set<number>>(new Set())
  const renderTasks = useRef<Map<number, any>>(new Map())

  const [numPages, setNumPages] = useState(0)
  const [pageHeights, setPageHeights] = useState<number[]>([])
  const [pageWidths, setPageWidths] = useState<number[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const currentPageRef = useRef(1)
  const [visibleRange, setVisibleRange] = useState({ start: 1, end: 1 })

  let active = 0

  // ========================= Listen on variable changes ========================

  // Initialization: Create empty div with page height.
  useEffect(() => {
    if (!document) return
    setNumPages(document.numPages)

    async function initialize() {
      setIsLoading(true)
      const heights: number[] = []
      const widths: number[] = []

      for (let i = 1; i <= document!.numPages; i++) {
        const page = await document!.getPage(i)
        const viewPort = page.getViewport({ scale, rotation })
        heights.push(viewPort.height)
        widths.push(viewPort.width)
      }

      setPageHeights(heights)
      setPageWidths(widths)

      setVisibleRange({
        start: 1,
        end: Math.min(document!.numPages, 1 + PAGE_BUFFER_NUM)
      })

      setIsLoading(false)
    }

    initialize()
  }, [document, scale, rotation])

  // Initialize IntersectionObserver
  useEffect(() => {
    if (!containerDiv.current) return

    let ticking = false

    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue

          const element = entry.target as HTMLElement
          const page = Number(element.dataset.page)

          currentPageRef.current = page

          if (!ticking) {
            ticking = true
            requestAnimationFrame(() => {
              const start = Math.max(1, page - PAGE_BUFFER_NUM)
              const end = Math.min(numPages, page + PAGE_BUFFER_NUM)
              setVisibleRange({ start, end })
              ticking = false
            })
          }

          if (farAway(page)) unmountCanvas(page)
        }
      },
      {
        root: containerDiv.current,
        rootMargin: '600px 0px',
        threshold: 0.6
      }
    )

    return () => observerRef.current?.disconnect()
  }, [numPages])

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
    renderedPages.current.clear()

    const canvases = containerDiv.current?.querySelectorAll('canvas')
    canvases?.forEach((c) => {
      const ctx = c.getContext('2d')
      ctx?.clearRect(0, 0, c.width, c.height)
    })
  }, [scale, rotation])

  useEffect(() => {
    renderTasks.current.forEach((_, page) => {
      if (!isInWindow(page)) cancelRender(page)
    })
  }, [visibleRange])

  // ===============================================================================

  // =========================== Function definition ===============================
  async function renderPage(pageIndex: number, canvas: HTMLCanvasElement) {
    if (renderedPages.current.has(pageIndex)) return
    if (renderingPages.current.has(pageIndex)) return
    if (active >= MAX_RENDER_NUM) return

    active++

    renderingPages.current.add(pageIndex)

    const page = await document!.getPage(pageIndex)
    const viewPort = page.getViewport({ scale, rotation })
    const dpr = window.devicePixelRatio || 1

    canvas.width = Math.floor(viewPort.width * dpr)
    canvas.height = Math.floor(viewPort.height * dpr)
    canvas.style.width = `${viewPort.width}px`
    canvas.style.height = `${viewPort.height}px`

    const ctx = canvas.getContext('2d')!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const task = page.render({
      canvasContext: ctx,
      canvas,
      viewport: viewPort
    })

    renderTasks.current.set(pageIndex, task)

    try {
      await task.promise
      renderedPages.current.add(pageIndex)
    } catch (e: any) {
      if (e?.name !== 'RenderingCancelledException') {
        console.error(e)
      }
    } finally {
      renderingPages.current.delete(pageIndex)
      renderTasks.current.delete(pageIndex)
      active--
    }
  }

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

  const isInWindow = (page: number) => {
    return page >= visibleRange.start && page <= visibleRange.end
  }

  function registerCanvas(pageIndex: number, element: HTMLCanvasElement | null) {
    if (element) {
      canvasMap.current.set(pageIndex, element)
      if (isInRenderRange(pageIndex)) {
        renderPage(pageIndex, element)
      }
    } else {
      // 卸载：取消可能的渲染
      canvasMap.current.delete(pageIndex)
      cancelRender(pageIndex)
    }
  }

  const pages = useMemo(() => Array.from({ length: numPages }, (_, i) => i + 1), [numPages])

  const isInRenderRange = (page: number) => {
    return (
      page >= currentPageRef.current - RENDER_BUFFER_NUM &&
      page <= currentPageRef.current + RENDER_BUFFER_NUM
    )
  }

  function farAway(page: number) {
    const current = currentPageRef.current

    return Math.abs(page - current) > PAGE_BUFFER_NUM * 2
  }

  function unmountCanvas(pageIndex: number) {
    // Cancel render task
    const task = renderTasks.current.get(pageIndex)
    if (task) {
      try {
        task.cancel()
      } catch {}
      renderTasks.current.delete(pageIndex)
    }

    renderedPages.current.delete(pageIndex)
    renderingPages.current.delete(pageIndex)

    const canvas = canvasMap.current.get(pageIndex)
    if (canvas) {
      const ctx = canvas.getContext('2d')
      ctx?.clearRect(0, 0, canvas.width, canvas.height)

      canvas.width = 0
      canvas.height = 0
    }

    canvasMap.current.delete(pageIndex)
  }

  // ==================================================================

  return (
    <div ref={containerDiv} className="pdf-viewer relative w-full h-full overflow-auto">
      {isLoading ? (
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
          <div>Loading PDF...</div>
        </div>
      ) : (
        <div className="flex flex-col items-center w-full">
          {pages.map((pageIndex, i) => {
            const height = pageHeights[i]
            const width = pageWidths[i]
            const visible = isInWindow(pageIndex)

            return (
              <div
                key={pageIndex}
                className="pdf-page bg-white shadow"
                data-page={pageIndex}
                style={{
                  height,
                  width,
                  display: 'flex',
                  justifyContent: 'center'
                }}
              >
                {visible ? (
                  <canvas ref={(el) => registerCanvas(pageIndex, el)} style={{ width, height }} />
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
          })}
        </div>
      )}
    </div>
  )
}
