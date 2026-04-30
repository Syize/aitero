import { pdfLogger } from '@/pdf/utils'
import type { PDFPageProxy } from 'pdfjs-dist'
import { useCallback, useEffectEvent, useRef } from 'react'
import type { Priority } from './render'

type QueueItem = {
  pageIndex: number
  priority: Priority
  version: number
  force: boolean
}

type RunningItem = {
  version: number
}

type CancelableTextLayer = {
  cancel: () => void
}

export type PageTextContent = Awaited<ReturnType<PDFPageProxy['getTextContent']>>

export type TextLayerHelpers = {
  getTextLayer: (pageIndex: number) => HTMLDivElement | null
  getTextContent: (pageIndex: number) => PageTextContent | null
  setTextContent: (pageIndex: number, textContent: PageTextContent) => void
  clearTextContent: (pageIndex: number) => void
  hasTextContent: (pageIndex: number) => boolean
  getRenderInstance: (pageIndex: number) => CancelableTextLayer | null
  setRenderInstance: (pageIndex: number, textLayer: CancelableTextLayer | null) => void
  clearRenderedTextLayer: (pageIndex: number) => void
  isRendered: (pageIndex: number) => boolean
  markRendered: (pageIndex: number) => void
  unmarkRendered: (pageIndex: number) => void
}

type TextLayerExecutor = (
  pageIndex: number,
  version: number,
  force: boolean,
  getVersion: (pageIndex: number) => number,
  helpers: TextLayerHelpers
) => Promise<void>

type TextLayer = {
  registerTextLayer: (pageIndex: number, el: HTMLDivElement | null, isClearCache: boolean) => void
  getTextLayer: (pageIndex: number) => HTMLDivElement | null
  unregisterTextLayer: (pageIndex: number, isClearCache: boolean) => void
  unregisterAllTextLayer: () => void
  getTextContent: (pageIndex: number) => PageTextContent | null
  hasTextContent: (pageIndex: number) => boolean
  clearRenderedTextLayer: (pageIndex: number) => void
  clearAllRenderedTextLayers: () => void
  scheduleTextLayerTask: (pageIndex: number, priority: Priority, force?: boolean) => void
  cancelTextLayerTask: (pageIndex: number) => void
  cancelAllTextLayerTask: () => void
  newTextLayerVersion: () => number
  getTextLayerVersion: () => number
}

function clearRoot(root: HTMLDivElement | undefined) {
  if (!root) return

  root.replaceChildren()
}

const MAX_CONCURRENCY = 3

