/**
 * Hook to manage canvas.
 *    1. Register canvas created by React.
 *    2. Create offscreen canvas when registering onscreen canvas.
 *    3. Clear specific on/off-screen canvas, release GPU resource.
 *    4. Clear all canvas.
 *
 * Interface:
 *    - registerCanvas()
 *    - getCanvas()
 *    - getOffscreenCanvas()
 *    - unregisterCanvas()
 *    - unregisterAll()
 *
 * Progress: Finished.
 */

import { useCallback, useRef } from 'react'
import { pdfLogger } from '../utils'

type CanvasRegistry = {
  registerCanvas: (pageIndex: number, el: HTMLCanvasElement | null) => void
  getCanvas: (pageIndex: number) => HTMLCanvasElement | null
  getOffscreenCanvas: (pageIndex: number) => HTMLCanvasElement
  unregisterCanvas: (pageIndex: number) => void
  unregisterAll: () => void
}

export function useCanvasRegistry(notClearOffscreenFunc: () => boolean): CanvasRegistry {
  const canvasMap = useRef<Map<number, HTMLCanvasElement>>(new Map())
  const offscreenMap = useRef<Map<number, HTMLCanvasElement>>(new Map())

  // ===================== Canvas =====================

  const registerCanvas = useCallback((pageIndex: number, el: HTMLCanvasElement | null) => {
    if (el) {
      // mount
      canvasMap.current.set(pageIndex, el)
      pdfLogger('Canvas', 'Canvas created', 'debug')

      // Create offscreen cavans.
      if (!offscreenMap.current.has(pageIndex)) {
        offscreenMap.current.set(pageIndex, document.createElement('canvas'))
        pdfLogger('Canvas', 'Offscreen canvas created', 'debug')
      }
      // pdfLogger('Canvas', 'Offscreen canvas created', 'debug')
    } else {
      // unmount
      unregisterCanvas(pageIndex)
    }
  }, [])

  const getCanvas = useCallback((pageIndex: number) => {
    return canvasMap.current.get(pageIndex) ?? null
  }, [])

  // ===================== Offscreen =====================

  const getOffscreenCanvas = useCallback((pageIndex: number) => {
    let offscreen = offscreenMap.current.get(pageIndex)

    if (!offscreen) {
      offscreen = document.createElement('canvas')
      offscreenMap.current.set(pageIndex, offscreen)
    }

    return offscreen
  }, [])

  // ===================== Cleanup =====================

  const unregisterCanvas = useCallback((pageIndex: number) => {
    // remove visible
    canvasMap.current.delete(pageIndex)
    pdfLogger('Canvas', 'Canvas removed', 'debug')

    // Clear offscreen, release GPU resource.
    // Why we need this?
    // Because react WILL re-create canvas when scaling, but we don't want to rerender PDF.
    // So keep old offscreen canvas, use old results.
    if (!notClearOffscreenFunc()) {
      const offscreen = offscreenMap.current.get(pageIndex)
      if (offscreen) {
        const ctx = offscreen.getContext('2d')
        ctx?.clearRect(0, 0, offscreen.width, offscreen.height)

        offscreen.width = 0
        offscreen.height = 0

        offscreenMap.current.delete(pageIndex)
      }
      pdfLogger('Canvas', 'Offscreen canvas removed', 'debug')
    }
    // const offscreen = offscreenMap.current.get(pageIndex)
    // if (offscreen) {
    //   const ctx = offscreen.getContext('2d')
    //   ctx?.clearRect(0, 0, offscreen.width, offscreen.height)

    //   offscreen.width = 0
    //   offscreen.height = 0

    //   offscreenMap.current.delete(pageIndex)
    // }

    // pdfLogger('Canvas', 'Offscreen canvas removed', 'debug')
  }, [])

  const unregisterAll = useCallback(() => {
    canvasMap.current.clear()

    offscreenMap.current.forEach((canvas) => {
      const ctx = canvas.getContext('2d')
      ctx?.clearRect(0, 0, canvas.width, canvas.height)

      canvas.width = 0
      canvas.height = 0
    })

    offscreenMap.current.clear()
  }, [])

  // ===================== Expose =====================

  return {
    registerCanvas,
    getCanvas,
    getOffscreenCanvas,
    unregisterCanvas,
    unregisterAll
  }
}
