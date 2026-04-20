/**
 * Hook to manage mounted page.
 *    1. Decide which page is the "central"/"current" page.
 *    2. Decide which pages should be rendered.
 *    3. When scrolling, only render the current page:
 *        - Skip if the page is rendered.
 *        - Otherwise render the page at low scale.
 *    4. Use setInterval to detect idle state and render pages.
 *
 * Interface
 *    - currentPage
 *    - mountedPages
 *    - registerPage()
 */

import { pdfLogger } from '@/pdf/utils'
import { RefObject, useCallback, useEffect, useRef, useState } from 'react'

type ViewportManager = {
  currentPage: number
  mountedPages: Set<number>
  registerPage: (pageIndex: number, el: HTMLDivElement | null) => void
}

export function useViewportManager(
  containerRef: RefObject<HTMLDivElement | null>,
  numPages: number,
  buffer: number = 3
): ViewportManager {
  const [mountedPages, setMountedPages] = useState<Set<number>>(new Set())
  const [currentPage, setCurrentPage] = useState(1)

  const pageMapRef = useRef<Map<number, HTMLDivElement>>(new Map())
  const currentPageRef = useRef<number>(currentPage)
  const lastCurrentPageRef = useRef<number>(currentPage)
  const isScrollingRef = useRef(false)
  const lastScrollTimeRef = useRef(0)

  const pendingPagesRef = useRef<Set<number>>(new Set())
  const rafLockRef = useRef(false)

  // =========================== Core Functions ===========================

  const computeMountedPages = useCallback(
    (center: number) => {
      const next = new Set<number>()

      for (let i = center - buffer; i <= center + buffer; i++) {
        if (i >= 1 && i <= numPages) {
          next.add(i)
        }
      }

      return next
    },
    [numPages]
  )

  const registerPage = useCallback((pageIndex: number, el: HTMLDivElement | null) => {
    if (el) {
      pageMapRef.current.set(pageIndex, el)
    } else {
      pageMapRef.current.delete(pageIndex)
    }
  }, [])

  const compulteCurrentPage = useCallback(() => {
    const container = containerRef.current
    if (!container) return

    const rect = container.getBoundingClientRect()
    const centerY = rect.top + rect.height / 2

    let bestPage = currentPageRef.current
    let minDistance = Infinity

    for (const [page, el] of pageMapRef.current.entries()) {
      const r = el.getBoundingClientRect()
      const elCenter = r.top + r.height / 2

      const dist = Math.abs(elCenter - centerY)

      if (dist < minDistance) {
        minDistance = dist
        bestPage = page
      }
    }

    if (bestPage !== currentPageRef.current) {
      currentPageRef.current = bestPage
    }
  }, [containerRef])

  function scheduleUpdate(nextPages: Set<number>, page: number) {
    pendingPagesRef.current = nextPages

    if (rafLockRef.current) return

    rafLockRef.current = true

    requestAnimationFrame(() => {
      setMountedPages(new Set(pendingPagesRef.current))
      setCurrentPage(page)
      pdfLogger('Viewport', `Central page changed to page ${page}`, 'debug')
      rafLockRef.current = false
    })
  }

  /**
   * Handle ScrollEvent.
   * @returns void
   */
  function handleScrollEvent() {
    isScrollingRef.current = true
    lastScrollTimeRef.current = Date.now()
  }

  // Listen on scroll event
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    container.addEventListener('scroll', handleScrollEvent, { passive: false })

    return () => {
      container.removeEventListener('scroll', handleScrollEvent)
    }
  }, [])

  // Interval to detect idle state.
  useEffect(() => {
    const interval = setInterval(() => {
      if (isScrollingRef.current && Date.now() - lastScrollTimeRef.current > 120) {
        isScrollingRef.current = false
        compulteCurrentPage()
        pdfLogger('Viewport', 'Scrolling stoped.', 'debug')
      }
    }, 100)

    return () => clearInterval(interval)
  }, [])

  // Interval to sync cached current page value.
  useEffect(() => {
    const interval = setInterval(() => {
      const currentPageCache = currentPageRef.current

      if (currentPageCache == lastCurrentPageRef.current) return

      lastCurrentPageRef.current = currentPageCache

      const nextPages = computeMountedPages(currentPageCache)
      scheduleUpdate(nextPages, currentPageCache)
    }, 200)

    return () => clearInterval(interval)
  }, [computeMountedPages])

  // ===================== Initialize =====================

  useEffect(() => {
    if (numPages === 0) return

    const initial = computeMountedPages(1)
    setMountedPages(initial)
    setCurrentPage(1)
    currentPageRef.current = 1
    lastCurrentPageRef.current = 1
    pdfLogger(
      'Viewport',
      `Reset current page to 1 and mounted pages to ${Array.from(initial)}`,
      'debug'
    )
  }, [numPages])

  return {
    mountedPages,
    currentPage,
    registerPage
  }
}
