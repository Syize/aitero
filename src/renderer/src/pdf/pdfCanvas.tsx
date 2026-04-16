// TODO:
//   1. Fix the bug that PDF will crash after several scales.
// NOTE:
//   1. React will rerender PDF after scaling, no need to use useEffect for scale.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './pdfCanvas.css'
import { useCanvasRegistry } from './pdfCanvas/canvas'
import { usePDFDocument } from './pdfCanvas/document'
import { Priority, useRenderScheduler } from './pdfCanvas/render'
import { useViewportManager } from './pdfCanvas/viewport'
import { usePDFContext } from './pdfState'
import { pdfLogger } from './utils'

function computePriority(pageIndex: number, currentPage: number): Priority {
  let dist = Math.abs(pageIndex - currentPage)

  switch (dist) {
    case 0:
      return 2

    case 1:
      return 1

    default:
      return 0
  }
}

export default function PDFCanvas() {
  const { state, setScale } = usePDFContext()
  const { scale, rotation, document: pdfDocument } = state

  const containerDiv = useRef<HTMLDivElement>(null)
  // const observerRef = useRef<IntersectionObserver | null>(null)
  // const canvasMap = useRef<Map<number, HTMLCanvasElement>>(new Map())
  // const offscreenMap = useRef<Map<number, HTMLCanvasElement>>(new Map())
  // const canvasRenderStatus = useRef<Map<number, boolean>>(new Map())

  // Custom hook
  const canvasRegistry = useCanvasRegistry()
  const { pageNum, pageSizes, isLoading } = usePDFDocument(pdfDocument, rotation)
  const { currentPage, mountedPages } = useViewportManager(containerDiv, pageNum)

  // Render function used by custom hook
  const renderExecutor = useCallback(
    async (pageIndex: number, version: number, getVersion: (pageIndex: number) => number) => {
      if (!pdfDocument) return

      const canvas = canvasRegistry.getCanvas(pageIndex)
      if (!canvas) {
        pdfLogger('Render', `Canvas doesn't exist for page ${pageIndex}, skip`, 'debug')
        return
      }

      pdfLogger('Render', `Render page ${pageIndex}`, 'debug')

      const page = await pdfDocument.getPage(pageIndex)
      const offscreen = canvasRegistry.getOffscreenCanvas(pageIndex)

      const task = page.render({
        canvasContext: offscreen.getContext('2d')!,
        canvas: offscreen,
        viewport: page.getViewport({
          scale,
          rotation
        })
      })

      // Copied rendered results to onscreen canvas
      task.promise.then(() => {
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
      })

      return task
    },
    [canvasRegistry]
  )

  const { schedule, newVersion } = useRenderScheduler(renderExecutor)

  // const renderedPages = useRef<Set<number>>(new Set())
  // const renderingPages = useRef<Set<number>>(new Set())
  // const renderTasks = useRef<Map<number, RenderTask>>(new Map())

  // const scaleTimerRef = useRef<NodeJS.Timeout | null>(null)
  // const mountTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Page numbers of PDF document
  // const [numPages, setNumPages] = useState(0)
  // const [pageHeights, setPageHeights] = useState<number[]>([])
  // const [pageWidths, setPageWidths] = useState<number[]>([])
  // const [isLoading, setIsLoading] = useState(true)
  // const { numPages, pageSizes, isLoading } = usePDFDocument(pdfDocument, rotation)

  // Scale of the on screen canvas
  // const [tempScale, setTempScale] = useState(scale)
  // const [visualScale, setVisualScale] = useState(scale)
  const [canvasScaleRatio, setCanvasScaleRatio] = useState(1)
  // const scaleRef = useRef(scale)
  const canvasScaleRef = useRef(scale)

  // const currentPageRef = useRef(1)
  const isScalingRef = useRef(false)
  // const isInAnimeFrameRef = useRef(false)

  // Mounted canvas index.
  // const [tempMountedPages, setTempMountedPages] = useState<Set<number>>(new Set())
  // const [mountedPages, setMountedPages] = useState<Set<number>>(new Set())
  // const setMountedPagesLaterRef = useRef(false)

  // const { mountedPages, currentPage } = useViewportManager(containerDiv, numPages)

  // const [isAnimationFrame, setIsAnimationFrame] = useState(false)
  // const [isScalingStable, setIsScalingStable] = useState(true)
  // const [isScrolling, setIsScrolling] = useState(false)
  // const [isRenderingScale, setIsRenderingScale] = useState(false)

  const lastWheelTimeRef = useRef(Date.now())

  // =========================== Utility functions =================================

  const requestRender = useCallback(
    (pageIndex: number) => {
      schedule(pageIndex, computePriority(pageIndex, currentPage))
    },
    [currentPage]
  )

  /**
   * Cancel page render task.
   * @param pageIndex Page index.
   */
  // function cancelRender(pageIndex: number) {
  //   const t = renderTasks.current.get(pageIndex)
  //   if (t) {
  //     try {
  //       t.cancel()
  //     } catch {}
  //     renderTasks.current.delete(pageIndex)
  //     renderingPages.current.delete(pageIndex)
  //   }
  // }

  /**
   * Calculate all page size.
   */
  // async function calculatePageSize() {
  //   const heights: number[] = []
  //   const widths: number[] = []

  //   for (let i = 1; i <= pdfDocument!.numPages; i++) {
  //     const page = await pdfDocument!.getPage(i)
  //     const viewport = page.getViewport({ scale, rotation })
  //     heights.push(viewport.height)
  //     widths.push(viewport.width)
  //   }

  //   setPageHeights(heights)
  //   setPageWidths(widths)
  // }

  // function resetScaleState() {
  //   setCanvasScaleRatio(1)
  //   canvasScaleRef.current = scale
  //   scaleRef.current = scale
  // }

  // =========================== Function definition ===============================

  /**
   * Initialize the page after uploading the PDF:
   *   1. Calculating page heights
   *   2. Turn off loading flag.
   */
  // async function initialize() {
  //   setIsLoading(true)
  //   await calculatePageSize()
  //   resetScaleState()
  //   // for (let i = 1; i <= numPages; i++) canvasRenderStatus.current.set(i, false)
  //   setIsLoading(false)
  // }

  /**
   * Render the specified PDF page.
   * @param pageIndex Page index.
   * @param force If force to render even it is rendered.
   * @returns
   */
  // async function renderPage(pageIndex: number, force: boolean = false) {
  //   if (renderedPages.current.has(pageIndex) && !force) {
  //     console.debug(`Page ${pageIndex} rendered, skip`)
  //     return
  //   }

  //   // if (force) {
  //   //   console.debug(`Force render page ${pageIndex}`)
  //   // } else {
  //   //   console.debug(`Render page ${pageIndex}`)
  //   // }

  //   renderedPages.current.delete(pageIndex)

  //   if (pageIndex < 1 || pageIndex > numPages) {
  //     console.debug(`Invalid page index, skip`)
  //     return
  //   }

  //   // Stop existed task, and re-render.
  //   if (renderingPages.current.has(pageIndex)) {
  //     console.log(`Stop and rerender page ${pageIndex}`)
  //     cancelRender(pageIndex)
  //   }

  //   renderingPages.current.add(pageIndex)

  //   // if (isScaled) calculatePageSize()

  //   const page = await pdfDocument!.getPage(pageIndex)
  //   const viewPort = page.getViewport({ scale, rotation })
  //   const dpr = window.devicePixelRatio || 1

  //   if (!offscreenMap.current.has(pageIndex)) {
  //     offscreenMap.current.set(pageIndex, document.createElement('canvas'))
  //   }

  //   const offscreen = offscreenMap.current.get(pageIndex)
  //   if (!offscreen) {
  //     console.error(`Off screen canvas not created for page ${pageIndex}`)
  //     return
  //   }

  //   offscreen.width = Math.floor(viewPort.width * dpr)
  //   offscreen.height = Math.floor(viewPort.height * dpr)

  //   const ctx = offscreen.getContext('2d')!
  //   ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

  //   const task = page.render({
  //     canvasContext: ctx,
  //     canvas: offscreen,
  //     viewport: viewPort
  //   })

  //   renderTasks.current.set(pageIndex, task)

  //   try {
  //     await task.promise

  //     // Copy offscreen result onto the visible canvas
  //     const visible = canvasMap.current.get(pageIndex)
  //     if (!visible) {
  //       console.error(`Canvas not created for page ${pageIndex}`)
  //       return
  //     }

  //     visible.width = offscreen.width
  //     visible.height = offscreen.height
  //     visible.getContext('2d')!.drawImage(offscreen, 0, 0)

  //     renderedPages.current.add(pageIndex)
  //   } catch (e: any) {
  //     if (e?.name !== 'RenderingCancelledException') {
  //       console.error(e)
  //     }
  //   } finally {
  //     renderingPages.current.delete(pageIndex)
  //     renderTasks.current.delete(pageIndex)
  //   }

  //   // canvasRenderStatus.current.set(pageIndex, false)
  //   // if (pageIndex === currentPageRef.current - 3) {
  //   //   setIsScalingStable(true)
  //   // }
  // }

  /**
   * Register or unregister visible canvas.
   * @param pageIndex Page index.
   * @param element Canvas element.
   */
  // function manageCanvas(pageIndex: number, element: HTMLCanvasElement | null) {
  //   if (element) {
  //     // console.debug(`Canvas created for page ${pageIndex}`)

  //     // Element created
  //     canvasMap.current.set(pageIndex, element)
  //     offscreenMap.current.set(pageIndex, document.createElement('canvas'))

  //     // if (!canvasRenderStatus.current.has(pageIndex))
  //     //   canvasRenderStatus.current.set(pageIndex, true)

  //     // render page
  //     console.debug(`Render trigerred at "manageCanvas" for page ${pageIndex}`)
  //     renderPage(pageIndex)
  //   } else {
  //     // Element destroied
  //     cancelRender(pageIndex)

  //     // clear rendered page
  //     renderedPages.current.delete(pageIndex)

  //     // delete offscreen cache
  //     const offscreenCanvas = offscreenMap.current.get(pageIndex)
  //     if (offscreenCanvas) {
  //       const ctx = offscreenCanvas.getContext('2d')
  //       ctx?.clearRect(0, 0, offscreenCanvas.width, offscreenCanvas.height)

  //       offscreenCanvas.width = 0
  //       offscreenCanvas.height = 0
  //       offscreenMap.current.delete(pageIndex)
  //     }
  //   }
  // }

  // Map page index to array index.
  const pages = useMemo(() => Array.from({ length: pageNum }, (_, i) => i + 1), [pageNum])

  /**
   * Create canvases and divs.
   * @returns JSX.Element[]
   */
  function createCanvases() {
    return pages.map((pageIndex, i) => {
      const height = pageSizes[i]?.height ?? 0 * scale
      const width = pageSizes[i]?.width ?? 0 * scale
      const isMounted = mountedPages.has(pageIndex)
      // const ratio = isScalingStable ? visualScale / scale : visualScale / visualScale

      return (
        <div
          key={pageIndex}
          className="pdf-page bg-white shadow"
          data-page={pageIndex}
          style={{
            height: height * canvasScaleRatio,
            width: width * canvasScaleRatio
          }}
        >
          {isMounted ? (
            <canvas
              ref={(el) => {
                canvasRegistry.registerCanvas(pageIndex, el)

                if (el) requestRender(pageIndex)
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

  /**
   * Handle WheelEvent.
   * @param event Wheel event.
   * @returns void
   */
  function handleWheelEvent(event: WheelEvent) {
    // Only response to ctrl event
    if (!event.ctrlKey) return

    // setIsScrolling(true)
    // isScrollingRef.current = true

    // Prevent default behavior
    event.preventDefault()
    // event.stopPropagation()

    // Scale existed canvas
    // const step = event.deltaY > 0 ? -0.1 : 0.1
    const zoomFactor = Math.exp(-event.deltaY * 0.001)
    // tempScaleRef.current *= zoomFactor
    canvasScaleRef.current *= zoomFactor

    console.debug(`Set canvas ratio to ${canvasScaleRef.current}`)
    // setCanvasScaleRatio(canvasScaleRatio * zoomFactor)

    requestAnimationFrame(() => {
      // setTempScale(tempScaleRef.current)
      // setVisualScale(visualScaleRef.current)
      setCanvasScaleRatio(canvasScaleRef.current)
      lastWheelTimeRef.current = Date.now()
      isScalingRef.current = true
    })
    // const newScale = Math.min(Math.max(tempScale * zoomFactor, 0.5), 3.0)
    // setTempScale(Number(newScale.toFixed(2)))
  }

  // =============================================================================

  // ========================= Listen on variable changes ========================

  // on mountedPages change
  useEffect(() => {
    if (!pdfDocument) return

    pdfLogger('Main', `mounted page: ${Array.from(mountedPages)}`, 'debug')
    mountedPages.forEach((pageIndex) => {
      requestRender(pageIndex)
    })
  }, [mountedPages, pdfDocument, requestRender])

  // on scale / rotation change
  useEffect(() => {
    if (!pdfDocument) return

    newVersion()

    mountedPages.forEach((pageIndex) => {
      requestRender(pageIndex)
    })
  }, [scale, rotation])

  // Initialization: Create empty div with page height.
  // useEffect(() => {
  //   if (!pdfDocument) return
  //   setNumPages(pdfDocument.numPages)

  //   initialize()
  // }, [pdfDocument, rotation])

  // Initialize IntersectionObserver
  // useEffect(() => {
  //   if (!containerDiv.current) return

  //   observerRef.current = new IntersectionObserver(
  //     (entries) => {
  //       // if (isScalingRef.current) return
  //       for (const entry of entries) {
  //         if (!entry.isIntersecting) continue

  //         const element = entry.target as HTMLElement
  //         const page = Number(element.dataset.page)

  //         currentPageRef.current = page
  //         console.log(`Current page change to page ${page}`)

  //         const next = new Set(mountedPages)

  //         // delete invisible page
  //         mountedPages.forEach((pageIndex) => {
  //           if (pageIndex < page - RENDER_BUFFER_NUM || pageIndex > page + RENDER_BUFFER_NUM) {
  //             next.delete(pageIndex)
  //           }
  //         })

  //         // add new visible page
  //         for (let i = page - RENDER_BUFFER_NUM; i <= page + RENDER_BUFFER_NUM; i++) {
  //           if (i >= 1 && i <= numPages) next.add(i)
  //         }

  //         // console.debug(`Mounted page changed to: ${Array.from(next)}`)
  //         setTempMountedPages(next)
  //       }
  //     },
  //     {
  //       root: containerDiv.current,
  //       rootMargin: '-1200px 0px 1200px 0px', // This seems to be right, doesn't know why
  //       threshold: 0.6
  //     }
  //   )

  //   return () => observerRef.current?.disconnect()
  // }, [numPages])

  // Set scale after wheel stop (400ms later).
  // useEffect(() => {
  //   if (scaleTimerRef.current) clearTimeout(scaleTimerRef.current)
  //   scaleTimerRef.current = setTimeout(() => {
  //     setScale(Number(tempScale.toFixed(2)))
  //   }, 400)
  // }, [tempScale])

  // Idle detection
  // useEffect(() => {
  //   const interval = setInterval(() => {
  //     if (Date.now() - lastWheelTimeRef.current > 150 && isScalingRef.current) {
  //       //
  //       // setIsRenderingScale(true)

  //       // Save the current scale to oldScale, to keep transform smooth.
  //       // console.debug(`Change old scale to `)
  //       // setOldScale(scale)
  //       // setIsScalingStable(false)
  //       // canvasRenderStatus.current.forEach((_, key) => {
  //       //   if (mountedPages.has(key)) canvasRenderStatus.current.set(key, true)
  //       // })

  //       console.debug(`Set scale to ${scale * canvasScaleRef.current}`)
  //       scaleRef.current *= canvasScaleRef.current
  //       setScale(scaleRef.current)

  //       // setIsScrolling(false)
  //       isScalingRef.current = false

  //       if (setMountedPagesLaterRef.current) {
  //         if (!isInAnimeFrameRef.current) {
  //           isInAnimeFrameRef.current = true
  //           // setIsAnimationFrame(true)
  //           requestAnimationFrame(() => {
  //             setMountedPages(new Set(tempMountedPages))
  //             console.debug(`Mounted page changed to: ${Array.from(mountedPages)}`)

  //             // setIsAnimationFrame(false)
  //             isInAnimeFrameRef.current = false
  //           })
  //         }

  //         setMountedPagesLaterRef.current = false
  //       }
  //     }
  //   }, 100)

  //   return () => clearInterval(interval)
  // }, [])

  // Set mounted page after scrolling stop (400ms later)
  // useEffect(() => {
  //   if (mountTimerRef.current) clearTimeout(mountTimerRef.current)

  //   mountTimerRef.current = setTimeout(() => {
  //     if (!isInAnimeFrameRef.current) {
  //       if (isScalingRef.current) {
  //         setMountedPagesLaterRef.current = true
  //       } else {
  //         isInAnimeFrameRef.current = true
  //         // setIsAnimationFrame(true)
  //         requestAnimationFrame(() => {
  //           setMountedPages(new Set(tempMountedPages))
  //           console.debug(`Mounted page changed to: ${Array.from(mountedPages)}`)

  //           // setIsAnimationFrame(false)
  //           isInAnimeFrameRef.current = false
  //         })
  //       }
  //       // isInAnimeFrameRef.current = true
  //       // // setIsAnimationFrame(true)
  //       // requestAnimationFrame(() => {
  //       //   setMountedPages(new Set(tempMountedPages))
  //       //   console.debug(`Mounted page changed to: ${Array.from(mountedPages)}`)

  //       //   // setIsAnimationFrame(false)
  //       //   isInAnimeFrameRef.current = false
  //       // })
  //     }
  //   }, 400)
  // }, [tempMountedPages])

  // Observe all pages.
  // useEffect(() => {
  //   const obs = observerRef.current
  //   if (!obs || !containerDiv.current) return

  //   const elements = containerDiv.current.querySelectorAll('.pdf-page')
  //   elements.forEach((el) => obs.observe(el))

  //   return () => {
  //     elements.forEach((el) => obs.unobserve(el))
  //   }
  // }, [numPages, pageHeights])

  // Redraw when scale and rotation change
  // useEffect(() => {
  //   if (!pdfDocument) return

  //   calculatePageSize().then(() => {
  //     // setIsScalingStable(true)
  //     renderedPages.current.clear()

  //     const currentPageIndex = currentPageRef.current

  //     const renderOrder = [
  //       // Render the visible page first
  //       currentPageIndex - 1,
  //       // Then the page to be visibled
  //       currentPageIndex,
  //       currentPageIndex - 2,
  //       // Then the invisible page
  //       currentPageIndex + 1,
  //       currentPageIndex + 2,
  //       currentPageIndex + 3,
  //       currentPageIndex - 3
  //     ]

  //     renderOrder.forEach((page) => {
  //       console.debug(`Render trigerred at "useEffect" for page ${page}`)
  //       renderPage(page, true)
  //     })
  //   })
  // }, [rotation])

  // useEffect(() => {
  //   // setIsScalingStable(true)
  //   // setCanvasScaleRatio(1)
  //   canvasScaleRef.current = 1
  //   setCanvasScaleRatio(canvasScaleRef.current)
  // }, [pageHeights, pageWidths])

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
