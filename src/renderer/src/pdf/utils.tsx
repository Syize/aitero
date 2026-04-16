import { PDFManager } from './pdfManager'

type messageLevel = 'info' | 'debug' | 'warning' | 'error'

export interface PDFManagerProps {
  manager: PDFManager
  // canvas: RefObject<HTMLCanvasElement | null>
}

export const TOOLBAR_HEIGHT = 100

export function pdfLogger(type: string, message: string, level: messageLevel = 'info') {
  let log = `[PDF][${type}][${level}] ${message}`

  switch (level) {
    case 'info':
      console.log(log)
      break

    case 'debug':
      console.debug(log)
      break

    case 'warning':
      console.warn(log)
      break

    case 'error':
      console.error(log)
      break

    default:
      break
  }
}
