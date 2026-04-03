import { useEffect, useRef, useState } from 'react'
import { PDFManager } from '../pdf/pdfManager'
import { usePDFContext } from '../pdf/pdfState'
import './PDFViewer.css'

interface PDFViewerProps {
	file: File | null
}

export function PDFViewer({ file }: PDFViewerProps) {
	const pdfCanvasRef = useRef<HTMLCanvasElement>(null)
	const [pdfManager] = useState(() => new PDFManager())
	const {
		state,
		setDocument,
		setIsLoading,
		setCurrentPage,
		setScale,
		setRotation,
	} = usePDFContext()

	useEffect(() => {
		if (!file || !pdfCanvasRef.current) return

		const loadAndRenderPDF = async () => {
			setIsLoading(true)
			try {
				const document = await pdfManager.loadFromFile(file)
				setDocument(document, 1, document.numPages, 1.2, 0, false)

				// 渲染第一页
				await renderCurrentPage()
			} catch (error) {
				console.error('Error loading or rendering PDF:', error)
				setIsLoading(false)
			}
		}

		loadAndRenderPDF()
	}, [file])

	const renderCurrentPage = async () => {
		if (!state.document || !pdfCanvasRef.current) return

		try {
			// const page = await state.document.getPage(state.currentPage)
			// const viewport = page.getViewport({
			// 	scale: state.scale,
			// 	rotation: state.rotation,
			// })

			await pdfManager.renderPage(state.currentPage, {
				scale: state.scale * (window.devicePixelRatio || 1),
				canvas: pdfCanvasRef.current,
				rotation: state.rotation,
			})
		} catch (error) {
			console.error('Error rendering page:', error)
		}
	}

	useEffect(() => {
		if (state.document) {
			renderCurrentPage()
		}
	}, [state.currentPage, state.scale, state.rotation, state.document])

	// 缩放功能
	const handleZoomIn = () => {
		const newScale = Math.min(state.scale * 1.2, 5)
		setScale(newScale)
	}

	const handleZoomOut = () => {
		const newScale = Math.max(state.scale / 1.2, 0.2)
		setScale(newScale)
	}

	const handleFitToWidth = () => {
		if (!pdfCanvasRef.current || !state.document) return

		const containerWidth =
			pdfCanvasRef.current.parentElement?.clientWidth || 800
		const padding = 40
		const availableWidth = containerWidth - padding

		// 计算适合宽度的缩放比例
		const calculateScale = async () => {
			if (!state.document) return
			try {
				const page = await state.document.getPage(state.currentPage)
				const viewport = page.getViewport({
					scale: 1,
					rotation: state.rotation,
				})

				const newScale = availableWidth / viewport.width
				setScale(newScale)
			} catch (error) {
				console.error('Error calculating fit to width scale:', error)
			}
		}

		calculateScale()
	}

	// 旋转功能
	const handleRotateLeft = () => {
		const newRotation = ((state.rotation - 90 + 360) % 360) as
			| 0
			| 90
			| 180
			| 270
		setRotation(newRotation)
	}

	const handleRotateRight = () => {
		const newRotation = ((state.rotation + 90) % 360) as 0 | 90 | 180 | 270
		setRotation(newRotation)
	}

	// 页面导航
	const handlePreviousPage = () => {
		if (state.currentPage > 1) {
			setCurrentPage(state.currentPage - 1)
		}
	}

	const handleNextPage = () => {
		if (state.currentPage < state.totalPages) {
			setCurrentPage(state.currentPage + 1)
		}
	}

	return (
		<div className="pdf-viewer-container">
			{/* 工具栏 */}
			<div className="pdf-toolbar">
				{/* 页面导航 */}
				<div className="toolbar-section">
					<button
						onClick={handlePreviousPage}
						disabled={state.currentPage <= 1}
						className="toolbar-button"
					>
						上一页
					</button>
					<span className="page-info">
						{state.currentPage} / {state.totalPages}
					</span>
					<button
						onClick={handleNextPage}
						disabled={state.currentPage >= state.totalPages}
						className="toolbar-button"
					>
						下一页
					</button>
				</div>

				{/* 缩放控制 */}
				<div className="toolbar-section">
					<button onClick={handleZoomOut} className="toolbar-button">
						缩小
					</button>
					<span className="scale-info">
						{Math.round(state.scale * 100)}%
					</span>
					<button onClick={handleZoomIn} className="toolbar-button">
						放大
					</button>
					<button
						onClick={handleFitToWidth}
						className="toolbar-button"
					>
						适应宽度
					</button>
				</div>

				{/* 旋转控制 */}
				<div className="toolbar-section">
					<button
						onClick={handleRotateLeft}
						className="toolbar-button"
					>
						左转
					</button>
					<button
						onClick={handleRotateRight}
						className="toolbar-button"
					>
						右转
					</button>
				</div>
			</div>

			{/* 加载状态 */}
			{state.isLoading && (
				<div className="loading-overlay">
					<div className="loading-spinner"></div>
					<p>加载中...</p>
				</div>
			)}

			{/* PDF 渲染区域 */}
			<div className="pdf-render-container">
				<canvas ref={pdfCanvasRef} className="pdf-canvas" />
			</div>
		</div>
	)
}
