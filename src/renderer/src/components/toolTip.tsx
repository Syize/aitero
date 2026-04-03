import React, { useCallback, useEffect, useRef, useState } from 'react'
import './toolTip.css'

interface TooltipProps {
	content: string
	position?: 'top' | 'bottom'
	delay?: number
	disabled?: boolean
	children: React.ReactNode
}

export function Tooltip({
	content,
	position = 'top',
	delay = 500,
	disabled = false,
	children,
}: TooltipProps) {
	const [isVisible, setIsVisible] = useState(false)
	const [edgeClasses, setEdgeClasses] = useState('')
	const containerRef = useRef<HTMLDivElement>(null)
	const tooltipRef = useRef<HTMLDivElement>(null)
	const showTimeoutRef = useRef<number>(null)
	const hideTimeoutRef = useRef<number>(null)

	const checkViewportBoundaries = useCallback(() => {
		if (!containerRef.current || !tooltipRef.current) return

		const containerRect = containerRef.current.getBoundingClientRect()
		const tooltipRect = tooltipRef.current.getBoundingClientRect()

		const viewportWidth = window.innerWidth
		const leftEdge =
			containerRect.left + containerRect.width / 2 - tooltipRect.width / 2
		const rightEdge = leftEdge + tooltipRect.width

		if (leftEdge < 8) {
			setEdgeClasses('near-left-edge')
		} else if (rightEdge > viewportWidth - 8) {
			setEdgeClasses('near-right-edge')
		} else {
			setEdgeClasses('')
		}
	}, [])

	const show = useCallback(() => {
		if (disabled || !content.trim()) return
		if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current)

		showTimeoutRef.current = window.setTimeout(() => {
			setIsVisible(true)
			setTimeout(checkViewportBoundaries, 0)
		}, delay)
	}, [disabled, content, delay, checkViewportBoundaries])

	const hide = useCallback(() => {
		if (showTimeoutRef.current) clearTimeout(showTimeoutRef.current)

		hideTimeoutRef.current = window.setTimeout(() => {
			setIsVisible(false)
		}, 0)
	}, [])

	const handleMouseEnter = useCallback(() => {
		show()
	}, [show])

	const handleMouseLeave = useCallback(() => {
		hide()
	}, [hide])

	useEffect(() => {
		return () => {
			if (showTimeoutRef.current) clearTimeout(showTimeoutRef.current)
			if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current)
		}
	}, [])

	return (
		<div
			ref={containerRef}
			className={`tooltip-container ${edgeClasses}`}
			role="presentation"
			onMouseEnter={handleMouseEnter}
			onMouseLeave={handleMouseLeave}
			onFocus={show}
			onBlur={hide}
		>
			{children}

			{isVisible && (
				<div
					ref={tooltipRef}
					className={`tooltip ${position === 'top' ? 'tooltip-top' : ''}`}
				>
					{content}
				</div>
			)}
		</div>
	)
}
