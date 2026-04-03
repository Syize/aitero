import { PageSizes, PDFDocument } from 'pdf-lib'
import * as pdfjsLib from 'pdfjs-dist'
import { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist'
import PdfWorker from 'pdfjs-dist/build/pdf.worker?worker'

pdfjsLib.GlobalWorkerOptions.workerPort = new PdfWorker()

export interface RenderOptions {
	scale: number
	canvas: HTMLCanvasElement
	rotation?: 0 | 90 | 180 | 270
}

// Custom error class to track retry information
export class PDFLoadError extends Error {
	attempts: number
	originalUrl: string

	constructor(message: string, attempts: number, originalUrl: string) {
		super(message)
		this.name = 'PDFLoadError'
		this.attempts = attempts
		this.originalUrl = originalUrl
	}
}

// Utility function to validate PDF file
export function isValidPDFFile(file: File): boolean {
	return (
		file.type === 'application/pdf' ||
		file.name.toLowerCase().endsWith('.pdf')
	)
}

// Utility function to create a blank PDF document
export async function createBlankPDF(): Promise<File> {
	try {
		// Create a new PDF document
		const pdfDoc = await PDFDocument.create()

		// Add a blank page with standard US Letter size (8.5 x 11 inches)
		pdfDoc.addPage(PageSizes.Letter)

		// Optionally, you can add more pages or customize the page
		// For now, we'll just keep it as a single blank page

		// Serialize the PDF to bytes
		const pdfBytes = await pdfDoc.save()

		// Create a File object from the PDF bytes
		const file = new File([new Uint8Array(pdfBytes)], 'blank.pdf', {
			type: 'application/pdf',
			lastModified: Date.now(),
		})

		console.log('Created blank PDF:', file.name, file.size, 'bytes')
		return file
	} catch (error) {
		console.error('Error creating blank PDF:', error)
		throw new Error('Failed to create blank PDF')
	}
}

export class PDFManager {
	private document: PDFDocumentProxy | null = null
	private currentPageProxy: PDFPageProxy | null = null

	async loadFromFile(file: File): Promise<PDFDocumentProxy> {
		try {
			const arrayBuffer = await file.arrayBuffer()
			const uint8Array = new Uint8Array(arrayBuffer)

			this.document = await pdfjsLib.getDocument({
				data: uint8Array,
				cMapUrl: '/pdfjs/cmaps/',
				cMapPacked: true,
				isEvalSupported: false,
			}).promise

			return this.document!
		} catch (error) {
			console.error('Error loading PDF:', error)
			throw new Error('Failed to load PDF file')
		}
	}

	async renderPage(
		pageNumber: number,
		options: RenderOptions,
	): Promise<void> {
		if (!this.document) {
			throw new Error('No PDF document loaded')
		}

		try {
			// Get the page
			this.currentPageProxy = await this.document.getPage(pageNumber)

			// Get viewport with desired scale and rotation
			const viewport = this.currentPageProxy.getViewport({
				scale: options.scale,
				rotation: options.rotation || 0,
			})

			// Set canvas dimensions
			const canvas = options.canvas
			const context = canvas.getContext('2d')
			if (!context) {
				throw new Error('Unable to get canvas context')
			}

			// Set canvas size
			canvas.width = viewport.width
			canvas.height = viewport.height

			// Clear canvas
			context.clearRect(0, 0, canvas.width, canvas.height)

			// Render the page
			const renderContext = {
				canvasContext: context,
				viewport: viewport,
				canvas: canvas,
			}

			await this.currentPageProxy.render(renderContext).promise
		} catch (error) {
			console.error('Error rendering page:', error)
			throw new Error(`Failed to render page ${pageNumber}`)
		}
	}

	// Render a page proxy directly to a canvas (used for exports)
	async renderPageToCanvas(
		pageProxy: PDFPageProxy,
		options: RenderOptions,
	): Promise<void> {
		if (!pageProxy) {
			throw new Error('No page proxy provided')
		}

		try {
			// Get viewport with scale 1 as the context scaling is already handled externally
			const viewport = pageProxy.getViewport({
				scale: 1,
				rotation: options.rotation || 0,
			})

			// Set canvas dimensions
			const canvas = options.canvas
			const context = canvas.getContext('2d')
			if (!context) {
				throw new Error('Unable to get canvas context')
			}

			// Don't clear canvas or modify size as it might already be set for export scaling
			// The context might already have scaling applied

			// Render the page with the base viewport (scaling handled by existing context transform)
			const renderContext = {
				canvasContext: context,
				viewport: viewport,
				canvas: canvas,
			}

			await pageProxy.render(renderContext).promise
		} catch (error) {
			console.error('Error rendering page to canvas:', error)
			throw new Error('Failed to render page to canvas')
		}
	}

	getPageCount(): number {
		return this.document?.numPages || 0
	}

	getDocument(): PDFDocumentProxy | null {
		return this.document
	}

	getCurrentPageProxy(): PDFPageProxy | null {
		return this.currentPageProxy
	}

	async getPageDimensions(
		pageNumber: number,
		scale: number = 1,
		rotation: 0 | 90 | 180 | 270 = 0,
	): Promise<{ width: number; height: number }> {
		if (!this.document) {
			throw new Error('No PDF document loaded')
		}

		try {
			const page = await this.document.getPage(pageNumber)
			const viewport = page.getViewport({ scale, rotation })
			return {
				width: viewport.width,
				height: viewport.height,
			}
		} catch (error) {
			console.error('Error getting page dimensions:', error)
			throw new Error(`Failed to get dimensions for page ${pageNumber}`)
		}
	}

	destroy(): void {
		this.currentPageProxy = null
		if (this.document) {
			this.document.destroy()
			this.document = null
		}
	}
}
