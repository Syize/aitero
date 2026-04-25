/**
 * Hook to handle scale transform.
 *    1. Provide a visual scale for onscreen canvas.
 *    2. Handle user scale event.
 *    3. Change PDF scale after user stop scaling.
 *
 * Interface
 *    - visualScale
 *    - getVisualScale()
 */

import { RefObject, useCallback, useEffect, useEffectEvent, useRef, useState } from 'react'
import { PageSize } from './document'

type ScaleHandler = {
  visualScale: number
  resetVisualScale: (scale: number) => void
}

export function useScaleHandler(
  canvasContainerRef: RefObject<HTMLDivElement | null>,
  containerRef: RefObject<HTMLDivElement | null>,
  scale: number,
  currentPage: number,
  pageSizes: PageSize[],
  setScale: (scale: number) => void,
  setIsProgramScroll: (value: boolean) => void
): ScaleHandler {
  const [visualScale, setVisualScale] = useState<number>(1)
  const visualScaleRef = useRef(visualScale)

  const isScalingRef = useRef(false)
  const lastWheelTimeRef = useRef(Date.now())

  const getTotalContentSize = useEffectEvent(
    useCallback(() => {
      let baseWidth = 0
      let baseHeight = 50 // Space on the top
      pageSizes.forEach((pageSize) => {
        if (pageSize.width > baseWidth) {
          baseWidth = pageSize.width
        }

        baseHeight += pageSize.height + 4 * 16
      })
      baseHeight -= 4 * 16

      return { baseWidth, baseHeight }
    }, [currentPage, pageSizes])
  )

  const resetVisualScale = useCallback((scale: number) => {
    setVisualScale(scale)
    visualScaleRef.current = scale
  }, [])

  /**
   * Handle WheelEvent.
   * @param event Wheel event.
   * @returns void
   */
  const handleWheelEvent = useCallback((event: WheelEvent) => {
    // Only response to ctrl event
    if (!event.ctrlKey) return

    // Prevent default behavior
    event.preventDefault()

    const container = containerRef.current
    if (!container) return

    const canvasContainer = canvasContainerRef.current
    if (!canvasContainer) return

    setIsProgramScroll(true)

    const { baseWidth } = getTotalContentSize()

    const rect = container.getBoundingClientRect()
    const cursorX = event.clientX - rect.left
    const cursorY = event.clientY - rect.top

    const oldScale = visualScaleRef.current

    // Scale existed canvas
    const zoomFactor = Math.exp(-event.deltaY * 0.001)
    let newScale = oldScale * zoomFactor
    newScale = Math.max(0.2, Math.min(5, newScale))
    const pageWidth = baseWidth * newScale

    const scaleRatio = newScale / oldScale
    const overflowX = pageWidth > container.clientWidth
    const overflowY = container.scrollHeight > container.clientHeight
    let newScrollLeft = 0
    let newMarginLeft = 0
    let newScrollTop = 0

    // Calculate the distance we need to scroll
    // X axis
    if (overflowX) {
      newScrollLeft = (container.scrollLeft + cursorX) * scaleRatio - cursorX
    } else {
      // Set margin left to make page center
      newMarginLeft = (container.clientWidth - pageWidth) / 2
    }

    // Y axis
    if (overflowY) {
      newScrollTop = (container.scrollTop + cursorY) * scaleRatio - cursorY
    }

    visualScaleRef.current = newScale
    setVisualScale(visualScaleRef.current)

    requestAnimationFrame(() => {
      canvasContainer.style.marginLeft = `${newMarginLeft}px`
      container.scrollTo({
        left: newScrollLeft,
        top: newScrollTop
      })
      lastWheelTimeRef.current = Date.now()
      isScalingRef.current = true
    })
  }, [])

  // Listen on zoom in/out event
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    container.addEventListener('wheel', handleWheelEvent, { passive: false })

    return () => {
      container.removeEventListener('wheel', handleWheelEvent)
    }
  }, [])

  // If scaling stops, update PDF scale's value.
  useEffect(() => {
    const interval = setInterval(() => {
      if (Date.now() - lastWheelTimeRef.current > 200 && isScalingRef.current) {
        console.debug(`Set scale to ${scale * visualScaleRef.current}`)
        setScale(visualScaleRef.current)

        isScalingRef.current = false
        setIsProgramScroll(false)
      }
    }, 100)

    return () => clearInterval(interval)
  }, [scale])

  // Set margin left when PDF is loaded
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const canvasContainer = canvasContainerRef.current
    if (!canvasContainer) return

    // Avoid shake (StrictMode will trigger effect twice)
    let ticking = true
    const { baseWidth } = getTotalContentSize()
    const pageWidth = baseWidth * visualScaleRef.current

    const overflowX = pageWidth > container.clientWidth
    let newMarginLeft = 0

    if (!overflowX) {
      // Set margin left to make page center
      newMarginLeft = (container.clientWidth - pageWidth) / 2
    }

    requestAnimationFrame(() => {
      if (ticking) {
        canvasContainer.style.marginLeft = `${newMarginLeft}px`
      }
    })

    return () => {
      ticking = false
    }
  }, [pageSizes])

  return { visualScale, resetVisualScale }
}
