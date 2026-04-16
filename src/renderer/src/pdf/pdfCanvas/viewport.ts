/**
 * Hook to manage mounted page.
 *    1. Decide which page is the "central"/"current" page.
 *    2. Decide which pages should be rendered.
 *
 * Interface
 *    - currentPage
 *    - mountedPages
 */

import { RefObject, useEffect, useRef, useState } from 'react'

type ViewportManager = {
  currentPage: number
  mountedPages: Set<number>
}

export function useViewportManager(
  containerRef: RefObject<HTMLDivElement | null>,
  numPages: number,
  buffer: number = 3
): ViewportManager {
  const [mountedPages, setMountedPages] = useState<Set<number>>(new Set())
  const [currentPage, setCurrentPage] = useState(1)

  const observerRef = useRef<IntersectionObserver | null>(null)

  // 用于降低抖动
  const pendingPagesRef = useRef<Set<number>>(new Set())
  const rafLockRef = useRef(false)

  // ===================== 核心逻辑 =====================

  function computePages(center: number) {
    const next = new Set<number>()

    for (let i = center - buffer; i <= center + buffer; i++) {
      if (i >= 1 && i <= numPages) {
        next.add(i)
      }
    }

    return next
  }

  function scheduleUpdate(nextPages: Set<number>, page: number) {
    pendingPagesRef.current = nextPages

    if (rafLockRef.current) return

    rafLockRef.current = true

    requestAnimationFrame(() => {
      setMountedPages(new Set(pendingPagesRef.current))
      setCurrentPage(page)
      rafLockRef.current = false
    })
  }

  // ===================== Observer =====================

  useEffect(() => {
    if (!containerRef.current || numPages === 0) return

    const root = containerRef.current

    observerRef.current = new IntersectionObserver(
      (entries) => {
        let maxVisiblePage = currentPage
        let maxRatio = 0

        for (const entry of entries) {
          if (!entry.isIntersecting) continue

          const el = entry.target as HTMLElement
          const page = Number(el.dataset.page)

          // 选“最可见”的页面作为当前页（比你之前更稳定）
          if (entry.intersectionRatio > maxRatio) {
            maxRatio = entry.intersectionRatio
            maxVisiblePage = page
          }
        }

        if (maxVisiblePage === currentPage) return

        const nextPages = computePages(maxVisiblePage)

        scheduleUpdate(nextPages, maxVisiblePage)
      },
      {
        root,
        rootMargin: '1000px 0px 1000px 0px', // 提前加载
        threshold: buildThresholdList()
      }
    )

    return () => {
      observerRef.current?.disconnect()
      observerRef.current = null
    }
  }, [numPages, containerRef, currentPage])

  // ===================== 观察 DOM =====================

  useEffect(() => {
    const observer = observerRef.current
    const container = containerRef.current

    if (!observer || !container) return

    const elements = container.querySelectorAll('.pdf-page')

    elements.forEach((el) => observer.observe(el))

    return () => {
      elements.forEach((el) => observer.unobserve(el))
    }
  }, [numPages])

  // ===================== Initialize =====================

  useEffect(() => {
    if (numPages === 0) {
      setMountedPages(new Set())
      setCurrentPage(1)
      return
    }

    const initial = computePages(1)
    setMountedPages(initial)
    setCurrentPage(1)
  }, [numPages])

  return {
    mountedPages,
    currentPage
  }
}

// ===================== utils =====================

function buildThresholdList() {
  const thresholds: number[] = []
  for (let i = 0; i <= 1.0; i += 0.1) {
    thresholds.push(i)
  }
  return thresholds
}
