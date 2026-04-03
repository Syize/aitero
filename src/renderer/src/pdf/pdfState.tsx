import { PDFDocumentProxy } from 'pdfjs-dist'
import {
	createContext,
	ReactNode,
	useCallback,
	useContext,
	useState,
} from 'react'

// ====================== PDF State ======================
/**
 * PDF state interface.
 * @param document: PDFDocumentProxy.
 * @param currentPage: Current page number.
 * @param totalPages: Total page number.
 * @param scale: Scale factor number
 * @param rotation: Rotation angle, 0 | 90 | 180 | 270
 * @param isLoading: Is the file is being load.
 */
export interface PDFStateType {
	document: PDFDocumentProxy | null
	currentPage: number
	totalPages: number
	scale: number
	rotation: 0 | 90 | 180 | 270
	isLoading: boolean
}

/**
 * Canvas state interface.
 * @param panelOffsetX: Offset of X axis of the canvas.
 * @param panelOffsetY: Offset of Y axis of the canvas.
 * @param isInitialized: Is the canvas is initialized.
 */
export interface CanvasStateType {
	panelOffsetX: number
	panelOffsetY: number
	isInitialized: boolean
}

// ====================== PDF Context ====================
export interface PDFContextType {
	state: PDFStateType

	// Basic method
	_update: (partial: Partial<PDFStateType>) => void
	_reset: () => void

	// Public method
	setDocument: (
		document: PDFDocumentProxy,
		page: number,
		totalPage: number,
		scale: number,
		rotation: 0 | 90 | 180 | 270,
		isLoading: boolean,
	) => void

	setCurrentPage: (page: number) => void
	setTotalPage: (page: number) => void
	setScale: (scale: number) => void
	setRotation: (rotation: 0 | 90 | 180 | 270) => void
	setIsLoading: (isLoading: boolean) => void
}

export interface CanvasStateContextType {
	canvasState: CanvasStateType
	setPanelOffset: (x: number, y: number) => void
	setIsInitialized: (isInitialized: boolean) => void
}

// Default state
const DEFAULT_PDF_STATE: PDFStateType = {
	document: null,
	currentPage: 1,
	totalPages: 0,
	scale: 1.2,
	rotation: 0,
	isLoading: false,
}

const DEFAULT_CANVAS_STATE: CanvasStateType = {
	panelOffsetX: 0,
	panelOffsetY: 0,
	isInitialized: false,
}

export const PDFContext = createContext<PDFContextType | undefined>(undefined)
export const CanvasStateContext = createContext<
	CanvasStateContextType | undefined
>(undefined)

export const PDFProvider = ({ children }: { children: ReactNode }) => {
	const [state, setState] = useState<PDFStateType>(DEFAULT_PDF_STATE)

	/**
	 * Use this basic function carefully.
	 */
	const _update = useCallback((partial: Partial<PDFStateType>) => {
		setState((prev) => ({ ...prev, ...partial }))
	}, [])

	/**
	 * Use this basic function carefully.
	 */
	const _reset = useCallback(() => {
		setState(DEFAULT_PDF_STATE)
	}, [])

	/**
	 * Set document and its options.
	 * @param document: PDFDocumentProxy
	 * @param page: Current page number.
	 * @param totalPage: Total page number.
	 * @param scale: Scale factor.
	 * @param rotation: Rotation angle.
	 * @param isLoading: If this document hasn't been load yet.
	 */
	const setDocument = useCallback(
		(
			document: PDFDocumentProxy,
			page: number,
			totalPage: number,
			scale: number,
			rotation: 0 | 90 | 180 | 270,
			isLoading: boolean,
		) => {
			setState((prev) => ({
				...prev,
				document,
				currentPage: page,
				totalPages: totalPage,
				scale,
				rotation,
				isLoading,
			}))
		},
		[],
	)

	/**
	 * Set current page number.
	 */
	const setCurrentPage = useCallback((page: number) => {
		if (page >= 1 || page <= state.totalPages) {
			setState((prev) => ({ ...prev, currentPage: page }))
		}
	}, [])

	/**
	 * Set total page number.
	 */
	const setTotalPage = useCallback((page: number) => {
		setState((prev) => ({ ...prev, totalPages: page }))
	}, [])

	/**
	 * Set scale factor.
	 */
	const setScale = useCallback((scale: number) => {
		setState((prev) => ({ ...prev, scale }))
	}, [])

	/**
	 * Set rotation angle.
	 */
	const setRotation = useCallback((rotation: 0 | 90 | 180 | 270) => {
		setState((prev) => ({ ...prev, rotation }))
	}, [])

	/**
	 * Set loading state.
	 */
	const setIsLoading = useCallback((isLoading: boolean) => {
		setState((prev) => ({ ...prev, isLoading }))
	}, [])

	return (
		<PDFContext.Provider
			value={{
				state,
				_update,
				_reset,
				setDocument,
				setCurrentPage,
				setTotalPage,
				setScale,
				setRotation,
				setIsLoading,
			}}
		>
			{children}
		</PDFContext.Provider>
	)
}

export const CanvasProvider = ({ children }: { children: ReactNode }) => {
	const [state, setState] = useState<CanvasStateType>(DEFAULT_CANVAS_STATE)

	/**
	 * Set canvas offset.
	 * @param x: Offset of x axis.
	 * @param y: Offset of x axis.
	 */
	const setPanelOffset = useCallback((x: number, y: number) => {
		setState((prev) => ({
			...prev,
			panelOffsetX: x,
			panelOffsetY: y,
		}))
	}, [])

	/**
	 * Set is the canvas is initialized.
	 */
	const setIsInitialized = useCallback((isInitialized: boolean) => {
		setState((prev) => ({
			...prev,
			isInitialized,
		}))
	}, [])

	return (
		<CanvasStateContext.Provider
			value={{
				canvasState: state,
				setPanelOffset,
				setIsInitialized,
			}}
		>
			{children}
		</CanvasStateContext.Provider>
	)
}

/**
 * Get shared objects and methods of PDFConext.
 * @returns Objects and methods defined in PDFContextType.
 */
export function usePDFContext() {
	const context = useContext(PDFContext)

	if (context === undefined) {
		throw new Error('usePDFContext must be within a PDFProvider')
	}

	return context
}

/**
 * Get shared objects and methods of CanvasContext.
 * @returns Objects and methods defined in CanvasContextType.
 */
export function useCanvasContext() {
	const context = useContext(CanvasStateContext)

	if (context === undefined) {
		throw new Error('useCanvasContext must be within a CanvasProvider')
	}

	return context
}
