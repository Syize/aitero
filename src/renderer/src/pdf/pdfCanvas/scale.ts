/**
 * Hook to handle scale transform.
 *    1. Provide a visual scale for onscreen canvas.
 *    2. Handle user scale event.
 *    3. Change PDF scale after user stop scaling.
 *
 * Interface
 *    - visualScale
 */

import { RefObject, useCallback, useEffect, useEffectEvent, useRef, useState } from 'react'
import { PageSize } from './document'

type ScaleHandler = {
  visualScale: number
}

export function useScaleHandler(
  transformContainerRef: RefObject<HTMLDivElement | null>,
  containerRef: RefObject<HTMLDivElement | null>,
  scale: number,
  currentPage: number,
  pageSizes: PageSize[],
  setScale: (scale: number) => void,
  setIsProgramScroll: (value: boolean) => void
): ScaleHandler {
  const [visualScale, setVisualScale] = useState<number>(1)
  const tempVisualScaleRef = useRef(visualScale)

  const isScalingRef = useRef(false)
  const lastWheelTimeRef = useRef(Date.now())

  const getCurrentPageSize = useEffectEvent(
    useCallback(() => {
      const baseWidth = pageSizes[currentPage - 1].width
      const baseHeight = pageSizes[currentPage - 1].height

      return { baseWidth, baseHeight }
    }, [currentPage, pageSizes])
  )

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

    const transformContainer = transformContainerRef.current
    if (!transformContainer) return

    setIsProgramScroll(true)

    const { baseWidth, baseHeight } = getCurrentPageSize()

    const rect = container.getBoundingClientRect()
    const cursorX = event.clientX - rect.left
    const cursorY = event.clientY - rect.top

    const oldScale = tempVisualScaleRef.current

    // Scale existed canvas
    const zoomFactor = Math.exp(-event.deltaY * 0.001)
    let newScale = oldScale * zoomFactor
    tempVisualScaleRef.current = Math.max(0.2, Math.min(5, newScale))
    // tempVisualScaleRef.current *= zoomFactor

    const scaleRatio = tempVisualScaleRef.current / oldScale
    const contentWidth = baseWidth * tempVisualScaleRef.current
    const contentHeight = baseHeight * tempVisualScaleRef.current
    const containerWidth = container.clientWidth
    const containerHeight = container.clientHeight
    const overflowX = contentWidth > containerWidth
    const overflowY = contentHeight > containerHeight
    let newScrollLeft = container.scrollLeft
    let newScrollTop = container.scrollTop

    // X axis
    if (overflowX) {
      newScrollLeft = (container.scrollLeft + cursorX) * scaleRatio - cursorX
    } else {
      // 👉 居中
      newScrollLeft = (containerWidth - contentWidth) / 2
    }

    // Y axis
    if (overflowY) {
      newScrollTop = (container.scrollTop + cursorY) * scaleRatio - cursorY
    } else {
      newScrollTop = (containerHeight - contentHeight) / 2
    }

    console.debug(`Set canvas ratio to ${tempVisualScaleRef.current}`)

    setVisualScale(tempVisualScaleRef.current)
    transformContainer.style.transform = `scale(${tempVisualScaleRef.current})`

    requestAnimationFrame(() => {
      // setVisualScale(tempVisualScaleRef.current)
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
        console.debug(`Set scale to ${scale * tempVisualScaleRef.current}`)
        setScale(tempVisualScaleRef.current)

        isScalingRef.current = false
        setIsProgramScroll(false)
      }
    }, 100)

    return () => clearInterval(interval)
  }, [scale])

  return { visualScale }
}
