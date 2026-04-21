/**
 * Hook to schedule render task (when to render which page).
 *    1. Schedule render task.
 *    2. Cancel a task.
 *    3. Cancel all task.
 *    4. Decide if the task is outdated (render option has changed).
 *    5. Only manage render task. Render is finished by outer function.
 *
 * Interface
 *    - schedule()
 *    - cancel()
 *    - cancelAll()
 *    - newVersion()
 *    - getVersion()
 */

import { pdfLogger } from '@/pdf/utils'
import type { RenderTask } from 'pdfjs-dist'
import { useCallback, useEffect, useRef } from 'react'

export type Priority = 0 | 1 | 2

type QueueItem = {
  pageIndex: number
  priority: Priority
  version: number
  force: boolean
}

type RunningItem = {
  task: RenderTask
  version: number
}

type RenderScheduler = {
  schedule: (pageIndex: number, priority: Priority) => void
  cancel: (pageIndex: number) => void
  cancelAll: () => void
  newVersion: () => number
  getVersion: () => number
}

type RenderExecutor = (
  pageIndex: number,
  version: number,
  force: boolean,
  getVersion: (pageIndex: number) => number
) => Promise<RenderTask | void>

export function useRenderScheduler(
  executor: RenderExecutor,
  maxConcurrency: number = 3
): RenderScheduler {
  const queueRef = useRef<QueueItem[]>([])
  const runningRef = useRef<Map<number, RunningItem>>(new Map())
  const versionRef = useRef(0)

  const runNextRef = useRef<() => void>(null)

  // ===================== version =====================

  const newVersion = useCallback(() => {
    versionRef.current++
    cancelAll()
    return versionRef.current
  }, [])

  const getVersion = useCallback(() => versionRef.current, [])

  // ===================== queue =====================

  const sortQueue = () => {
    queueRef.current.sort((a, b) => a.priority - b.priority)
  }

  const schedule = useCallback(
    (pageIndex: number, priority: Priority = 1, force: boolean = false) => {
      const version = versionRef.current

      // Is running, skip.
      // But need to commit a new task after the version has changed?
      if (runningRef.current.has(pageIndex)) {
        pdfLogger('Render', `Page ${pageIndex} is already rendering, skip`, 'debug')
        return
      }

      // Commited, update priority.
      const existing = queueRef.current.find((t) => t.pageIndex === pageIndex)

      if (existing) {
        existing.priority = existing.priority > priority ? priority : existing.priority
        pdfLogger(
          'Render',
          `Page ${pageIndex} is already waiting to be rendered, change priority to ${existing.priority}`,
          'debug'
        )
        return
      }

      queueRef.current.push({ pageIndex, priority, version, force })
      pdfLogger('Render', `Commit render task for page ${pageIndex}`, 'debug')

      sortQueue()
      runNextRef.current?.()
    },
    []
  )

  // ===================== execution =====================

  const execute = useCallback(
    async (item: QueueItem) => {
      const { pageIndex, version, force } = item
      // Version check
      if (version !== versionRef.current) {
        pdfLogger('Render', `Outdated task for page ${pageIndex}, skip`, 'debug')
        return
      }

      try {
        const task = await executor(pageIndex, version, force, getVersion)

        if (!task) return

        runningRef.current.set(pageIndex, { task, version })

        await task.promise

        // Version check again
        if (version !== versionRef.current) {
          pdfLogger('Render', `Outdated results for page ${pageIndex}, discard`, 'debug')
          return
        }
      } catch (e: any) {
        if (e?.name !== 'RenderingCancelledException') {
          pdfLogger('Render', `Render error: ${e}`, 'error')
        }
      } finally {
        runningRef.current.delete(pageIndex)
        runNextRef.current?.()
      }
    },
    [executor]
  )

  const runNext = useCallback(() => {
    pdfLogger(
      'Render',
      `Running task number: ${runningRef.current.size}, queue task number: ${queueRef.current.length}`,
      'debug'
    )
    while (runningRef.current.size < maxConcurrency && queueRef.current.length > 0) {
      const item = queueRef.current.shift()!

      // version outdated.
      if (item.version !== versionRef.current) {
        pdfLogger('Render', `Outdated task for page ${item.pageIndex}, skip`, 'debug')
        continue
      }

      execute(item)
    }
  }, [execute, maxConcurrency])

  // ===================== cancel =====================

  const cancel = useCallback((pageIndex: number) => {
    // cancel running
    const running = runningRef.current.get(pageIndex)
    if (running) {
      try {
        running.task.cancel()
      } catch {}
      runningRef.current.delete(pageIndex)
      pdfLogger('Render', `Render task of page ${pageIndex} is canceled.`, 'info')
    }

    // remove from queue
    queueRef.current = queueRef.current.filter((t) => t.pageIndex !== pageIndex)
  }, [])

  const cancelAll = useCallback(() => {
    runningRef.current.forEach(({ task }) => {
      try {
        task.cancel()
      } catch {}
    })

    pdfLogger('Render', `All render tasks are canceled.`, 'info')
    runningRef.current.clear()
    queueRef.current = []
  }, [])

  useEffect(() => {
    runNextRef.current = runNext
  }, [runNext])

  return {
    schedule,
    cancel,
    cancelAll,
    newVersion,
    getVersion
  }
}
