/**
 * Hook to manage PDF states.
 *    1. Get total page number.
 *    2. Calculate raw size (height, width at scale = 1) of all pages.
 *    3. Set lading state.
 *
 * Interface:
 *    - docState
 *    - isLoading
 */

import { pdfLogger } from '@/pdf/utils'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react'

export type PageSize = {
  width: number
  height: number
}

/**
 * @param pageNum: Total page number.
 * @param pageSizes: Height and width of each page when scale = 1.
 * @param isLoading: Whether the PDF isn't loaded yet.
 */
type PDFDocument = {
  pageNum: number
  pageSizes: PageSize[]
  isLoading: boolean
}

export function usePDFDocument(
  pdfDocument: PDFDocumentProxy | null,
  rotation: number
): PDFDocument {
  const [pageNum, setPageNum] = useState(0)
  const [pageSizes, setPageSizes] = useState<PageSize[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Avoid aync conflict.
  const versionRef = useRef(0)

  // Avoid dependes on unnecessary states.
  const getPdfDocument = useEffectEvent(useCallback(() => pdfDocument, [pdfDocument]))
  const getRotation = useEffectEvent(useCallback(() => rotation, [rotation]))

  useEffect(() => {
    if (!pdfDocument) {
      setPageNum(0)
      setPageSizes([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)

    pdfLogger('Document', 'New PDF opened, calculate page number and sizes.', 'debug')

    let cancelled = false
    const version = ++versionRef.current

    async function calculate() {
      try {
        const total = pdfDocument!.numPages
        pdfLogger('Document', `Page num changed to ${total}`, 'debug')
        setPageNum(total)

        const sizes: PageSize[] = new Array(total)

        // TODO (low): serial -> async.
        for (let i = 1; i <= total; i++) {
          if (cancelled || version !== versionRef.current) return

          const page = await pdfDocument!.getPage(i)
          const viewport = page.getViewport({ scale: 1, rotation: getRotation() })

          sizes[i - 1] = {
            width: viewport.width,
            height: viewport.height
          }
        }

        // version check
        if (cancelled || version !== versionRef.current) return

        setPageSizes(sizes)
      } catch (e) {
        pdfLogger('Document', `Failed to calculate page sizes: ${e}`, 'error')
      } finally {
        if (!cancelled && version === versionRef.current) {
          setIsLoading(false)
          pdfLogger('Document', 'Load finished', 'debug')
        }
      }
    }

    calculate()

    return () => {
      cancelled = true
    }
  }, [pdfDocument])

  useEffect(() => {
    const pdfDocument = getPdfDocument()

    if (!pdfDocument) {
      return
    }

    pdfLogger('Document', 'PDF is rotated, recalculate page sizes.', 'debug')

    let cancelled = false

    async function calculate() {
      try {
        const total = pdfDocument!.numPages

        const sizes: PageSize[] = new Array(total)

        // TODO (low): serial -> async.
        for (let i = 1; i <= total; i++) {
          if (cancelled) return

          const page = await pdfDocument!.getPage(i)
          const viewport = page.getViewport({ scale: 1, rotation })

          sizes[i - 1] = {
            width: viewport.width,
            height: viewport.height
          }
        }

        if (cancelled) return

        setPageSizes(sizes)
      } catch (e) {
        pdfLogger('Document', `Failed to calculate page sizes: ${e}`, 'error')
      } finally {
      }
    }

    calculate()

    return () => {
      cancelled = true
    }
  }, [rotation])

  return {
    pageNum,
    pageSizes,
    isLoading
  }
}
