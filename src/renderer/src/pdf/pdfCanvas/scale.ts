/**
 * Hook to handle scale transform.
 *    1. Provide a visual scale for onscreen canvas.
 *    2. Handle user scale event.
 *    3. Change PDF scale after user stop scaling.
 *
 * Interface
 *    - visualScale
 */

import { RefObject, useEffect, useRef, useState } from 'react'

type ScaleHandler = {
  visualScale: number
}

export function useScaleHandler(
  containerRef: RefObject<HTMLDivElement | null>,
  scale: number,
  setScale: (scale: number) => void
): ScaleHandler {
  const [visualScale, setVisualScale] = useState<number>(1)
  const tempVisualScaleRef = useRef(visualScale)

  const isScalingRef = useRef(false)
  const lastWheelTimeRef = useRef(Date.now())

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

    // Scale existed canvas
    const zoomFactor = Math.exp(-event.deltaY * 0.001)
    tempVisualScaleRef.current *= zoomFactor

    console.debug(`Set canvas ratio to ${tempVisualScaleRef.current}`)

    requestAnimationFrame(() => {
      setVisualScale(tempVisualScaleRef.current)
      lastWheelTimeRef.current = Date.now()
      isScalingRef.current = true
    })
  }

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
      if (Date.now() - lastWheelTimeRef.current > 150 && isScalingRef.current) {
        console.debug(`Set scale to ${scale * tempVisualScaleRef.current}`)
        setScale(tempVisualScaleRef.current)

        isScalingRef.current = false
      }
    }, 100)

    return () => clearInterval(interval)
  }, [scale])

  return { visualScale }
}
