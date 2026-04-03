import PDFCanvas from './pdfCanvas'
import { PDFManager } from './pdfManager'
import { CanvasProvider, PDFProvider } from './pdfState'
import PDFToolBar from './pdfToolBar'
import './pdfViewer.css'

const manager = new PDFManager()

export function PDFViewer() {
  // const pdfCanvasRef = useRef<HTMLCanvasElement>(null)

  return (
    // Provider to share PDF manager.
    <PDFProvider>
      {/* <PDFLoader manager={manager} canvas={pdfCanvasRef}></PDFLoader> */}
      <div className="pdf-viewer-container">
        <CanvasProvider>
          <PDFToolBar
            manager={manager}
            // canvas={pdfCanvasRef}
          ></PDFToolBar>
          <PDFCanvas
          // manager={manager}
          // canvas={pdfCanvasRef}
          ></PDFCanvas>
        </CanvasProvider>
      </div>
    </PDFProvider>
  )
}