export function useTextLayer(executor: TextLayerExecutor): TextLayer {
  const textLayerMap = useRef<Map<number, HTMLDivElement>>(new Map())
  const textContentMap = useRef<Map<number, PageTextContent>>(new Map())
  const renderedTextLayerMap = useRef<Map<number, CancelableTextLayer>>(new Map())
  const isTextLayerRenderedMap = useRef<Set<number>>(new Set())
  const queueRef = useRef<QueueItem[]>([])
  const runningRef = useRef<Map<number, RunningItem>>(new Map())
  const versionRef = useRef(0)

  // ===================== Text layer root =====================

  const registerTextLayer = useCallback(
    (pageIndex: number, el: HTMLDivElement | null, isClearCache: boolean) => {
      if (el) {
        textLayerMap.current.set(pageIndex, el)
        pdfLogger('TextLayer', `Text layer created for page ${pageIndex}`, 'debug')
      } else {
        unregisterTextLayer(pageIndex, isClearCache)
      }
    },
    []
  )

  const getTextLayer = useCallback((pageIndex: number) => {
    return textLayerMap.current.get(pageIndex) ?? null
  }, [])

  const getTextContent = useCallback((pageIndex: number) => {
    return textContentMap.current.get(pageIndex) ?? null
  }, [])

  const hasTextContent = useCallback((pageIndex: number) => {
    return textContentMap.current.has(pageIndex)
  }, [])

  // ===================== Text content =====================

  const setTextContent = useCallback((pageIndex: number, textContent: PageTextContent) => {
    textContentMap.current.set(pageIndex, textContent)
  }, [])

  const clearTextContent = useCallback((pageIndex: number) => {
    textContentMap.current.delete(pageIndex)
  }, [])

  // ===================== Rendered state =====================

  const getRenderInstance = useCallback((pageIndex: number) => {
    return renderedTextLayerMap.current.get(pageIndex) ?? null
  }, [])

  const setRenderInstance = useCallback(
    (pageIndex: number, textLayer: CancelableTextLayer | null) => {
      if (textLayer) {
        renderedTextLayerMap.current.set(pageIndex, textLayer)
      } else {
        renderedTextLayerMap.current.delete(pageIndex)
      }
    },
    []
  )

  const isRendered = useCallback((pageIndex: number) => {
    return isTextLayerRenderedMap.current.has(pageIndex)
  }, [])

  const markRendered = useCallback((pageIndex: number) => {
    isTextLayerRenderedMap.current.add(pageIndex)
  }, [])

  const unmarkRendered = useCallback((pageIndex: number) => {
    isTextLayerRenderedMap.current.delete(pageIndex)
  }, [])

  // ===================== Cleanup =====================

  const clearRenderedTextLayer = useCallback((pageIndex: number) => {
    const renderedTextLayer = renderedTextLayerMap.current.get(pageIndex)
    if (renderedTextLayer) {
      try {
        renderedTextLayer.cancel()
      } catch {}
      renderedTextLayerMap.current.delete(pageIndex)
    }

    const root = textLayerMap.current.get(pageIndex)
    clearRoot(root)
    isTextLayerRenderedMap.current.delete(pageIndex)
    pdfLogger('TextLayer', `Rendered text layer cleared for page ${pageIndex}`, 'debug')
  }, [])

  const clearAllRenderedTextLayers = useCallback(() => {
    renderedTextLayerMap.current.forEach((renderedTextLayer) => {
      try {
        renderedTextLayer.cancel()
      } catch {}
    })

    renderedTextLayerMap.current.clear()
    textLayerMap.current.forEach((root) => {
      clearRoot(root)
    })
    isTextLayerRenderedMap.current.clear()
    pdfLogger('TextLayer', 'All rendered text layers cleared', 'debug')
  }, [])

  const unregisterTextLayer = useCallback((pageIndex: number, isClearCache: boolean) => {
    if (isClearCache) {
      textContentMap.current.delete(pageIndex)
      clearRenderedTextLayer(pageIndex)
      pdfLogger('TextLayer', `Text layer cache cleared for page ${pageIndex}`, 'debug')
    }

    textLayerMap.current.delete(pageIndex)
    pdfLogger('TextLayer', `Text layer removed for page ${pageIndex}`, 'debug')
  }, [])

  const unregisterAllTextLayer = useCallback(() => {
    clearAllRenderedTextLayers()
    textContentMap.current.clear()
    textLayerMap.current.clear()
    pdfLogger('TextLayer', 'All text layers removed', 'debug')
  }, [])

  // ===================== Version =====================

  const newTextLayerVersion = useCallback(() => {
    versionRef.current++
    cancelAllTextLayerTask()
    clearAllRenderedTextLayers()
    return versionRef.current
  }, [])

  const getTextLayerVersion = useCallback(() => versionRef.current, [])

  // ===================== Queue =====================

  const sortQueue = () => {
    queueRef.current.sort((a, b) => a.priority - b.priority)
  }

  const helpers: TextLayerHelpers = {
    getTextLayer,
    getTextContent,
    setTextContent,
    clearTextContent,
    hasTextContent,
    getRenderInstance,
    setRenderInstance,
    clearRenderedTextLayer,
    isRendered,
    markRendered,
    unmarkRendered
  }

  const execute = useCallback(
    async (item: QueueItem) => {
      const { pageIndex, version, force } = item

      if (version !== versionRef.current) {
        pdfLogger('TextLayer', `Outdated text layer task for page ${pageIndex}, skip`, 'debug')
        return
      }

      try {
        runningRef.current.set(pageIndex, { version })
        await executor(pageIndex, version, force, getTextLayerVersion, helpers)

        if (version !== versionRef.current) {
          pdfLogger(
            'TextLayer',
            `Outdated text layer results for page ${pageIndex}, discard`,
            'debug'
          )
          return
        }
      } catch (e: any) {
        if (e?.name !== 'AbortException') {
          pdfLogger('TextLayer', `Text layer render error: ${e}`, 'error')
        }
      } finally {
        runningRef.current.delete(pageIndex)
        runNext()
      }
    },
    [executor, getTextLayerVersion]
  )

  const runNext = useEffectEvent(
    useCallback(() => {
      while (runningRef.current.size < MAX_CONCURRENCY && queueRef.current.length > 0) {
        const item = queueRef.current.shift()!

        if (item.version !== versionRef.current) {
          pdfLogger(
            'TextLayer',
            `Outdated queued text task for page ${item.pageIndex}, skip`,
            'debug'
          )
          continue
        }

        execute(item)
      }
    }, [execute])
  )

  const scheduleTextLayerTask = useCallback(
    (pageIndex: number, priority: Priority = 1, force: boolean = false) => {
      const version = versionRef.current

      if (runningRef.current.has(pageIndex)) {
        pdfLogger(
          'TextLayer',
          `Text layer of page ${pageIndex} is already rendering, skip schedule`,
          'debug'
        )
        return
      }

      if (isTextLayerRenderedMap.current.has(pageIndex) && !force) {
        pdfLogger('TextLayer', `Text layer cache hit for page ${pageIndex}, skip schedule`, 'debug')
        return
      }

      const existing = queueRef.current.find((t) => t.pageIndex === pageIndex)
      if (existing) {
        existing.priority = existing.priority > priority ? priority : existing.priority
        existing.force = existing.force || force
        pdfLogger(
          'TextLayer',
          `Page ${pageIndex} is already waiting to render text layer, change priority to ${existing.priority}`,
          'debug'
        )
        return
      }

      queueRef.current.push({ pageIndex, priority, version, force })
      pdfLogger('TextLayer', `Commit text layer task for page ${pageIndex}`, 'debug')

      sortQueue()
      runNext()
    },
    []
  )

  // ===================== Cancel =====================

  const cancelTextLayerTask = useCallback((pageIndex: number) => {
    queueRef.current = queueRef.current.filter((t) => t.pageIndex !== pageIndex)

    const renderedTextLayer = renderedTextLayerMap.current.get(pageIndex)
    if (renderedTextLayer) {
      try {
        renderedTextLayer.cancel()
      } catch {}
      renderedTextLayerMap.current.delete(pageIndex)
    }

    isTextLayerRenderedMap.current.delete(pageIndex)
    runningRef.current.delete(pageIndex)
    pdfLogger('TextLayer', `Text layer task of page ${pageIndex} is canceled.`, 'info')
  }, [])

  const cancelAllTextLayerTask = useCallback(() => {
    queueRef.current = []

    renderedTextLayerMap.current.forEach((renderedTextLayer) => {
      try {
        renderedTextLayer.cancel()
      } catch {}
    })

    renderedTextLayerMap.current.clear()
    isTextLayerRenderedMap.current.clear()
    runningRef.current.clear()
    pdfLogger('TextLayer', 'All text layer tasks are canceled.', 'info')
  }, [])

  // ===================== Expose =====================

  return {
    registerTextLayer,
    getTextLayer,
    unregisterTextLayer,
    unregisterAllTextLayer,
    getTextContent,
    hasTextContent,
    clearRenderedTextLayer,
    clearAllRenderedTextLayers,
    scheduleTextLayerTask,
    cancelTextLayerTask,
    cancelAllTextLayerTask,
    newTextLayerVersion,
    getTextLayerVersion
  }
}
