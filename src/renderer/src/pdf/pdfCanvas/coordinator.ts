/**
 * Hook to brige other hooks.
 *    1. Bridge all other hooks.
 *    2. Setup effects.
 */

import type { PDFDocumentProxy } from 'pdfjs-dist'
import { useCallback, useEffect, useRef } from 'react'
import { useRenderScheduler } from './useRenderScheduler'

type Priority = 0 | 1 | 2

type Params = {
  pdfDocument: PDFDocumentProxy | null
  canvasRegistry: {
    getCanvas: (pageIndex: number) => HTMLCanvasElement | null
    getOffscreen: (pageIndex: number) => HTMLCanvasElement
  }
  mountedPages: Set<number>
  currentPage: number
  scale: number
  rotation: number
}

export function useRenderCoordinator({
  pdfDocument,
  canvasRegistry,
  mountedPages,
  currentPage,
  scale,
  rotation
}: Params) {
  // ===================== refs =====================

  const pdfRef = useRef(pdfDocument)
  const scaleRef = useRef(scale)
  const rotationRef = useRef(rotation)

  useEffect(() => {
    pdfRef.current = pdfDocument
  }, [pdfDocument])

  useEffect(() => {
    scaleRef.current = scale
  }, [scale])

  useEffect(() => {
    rotationRef.current = rotation
  }, [rotation])

  // ===================== executor =====================

  const executor = useCallback(
    async (pageIndex: number, version: number) => {
      const pdf = pdfRef.current
      if (!pdf) return null

      const canvas = canvasRegistry.getCanvas(pageIndex)
      if (!canvas) return null

      const page = await pdf.getPage(pageIndex)
      const offscreen = canvasRegistry.getOffscreen(pageIndex)

      const task = page.render({
        canvasContext: offscreen.getContext('2d')!,
        canvas: offscreen,
        viewport: page.getViewport({
          scale: scaleRef.current,
          rotation: rotationRef.current
        })
      })

      task.promise.then(() => {
        // version check
        if (version !== scheduler.getVersion()) return

        const visible = canvasRegistry.getCanvas(pageIndex)
        if (!visible) return

        visible.width = offscreen.width
        visible.height = offscreen.height
        visible.getContext('2d')!.drawImage(offscreen, 0, 0)
      })

      return task
    },
    [canvasRegistry]
  )

  // ===================== scheduler =====================

  const scheduler = useRenderScheduler(executor, {
    concurrency: 3
  })

  // ===================== priority =====================

  const computePriority = useCallback(
    (pageIndex: number): Priority => {
      const dist = Math.abs(pageIndex - currentPage)

      if (dist === 0) return 0
      if (dist === 1) return 1
      return 2
    },
    [currentPage]
  )

  // ===================== public API =====================

  const requestRender = useCallback(
    (pageIndex: number, priority?: Priority) => {
      scheduler.schedule(pageIndex, priority ?? computePriority(pageIndex))
    },
    [scheduler, computePriority]
  )

  const handleCanvasMount = useCallback(
    (pageIndex: number) => {
      requestRender(pageIndex)
    },
    [requestRender]
  )

  // ===================== mountedPages 触发 =====================

  useEffect(() => {
    if (!pdfDocument) return

    mountedPages.forEach((pageIndex) => {
      requestRender(pageIndex)
    })
  }, [mountedPages, pdfDocument, requestRender])

  // ===================== scale / rotation =====================

  useEffect(() => {
    if (!pdfDocument) return

    scheduler.newVersion()

    mountedPages.forEach((pageIndex) => {
      requestRender(pageIndex, computePriority(pageIndex))
    })
  }, [scale, rotation])

  return {
    requestRender,
    handleCanvasMount
  }
}
