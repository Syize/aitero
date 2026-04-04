import { floating_panel } from '@/components/css'
import { Tooltip } from '@/components/toolTip'
import clsx from 'clsx'
import {
  ChevronLeft,
  ChevronRight,
  Folder,
  Layout,
  RotateCcw,
  RotateCw,
  ZoomIn,
  ZoomOut
} from 'lucide-react'
import { useRef } from 'react'
import { useCanvasContext, usePDFContext } from './pdfState'
// import './pdfToolBar.css'
import { PDFManagerProps } from './utils'

const toolbar_top = floating_panel + ' py-1! px-2!'
const tool_button =
  '-2 rounded-lg transition-all duration-200 ease-out hover:scale-105 hover:shadow-lg active:scale-95 focus:outline-none focus:ring-2 focus:ring-sage/50'

const tool_button_no_active =
  'bg-white/70 dark:bg-gray-800/70 text-charcoal dark:text-gray-200 hover:bg-white/90 dark:hover:bg-gray-700/90'

export default function PDFToolBar({ manager }: PDFManagerProps) {
  const { state, setCurrentPage, setScale, setRotation, setIsLoading, setDocument } =
    usePDFContext()
  const fileInput = useRef<HTMLInputElement>(null)
  const { setIsInitialized } = useCanvasContext()

  // ====================== callback function ====================
  function uploadFile() {
    fileInput.current?.click()
  }

  async function onFileUpload(file: File) {
    setIsLoading(true)
    setIsInitialized(false)
    let doc = await manager.loadFromFile(file)
    setIsLoading(false)
    setDocument(doc, 1, doc.numPages, 1.2, 0, false)
  }

  function onRotateLeft() {
    setRotation(((state.rotation - 90 + 360) % 360) as 0 | 90 | 180 | 270)
  }

  function onRotateRight() {
    setRotation(((state.rotation + 90) % 360) as 0 | 90 | 180 | 270)
  }

  // const handleFitToWidth = () => {
  // 	if (!canvas.current || !state.document) return

  // 	const containerWidth = canvas.current.parentElement?.clientWidth || 800
  // 	const padding = 40
  // 	const availableWidth = containerWidth - padding

  // 	// 计算适合宽度的缩放比例
  // 	const calculateScale = async () => {
  // 		if (!state.document) return
  // 		try {
  // 			const page = await state.document.getPage(state.currentPage)
  // 			const viewport = page.getViewport({
  // 				scale: 1,
  // 				rotation: state.rotation,
  // 			})

  // 			const newScale = availableWidth / viewport.width
  // 			setScale(newScale)
  // 		} catch (error) {
  // 			console.error('Error calculating fit to width scale:', error)
  // 		}
  // 	}

  // 	calculateScale()
  // }

  return (
    // <div className={clsx('toolbar-top left-4 right-4 z-50 fixed top-2')}>
    // 	<div className="flex items-center justify-between">
    // 		<div className="toolbar-section">
    // 			<button
    // 				onClick={() =>
    // 					setCurrentPage(Math.max(1, state.currentPage - 1))
    // 				}
    // 				disabled={state.currentPage <= 1}
    // 				className="toolbar-button"
    // 			>
    // 				上一页
    // 			</button>

    // 			<span className="page-info">
    // 				{state.currentPage} / {state.totalPages}
    // 			</span>

    // 			<button
    // 				onClick={() =>
    // 					setCurrentPage(
    // 						Math.min(
    // 							state.totalPages,
    // 							state.currentPage + 1,
    // 						),
    // 					)
    // 				}
    // 				disabled={state.currentPage >= state.totalPages}
    // 				className="toolbar-button"
    // 			>
    // 				下一页
    // 			</button>
    // 		</div>

    // 		<div className="toolbar-section">
    // 			<button
    // 				onClick={() => setScale(Math.max(state.scale / 1.2, 5))}
    // 				className="toolbar-button"
    // 			>
    // 				放大
    // 			</button>
    // 			<span className="scale-info">
    // 				{Math.round(state.scale * 100)}%
    // 			</span>
    // 			<button
    // 				onClick={() =>
    // 					setScale(Math.max(state.scale / 1.2, 0.2))
    // 				}
    // 				className="toolbar-button"
    // 			>
    // 				缩小
    // 			</button>
    // 			<button
    // 				onClick={handleFitToWidth}
    // 				className="toolbar-button"
    // 			>
    // 				适应宽度
    // 			</button>
    // 		</div>

    // 		<div className="toolbar-section">
    // 			<button
    // 				onClick={() =>
    // 					setRotation(
    // 						((state.rotation - 90 + 360) % 360) as
    // 							| 0
    // 							| 90
    // 							| 180
    // 							| 270,
    // 					)
    // 				}
    // 				className="toolbar-button"
    // 			>
    // 				左转
    // 			</button>
    // 			<button
    // 				onClick={() =>
    // 					setRotation(
    // 						((state.rotation + 90) % 360) as
    // 							| 0
    // 							| 90
    // 							| 180
    // 							| 270,
    // 					)
    // 				}
    // 				className="toolbar-button"
    // 			>
    // 				右转
    // 			</button>
    // 		</div>
    // 	</div>
    // </div>
    <div
      className={clsx(toolbar_top, 'left-4 right-4 z-50 absolute')}
      // class:fixed={!$hasParityBanner}
      // class:absolute={$hasParityBanner}
      // class:top-2={!$hasParityBanner}
    >
      <input
        ref={fileInput}
        type="file"
        accept=".pdf,.md,.markdown,.png,.jpg,.jpeg,.webp"
        className="hidden"
        aria-hidden="true"
        onChange={(e) => {
          let file = e.target.files?.[0]
          if (file) onFileUpload(file)
        }}
      />

      <div className={clsx(floating_panel, 'py-1! px-3!')}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {/* <Tooltip content="Go to homepage">
					<button
						className="flex items-center hover:opacity-80 transition-opacity cursor-pointer w-11 h-11 lg:w-8 lg:h-8 justify-center"
						on:click={handleLogoClick}
						aria-label="Go to homepage"
					>
						<enhanced:img src="/static/./favicon.png" alt="LeedPDF" className="w-5 h-5 lg:w-4 lg:h-4" />
					</button>
				</Tooltip> */}

            <div className="h-4 w-px bg-charcoal/20"></div>

            <div className="hidden lg:block">
              <Tooltip content="Upload PDF (U)">
                <button
                  className={clsx(
                    'w-8 h-8 flex items-center justify-center',
                    tool_button,
                    tool_button_no_active
                  )}
                  onClick={uploadFile}
                  aria-label="Upload PDF"
                >
                  <Folder size={14} />
                </button>
              </Tooltip>
            </div>

            <div className="hidden lg:flex items-center space-x-2">
              <Tooltip content="Previous page (←)">
                <button
                  className={clsx(
                    'w-8 h-8 flex items-center justify-center',
                    tool_button,
                    tool_button_no_active,
                    state.currentPage <= 1 && 'opacity-50'
                  )}
                  disabled={state.currentPage <= 1}
                  onClick={() => {
                    setCurrentPage(state.currentPage - 1)
                  }}
                  aria-label="Previous page"
                >
                  <ChevronLeft size={14} />
                </button>
              </Tooltip>

              <Tooltip content="Next page (→)">
                <button
                  className={clsx(
                    'w-8 h-8 flex items-center justify-center',
                    tool_button,
                    tool_button_no_active,
                    state.currentPage >= state.totalPages && 'opacity-50'
                  )}
                  disabled={state.currentPage >= state.totalPages}
                  onClick={() => {
                    setCurrentPage(state.currentPage + 1)
                  }}
                  aria-label="Next page"
                >
                  <ChevronRight size={14} />
                </button>
              </Tooltip>

              <Tooltip content="Page Thumbnails (T)">
                <button
                  className={clsx(
                    'w-8 h-8 flex items-center justify-center',
                    tool_button,
                    tool_button_no_active
                  )}
                  // class:active={showThumbnails}
                  // on:click={() => onToggleThumbnails(!showThumbnails)}
                  aria-label="Toggle page thumbnails"
                >
                  <Layout size={14} />
                </button>
              </Tooltip>
            </div>

            <div className="hidden lg:flex items-center space-x-2">
              <Tooltip content="Zoom in (Ctrl++)">
                <button
                  className={clsx(
                    'h-8 w-8 flex items-center justify-center',
                    tool_button,
                    tool_button_no_active
                  )}
                  onClick={() => setScale(Math.min(state.scale * 1.2, 5))}
                  aria-label="Zoom in"
                >
                  <ZoomIn size={18} />
                </button>
              </Tooltip>

              <Tooltip content="Zoom out (Ctrl+-)">
                <button
                  className={clsx(
                    'h-8 w-8 flex items-center justify-center',
                    tool_button,
                    tool_button_no_active
                  )}
                  onClick={() => setScale(Math.max(state.scale / 1.2, 0.2))}
                  aria-label="Zoom out"
                >
                  <ZoomOut size={18} />
                </button>
              </Tooltip>

              {/* <div className="relative">
						<Tooltip content="View options (Reset, Fit)">
							<button
								className="tool-button h-8 w-8 flex items-center justify-center"
								on:click={() => (showViewMenu = !showViewMenu)}
								aria-label="View options"
								aria-expanded={showViewMenu}
							>
								<Maximize2 size={18} />
							</button>
						</Tooltip>

						{#if showViewMenu}
							<div className="absolute top-full mt-1 left-0 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50 min-w-max">
								<button
									className="w-full text-left p-3 rounded-t-lg hover:bg-sage/10 dark:hover:bg-sage/20 transition-colors text-sm flex items-center gap-2"
									on:click={() => {
										onResetZoom();
										showViewMenu = false;
									}}
								>
									<Minimize2 size={16} />
									<span>Reset Zoom (Ctrl+0)</span>
								</button>

								<button
									className="w-full text-left p-3 hover:bg-sage/10 dark:hover:bg-sage/20 transition-colors text-sm flex items-center gap-2"
									on:click={() => {
										onFitToWidth();
										showViewMenu = false;
									}}
								>
									<ArrowLeftRight size={16} />
									<span>Fit Width (W)</span>
								</button>

								<button
									className="w-full text-left p-3 rounded-b-lg hover:bg-sage/10 dark:hover:bg-sage/20 transition-colors text-sm flex items-center gap-2"
									on:click={() => {
										onFitToHeight();
										showViewMenu = false;
									}}
								>
									<ArrowUpDown size={16} />
									<span>Fit Height (H)</span>
								</button>
							</div>
						{/if}
					</div> */}
            </div>

            <div className="hidden lg:flex items-center space-x-2">
              <div className="w-px h-4 bg-gray-200 dark:bg-gray-600 mx-1"></div>

              <Tooltip content="Rotate left 90° (Shift+R)">
                <button
                  className={clsx(
                    'w-8 h-8 flex items-center justify-center',
                    tool_button,
                    tool_button_no_active,
                    !state.document && 'opacity-50'
                  )}
                  disabled={!state.document}
                  onClick={onRotateLeft}
                  aria-label="Rotate page left 90 degrees"
                >
                  <RotateCcw size={14} />
                </button>
              </Tooltip>

              <Tooltip content="Rotate right 90° (R)">
                <button
                  className={clsx(
                    'w-8 h-8 flex items-center justify-center',
                    tool_button,
                    tool_button_no_active,
                    !state.document && 'opacity-50'
                  )}
                  disabled={!state.document}
                  onClick={onRotateRight}
                  aria-label="Rotate page right 90 degrees"
                >
                  <RotateCw size={14} />
                </button>
              </Tooltip>
            </div>
          </div>

          {/* <div className="hidden lg:flex items-center space-x-2" class:opacity-50={viewOnlyMode}>
				<Tooltip content={viewOnlyMode ? 'Drawing disabled in view-only mode' : 'Pencil (1)'}>
					<button
						className="tool-button w-8 h-8 flex items-center justify-center"
						class:active={$drawingState.tool === 'pencil'}
						disabled={viewOnlyMode}
						on:click={() => !viewOnlyMode && handleToolChange('pencil')}
						aria-label={viewOnlyMode ? 'Drawing disabled in view-only mode' : 'Pencil tool'}
					>
						<Edit3 size={14} />
					</button>
				</Tooltip>

				<Tooltip content={viewOnlyMode ? 'Eraser disabled in view-only mode' : 'Eraser (2)'}>
					<button
						className="tool-button w-8 h-8 flex items-center justify-center"
						class:active={$drawingState.tool === 'eraser'}
						disabled={viewOnlyMode}
						on:click={() => !viewOnlyMode && handleToolChange('eraser')}
						aria-label={viewOnlyMode ? 'Eraser disabled in view-only mode' : 'Eraser tool'}
					>
						<Eraser size={14} />
					</button>
				</Tooltip>

				<Tooltip content={viewOnlyMode ? 'Text tool disabled in view-only mode' : 'Text (3)'}>
					<button
						className="tool-button w-8 h-8 flex items-center justify-center"
						class:active={$drawingState.tool === 'text'}
						disabled={viewOnlyMode}
						on:click={() => !viewOnlyMode && handleToolChange('text')}
						aria-label={viewOnlyMode ? 'Text tool disabled in view-only mode' : 'Text tool'}
					>
						<Type size={14} />
					</button>
				</Tooltip>

				{#if $drawingState.tool === 'text'}
					<div className="relative font-picker-container">
						<Tooltip content="Text font">
							<button
								className="tool-button h-8 px-2 flex items-center justify-center gap-1 text-xs font-medium"
								on:click={() => (showFontPicker = !showFontPicker)}
								aria-label="Choose text font"
								style="font-family: {$drawingState.textFontFamily};"
							>
								<span className="truncate max-w-[60px]">
									{$availableFonts.find((f) => f.fontFamily === $drawingState.textFontFamily)
										?.name || 'Font'}
								</span>
								<svg
									className="w-3 h-3 flex-shrink-0"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M19 9l-7 7-7-7"
									/>
								</svg>
							</button>
						</Tooltip>

						{#if showFontPicker}
							<div className="absolute top-full mt-2 left-0 z-50">
								<div
									className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-3 min-w-[200px]"
								>
									{#if $availableFonts.length > 5}
										<div className="mb-2">
											<input
												type="text"
												placeholder="Search fonts..."
												bind:value={fontSearchQuery}
												className="w-full px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-charcoal dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-sage focus:border-transparent"
											/>
										</div>
									{/if}
									<div className="flex flex-col gap-1 max-h-[200px] overflow-y-auto font-picker-scroll">
										{#each filteredFonts as font}
											<button
												className="w-full px-3 py-2 text-left rounded-lg transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-sage focus:ring-offset-2"
												class:bg-sage={font.fontFamily === $drawingState.textFontFamily}
												class:text-white={font.fontFamily === $drawingState.textFontFamily}
												class:bg-opacity-20={font.fontFamily === $drawingState.textFontFamily}
												style="font-family: {font.fontFamily};"
												on:click={() => handleFontChange(font.fontFamily)}
												aria-label="Select font {font.name}"
											>
												<span className="text-sm">{font.name}</span>
											</button>
										{:else}
											<p className="text-sm text-gray-400 dark:text-gray-500 px-3 py-2">
												No fonts found
											</p>
										{/each}
									</div>
								</div>
							</div>
						{/if}
					</div>
				{/if}

				<Tooltip content={viewOnlyMode ? 'Arrow tool disabled in view-only mode' : 'Arrow (4)'}>
					<button
						className="tool-button w-8 h-8 flex items-center justify-center"
						class:active={$drawingState.tool === 'arrow'}
						disabled={viewOnlyMode}
						on:click={() => !viewOnlyMode && handleToolChange('arrow')}
						aria-label={viewOnlyMode ? 'Arrow tool disabled in view-only mode' : 'Arrow tool'}
					>
						<ArrowRight size={14} />
					</button>
				</Tooltip>

				<Tooltip
					content={viewOnlyMode ? 'Highlighter disabled in view-only mode' : 'Highlighter (5)'}
				>
					<button
						className="tool-button w-8 h-8 flex items-center justify-center"
						class:active={$drawingState.tool === 'highlight'}
						disabled={viewOnlyMode}
						on:click={() => !viewOnlyMode && handleToolChange('highlight')}
						aria-label={viewOnlyMode
							? 'Highlighter disabled in view-only mode'
							: 'Highlighter tool'}
					>
						<Highlighter size={14} />
					</button>
				</Tooltip>

				<Tooltip
					content={viewOnlyMode ? 'Sticky note disabled in view-only mode' : 'Sticky Note (6)'}
				>
					<button
						className="tool-button w-8 h-8 flex items-center justify-center"
						class:active={$drawingState.tool === 'note'}
						disabled={viewOnlyMode}
						on:click={() => !viewOnlyMode && handleToolChange('note')}
						aria-label={viewOnlyMode
							? 'Sticky note disabled in view-only mode'
							: 'Sticky note tool'}
					>
						<StickyNote size={14} />
					</button>
				</Tooltip>

				<Tooltip content="Select Text (7)">
					<button
						className="tool-button w-8 h-8 flex items-center justify-center"
						class:active={$drawingState.tool === 'select'}
						on:click={() => handleToolChange('select')}
						aria-label="Select text tool"
					>
						<MousePointerClick size={14} />
					</button>
				</Tooltip>

				<div className="h-4 w-px bg-charcoal/20"></div>

				<div className="relative stamp-palette-container">
					<Tooltip
						content={viewOnlyMode ? 'Stamps disabled in view-only mode' : 'Stamps/Stickers (S)'}
					>
						<button
							className="tool-button w-8 h-8 flex items-center justify-center"
							class:active={$drawingState.tool === 'stamp'}
							disabled={viewOnlyMode}
							on:click={() => {
								if (!viewOnlyMode) {
									handleToolChange('stamp');
									showStampPalette = !showStampPalette;
								}
							}}
							aria-label={viewOnlyMode
								? 'Stamps disabled in view-only mode'
								: 'Stamps and stickers'}
						>
							<Stamp size={14} />
						</button>
					</Tooltip>

					<StampPalette isOpen={showStampPalette} onClose={() => (showStampPalette = false)} />
				</div>

				<div className="h-4 w-px bg-charcoal/20"></div>

				<div className="h-4 w-px bg-charcoal/20"></div>

				{#if $drawingState.tool !== 'highlight'}
					<div className="relative color-palette-container">
						<Tooltip content="Drawing color">
							<button
								className="tool-button w-11 h-11 lg:w-8 lg:h-8 p-1"
								on:click={() => (showColorPalette = !showColorPalette)}
								aria-label="Choose drawing color"
							>
								<div
									className="w-full h-full rounded-md border border-white shadow-inner"
									style="background-color: {$drawingState.color}"
								></div>
							</button>
						</Tooltip>

						{#if showColorPalette}
							<div className="absolute top-full mt-2 left-0 z-50">
								<div
									className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-4 min-w-[200px]"
								>
									<div className="grid grid-cols-4 gap-3">
										{#each availableColors as color}
											<button
												className="w-8 h-8 rounded-full border-2 transition-all duration-200 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-sage focus:ring-offset-2"
												class:border-sage={color === $drawingState.color}
												class:border-gray-300={color !== $drawingState.color}
												class:scale-110={color === $drawingState.color}
												class:shadow-lg={color === $drawingState.color}
												style="background-color: {color}"
												on:click={() => handleColorChange(color)}
												aria-label="Select color {color}"
											>
												{#if color === $drawingState.color}
													<div className="w-full h-full rounded-full flex items-center justify-center">
														<svg
															className="w-3 h-3 text-white drop-shadow-sm"
															fill="currentColor"
															viewBox="0 0 20 20"
														>
															<path
																fill-rule="evenodd"
																d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
																clip-rule="evenodd"
															/>
														</svg>
													</div>
												{/if}
											</button>
										{/each}
									</div>
								</div>
							</div>
						{/if}
					</div>
				{/if}

				{#if $drawingState.tool === 'highlight'}
					<div className="relative highlight-color-container">
						<Tooltip content="Highlight color">
							<button
								className="tool-button w-11 h-11 lg:w-8 lg:h-8 p-1"
								on:click={() => (showHighlightColorPicker = !showHighlightColorPicker)}
								aria-label="Choose highlight color"
							>
								<div
									className="w-full h-full rounded-md border border-white shadow-inner opacity-60"
									style="background-color: {$drawingState.highlightColor}"
								></div>
							</button>
						</Tooltip>

						{#if showHighlightColorPicker}
							<div className="absolute top-full mt-2 left-0 z-50">
								<div
									className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-4 min-w-[200px]"
								>
									<h3
										className="text-xs font-medium text-charcoal/80 dark:text-gray-300 mb-3 text-center"
									>
										Highlight Color
									</h3>
									<div className="grid grid-cols-4 gap-3">
										{#each availableHighlightColors as color}
											<button
												className="w-8 h-8 rounded-full border-2 transition-all duration-200 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-sage focus:ring-offset-2 opacity-60 hover:opacity-80"
												class:border-sage={color === $drawingState.highlightColor}
												class:border-gray-300={color !== $drawingState.highlightColor}
												class:scale-110={color === $drawingState.highlightColor}
												class:shadow-lg={color === $drawingState.highlightColor}
												class:opacity-80={color === $drawingState.highlightColor}
												style="background-color: {color}"
												on:click={() => handleHighlightColorChange(color)}
												aria-label="Select highlight color {color}"
											>
												{#if color === $drawingState.highlightColor}
													<div className="w-full h-full rounded-full flex items-center justify-center">
														<svg
															className="w-3 h-3 text-white drop-shadow-sm"
															fill="currentColor"
															viewBox="0 0 20 20"
														>
															<path
																fill-rule="evenodd"
																d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
																clip-rule="evenodd"
															/>
														</svg>
													</div>
												{/if}
											</button>
										{/each}
									</div>
								</div>
							</div>
						{/if}
					</div>
				{/if}

				<div className="h-4 w-px bg-charcoal/20"></div>

				<div className="relative line-width-container">
					<Tooltip content="Brush size">
						<button
							className="tool-button w-11 h-11 lg:w-8 lg:h-8 flex items-center justify-center"
							on:click={() => (showLineWidthPicker = !showLineWidthPicker)}
							aria-label="Choose line thickness"
						>
							<div
								className="rounded-full bg-white dark:bg-white p-0.5 border border-gray-200 dark:border-white/30"
								style="width: {Math.max($drawingState.lineWidth * 2 + 4, 8)}px; height: {Math.max(
									$drawingState.lineWidth * 2 + 4,
									8
								)}px;"
							>
								<div className="rounded-full bg-charcoal w-full h-full"></div>
							</div>
						</button>
					</Tooltip>

					{#if showLineWidthPicker}
						<div className="absolute top-full mt-2 left-0 floating-panel animate-slide-up">
							<div className="flex flex-col space-y-2 p-2">
								{#each availableLineWidths as width}
									<button
										className="flex items-center justify-center p-2 rounded-lg hover:bg-sage/10 transition-colors"
										class:bg-sage={width === $drawingState.lineWidth}
										on:click={() => handleLineWidthChange(width)}
										aria-label="Line width {width} pixels"
									>
										<div
											className="rounded-full bg-white dark:bg-white p-0.5 border border-gray-200 dark:border-white/30"
											style="width: {Math.max(width * 2 + 4, 8)}px; height: {Math.max(
												width * 2 + 4,
												8
											)}px;"
										>
											<div className="rounded-full bg-charcoal w-full h-full"></div>
										</div>
										<span className="ml-2 text-sm text-charcoal dark:text-gray-200">{width}px</span>
									</button>
								{/each}
							</div>
						</div>
					{/if}
				</div>

				{#if $drawingState.tool === 'eraser'}
					<div className="relative eraser-size-container">
						<Tooltip content="Eraser size">
							<button
								className="tool-button w-11 h-11 lg:w-8 lg:h-8 flex items-center justify-center"
								on:click={() => (showEraserSizePicker = !showEraserSizePicker)}
								aria-label="Choose eraser size"
							>
								<div
									className="rounded-full bg-white dark:bg-white p-0.5 border border-gray-200 dark:border-white/30"
									style="width: {Math.max(
										$drawingState.eraserSize / 2 + 4,
										10
									)}px; height: {Math.max($drawingState.eraserSize / 2 + 4, 10)}px;"
								>
									<div className="rounded-full bg-charcoal opacity-50 w-full h-full"></div>
								</div>
							</button>
						</Tooltip>

						{#if showEraserSizePicker}
							<div className="absolute top-full mt-2 left-0 floating-panel animate-slide-up">
								<div className="flex flex-col space-y-2 p-2">
									{#each availableEraserSizes as size}
										<button
											className="flex items-center justify-center p-2 rounded-lg hover:bg-sage/10 transition-colors"
											class:bg-sage={size === $drawingState.eraserSize}
											on:click={() => handleEraserSizeChange(size)}
											aria-label="Eraser size {size} pixels"
										>
											<div
												className="rounded-full bg-white dark:bg-white p-0.5 border border-gray-200 dark:border-white/30"
												style="width: {Math.max(size / 2 + 4, 10)}px; height: {Math.max(
													size / 2 + 4,
													10
												)}px;"
											>
												<div className="rounded-full bg-charcoal opacity-50 w-full h-full"></div>
											</div>
											<span className="ml-2 text-sm text-charcoal dark:text-gray-200">{size}px</span>
										</button>
									{/each}
								</div>
							</div>
						{/if}
					</div>
				{/if}
			</div> */}

          {/* <div className="flex items-center space-x-2">
				<div className="flex items-center space-x-2">
					<Tooltip content={viewOnlyMode ? 'Undo disabled in view-only mode' : 'Undo (Ctrl+Z)'}>
						<button
							className="tool-button w-11 h-11 lg:w-8 lg:h-8 flex items-center justify-center"
							class:opacity-50={$undoStack.length === 0 || viewOnlyMode}
							disabled={$undoStack.length === 0 || viewOnlyMode}
							on:click={handleUndo}
							aria-label={viewOnlyMode ? 'Undo disabled in view-only mode' : 'Undo last action'}
						>
							<Undo2 size={16} className="lg:w-3.5 lg:h-3.5" />
						</button>
					</Tooltip>

					<Tooltip content={viewOnlyMode ? 'Redo disabled in view-only mode' : 'Redo (Ctrl+Y)'}>
						<button
							className="tool-button w-11 h-11 lg:w-8 lg:h-8 flex items-center justify-center"
							class:opacity-50={$redoStack.length === 0 || viewOnlyMode}
							disabled={$redoStack.length === 0 || viewOnlyMode}
							on:click={handleRedo}
							aria-label={viewOnlyMode ? 'Redo disabled in view-only mode' : 'Redo last action'}
						>
							<Redo2 size={16} className="lg:w-3.5 lg:h-3.5" />
						</button>
					</Tooltip>

					<Tooltip content="Search PDF documents">
						<button
							className="tool-button w-11 h-11 lg:w-8 lg:h-8 flex items-center justify-center group"
							on:click={handleSearchLinkClick}
							aria-label="Search PDF documents"
						>
							<Search size={18} className="group-hover:text-blue-600 lg:w-4 lg:h-4" />
						</button>
					</Tooltip>

					<Tooltip
						content={viewOnlyMode ? 'Clear disabled in view-only mode' : 'Delete all changes'}
					>
						<button
							className="tool-button w-11 h-11 lg:w-8 lg:h-8 flex items-center justify-center text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
							class:opacity-50={!$pdfState.document || viewOnlyMode}
							disabled={!$pdfState.document || viewOnlyMode}
							on:click={handleClear}
							aria-label={viewOnlyMode
								? 'Clear disabled in view-only mode'
								: 'Delete all changes on this page'}
						>
							<Trash2 size={16} className="lg:w-3.5 lg:h-3.5" />
						</button>
					</Tooltip>

					{#if onSharePDF && !isSharedView}
						<Tooltip content="Share PDF with link">
							<button
								className="tool-button w-11 h-11 lg:w-8 lg:h-8 flex items-center justify-center text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
								class:opacity-50={!$pdfState.document}
								disabled={!$pdfState.document}
								on:click={onSharePDF}
								aria-label="Share PDF with link"
							>
								<Share size={16} className="lg:w-3.5 lg:h-3.5" />
							</button>
						</Tooltip>
					{/if}

					{#if allowDownloading}
						<div className="relative export-menu-container">
							<Tooltip content="Export options (Ctrl+S)">
								<button
									className="tool-button w-11 h-11 lg:w-8 lg:h-8 flex items-center justify-center text-sage hover:bg-sage/10"
									class:opacity-50={!$pdfState.document}
									disabled={!$pdfState.document}
									on:click={() => (showExportMenu = !showExportMenu)}
									aria-label="Export options"
								>
									<Download size={16} className="lg:w-3.5 lg:h-3.5" />
								</button>
							</Tooltip>

							{#if showExportMenu}
								<div className="absolute top-full mt-2 right-0 z-50 min-w-[180px]">
									<div
										className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-2"
									>
										{#if onSharePDF && !isSharedView}
											<button
												className="w-full text-left p-2 rounded-lg hover:bg-sage/10 transition-colors text-sm flex items-center gap-2"
												class:opacity-50={!$pdfState.document}
												disabled={!$pdfState.document}
												on:click={() => {
													onSharePDF();
													showExportMenu = false;
												}}
											>
												<Share size={16} className="text-blue-600" />
												Share with Link
											</button>
											<div className="border-t border-gray-200 dark:border-gray-600 my-1"></div>
										{/if}
										<button
											className="w-full text-left p-2 rounded-lg hover:bg-sage/10 transition-colors text-sm flex items-center gap-2"
											on:click={() => {
												onExportPDF();
												showExportMenu = false;
											}}
										>
											<Download size={16} className="text-sage" />
											Export as PDF
										</button>
										<button
											className="w-full text-left p-2 rounded-lg hover:bg-sage/10 transition-colors text-sm flex items-center gap-2"
											on:click={() => {
												onExportLPDF();
												showExportMenu = false;
											}}
										>
											<Package size={16} className="text-sage" />
											Export as LPDF
										</button>
										<button
											className="w-full text-left p-2 rounded-lg hover:bg-sage/10 transition-colors text-sm flex items-center gap-2"
											on:click={() => {
												onExportDOCX();
												showExportMenu = false;
											}}
										>
											<FileText size={16} className="text-blue-600" />
											Export as DOCX
										</button>
										{#if onExportPNG}
											<button
												className="w-full text-left p-2 rounded-lg hover:bg-sage/10 transition-colors text-sm flex items-center gap-2"
												class:opacity-50={!$pdfState.document}
												disabled={!$pdfState.document}
												on:click={() => {
													if (!$pdfState.document) return;
													onExportPNG();
													showExportMenu = false;
												}}
											>
												<Image size={16} className="text-sage" />
												Export as PNG{$pdfState.totalPages > 1 ? 's' : ''}
											</button>
										{/if}
										{#if onExportCompressedPDF}
											<button
												className="w-full text-left p-2 rounded-lg hover:bg-sage/10 transition-colors text-sm flex items-center gap-2"
												class:opacity-50={!$pdfState.document}
												disabled={!$pdfState.document}
												on:click={() => {
													onExportCompressedPDF();
													showExportMenu = false;
												}}
											>
												<Minimize2 size={16} className="text-sage" />
												Compress PDF & Export
											</button>
										{/if}
									</div>
								</div>
							{/if}
						</div>
					{/if}
				</div>

				<div className="hidden lg:flex items-center space-x-2">
					<div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg">
						<span className="text-sm text-charcoal dark:text-gray-200 capitalize"
							>{$drawingState.tool}</span
						>
						<span className="text-xs text-charcoal/70 dark:text-gray-400">
							{$drawingState.tool === 'eraser'
								? $drawingState.eraserSize
								: $drawingState.lineWidth}px
						</span>
					</div>

					<Tooltip content="Toggle light/dark mode">
						<button
							className="tool-button w-8 h-8 flex items-center justify-center"
							on:click={toggleTheme}
							aria-label="Toggle light/dark mode"
						>
							{#if $isDarkMode}
								<Sun size={16} />
							{:else}
								<Moon size={16} />
							{/if}
						</button>
					</Tooltip>

					{#if onPresentationModeChange}
						<Tooltip content="Presentation mode (P)">
							<button
								className="tool-button w-8 h-8 flex items-center justify-center"
								class:active={presentationMode}
								class:opacity-50={!$pdfState.document}
								disabled={!$pdfState.document}
								on:click={() => onPresentationModeChange(!presentationMode)}
								aria-label="Toggle presentation mode"
							>
								<Presentation size={16} />
							</button>
						</Tooltip>
					{/if}
				</div>

				<div className="hidden lg:hidden">
					<div className="flex items-center space-x-2 px-3 py-2 bg-sage/10 rounded-lg">
						<span className="text-xs text-sage font-medium">{$drawingState.tool}</span>
						<span className="text-xs text-charcoal/70 dark:text-gray-400">
							{Math.max(
								$drawingState.tool === 'eraser'
									? $drawingState.eraserSize
									: $drawingState.lineWidth,
								1
							)}px
						</span>
					</div>

					<Tooltip content="Toggle light/dark mode">
						<button
							className="tool-button w-11 h-11 items-center justify-center"
							on:click={toggleTheme}
							aria-label="Toggle light/dark mode"
						>
							{#if $isDarkMode}
								<Sun size={16} />
							{:else}
								<Moon size={16} />
							{/if}
						</button>
					</Tooltip>
				</div>

				<div className="relative lg:hidden">
					<Tooltip content="More options">
						<button
							className="tool-button w-11 h-11 lg:w-8 lg:h-8 flex items-center justify-center"
							on:click={() => (showMoreMenu = !showMoreMenu)}
							aria-label="More options"
						>
							<MoreHorizontal size={18} className="lg:w-4 lg:h-4" />
						</button>
					</Tooltip>

					{#if showMoreMenu}
						<div className="absolute top-full mt-2 right-0 z-50 min-w-[200px]">
							<div
								className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-3"
							>
								<div className="mb-3 p-2 bg-sage/10 rounded-lg">
									<div className="text-xs text-sage font-medium mb-1">Current Tool</div>
									<div className="text-sm text-charcoal dark:text-gray-200 capitalize">
										{$drawingState.tool}
									</div>
									<div className="text-xs text-charcoal/70 dark:text-gray-400">
										{$drawingState.tool === 'eraser'
											? $drawingState.eraserSize
											: $drawingState.lineWidth}px
									</div>
								</div>

								<div className="space-y-1 mb-3">
									<button
										className="w-full text-left p-2 rounded-lg hover:bg-sage/10 transition-colors text-sm flex items-center gap-2"
										on:click={() => {
											handleFileSelect();
											showMoreMenu = false;
										}}
									>
										<FileText size={14} />
										Open PDF file
									</button>
								</div>

								<div className="space-y-1 mb-3">
									{#if onSharePDF && !isSharedView}
										<button
											className="w-full text-left p-2 rounded-lg hover:bg-sage/10 transition-colors text-sm flex items-center gap-2"
											class:opacity-50={!$pdfState.document}
											disabled={!$pdfState.document}
											on:click={() => {
												onSharePDF();
												showMoreMenu = false;
											}}
										>
											<Share size={14} />
											Share with Link
										</button>
									{/if}
									{#if allowDownloading}
										<button
											className="w-full text-left p-2 rounded-lg hover:bg-sage/10 transition-colors text-sm flex items-center gap-2"
											class:opacity-50={!$pdfState.document}
											disabled={!$pdfState.document}
											on:click={() => {
												onExportPDF();
												showMoreMenu = false;
											}}
										>
											<Download size={14} />
											Export as PDF
										</button>
										<button
											className="w-full text-left p-2 rounded-lg hover:bg-sage/10 transition-colors text-sm flex items-center gap-2"
											class:opacity-50={!$pdfState.document}
											disabled={!$pdfState.document}
											on:click={() => {
												onExportLPDF();
												showMoreMenu = false;
											}}
										>
											<Package size={14} />
											Export as LPDF
										</button>
										<button
											className="w-full text-left p-2 rounded-lg hover:bg-sage/10 transition-colors text-sm flex items-center gap-2"
											class:opacity-50={!$pdfState.document}
											disabled={!$pdfState.document}
											on:click={() => {
												onExportDOCX();
												showMoreMenu = false;
											}}
										>
											<FileText size={14} />
											Export as DOCX
										</button>
										{#if onExportPNG}
											<button
												className="w-full text-left p-2 rounded-lg hover:bg-sage/10 transition-colors text-sm flex items-center gap-2"
												class:opacity-50={!$pdfState.document}
												disabled={!$pdfState.document}
												on:click={() => {
													if (!$pdfState.document) return;
													onExportPNG();
													showMoreMenu = false;
												}}
											>
												<Image size={14} className="text-sage" />
												Export as PNG{$pdfState.totalPages > 1 ? 's' : ''}
											</button>
										{/if}
										{#if onExportCompressedPDF}
											<button
												className="w-full text-left p-2 rounded-lg hover:bg-sage/10 transition-colors text-sm flex items-center gap-2"
												class:opacity-50={!$pdfState.document}
												disabled={!$pdfState.document}
												on:click={() => {
													onExportCompressedPDF();
													showMoreMenu = false;
												}}
											>
												<Minimize2 size={14} />
												Compress PDF & Export
											</button>
										{/if}
									{/if}
								</div>

								<div className="space-y-1 mb-3">
									<button
										className="w-full text-left p-2 rounded-lg hover:bg-sage/10 transition-colors text-sm flex items-center gap-2"
										on:click={() => {
											onResetZoom();
											showMoreMenu = false;
										}}
									>
										<RotateCcw size={14} />
										Reset size
									</button>
									<button
										className="w-full text-left p-2 rounded-lg hover:bg-sage/10 transition-colors text-sm flex items-center gap-2"
										on:click={() => {
											onFitToWidth();
											showMoreMenu = false;
										}}
									>
										<ArrowLeftRight size={14} />
										Fit width
									</button>
									<button
										className="w-full text-left p-2 rounded-lg hover:bg-sage/10 transition-colors text-sm flex items-center gap-2"
										on:click={() => {
											onFitToHeight();
											showMoreMenu = false;
										}}
									>
										<ArrowUpDown size={14} />
										Fit height
									</button>
								</div>

								<div className="space-y-1 mb-3">
									<button
										className="w-full text-left p-2 rounded-lg hover:bg-sage/10 transition-colors text-sm flex items-center gap-2"
										class:opacity-50={$pdfState.currentPage <= 1}
										disabled={$pdfState.currentPage <= 1}
										on:click={() => {
											onPreviousPage();
											showMoreMenu = false;
										}}
									>
										<ChevronLeft size={14} />
										Previous page
									</button>
									<button
										className="w-full text-left p-2 rounded-lg hover:bg-sage/10 transition-colors text-sm flex items-center gap-2"
										class:opacity-50={$pdfState.currentPage >= $pdfState.totalPages}
										disabled={$pdfState.currentPage >= $pdfState.totalPages}
										on:click={() => {
											onNextPage();
											showMoreMenu = false;
										}}
									>
										<ChevronRight size={14} />
										Next page
									</button>
								</div>

								<div className="space-y-1 mb-3">
									<button
										className="w-full text-left p-2 rounded-lg hover:bg-sage/10 transition-colors text-sm flex items-center gap-2"
										on:click={() => {
											handleClear();
											showMoreMenu = false;
										}}
									>
										<Trash2 size={14} />
										Delete changes
									</button>
								</div>

								<div className="pt-2 border-t border-gray-200 dark:border-gray-600">
									<button
										className="w-full text-left p-2 rounded-lg hover:bg-sage/10 transition-colors text-sm"
										on:click={() => {
											toggleTheme();
											showMoreMenu = false;
										}}
									>
										<div className="flex items-center gap-2">
											{#if $isDarkMode}
												<Sun size={14} />
												<span>Light mode</span>
											{:else}
												<Moon size={14} />
												<span>Dark mode</span>
											{/if}
										</div>
									</button>
								</div>

								<div className="pt-2 border-t border-gray-200 dark:border-gray-600">
									<div className="flex items-center justify-between p-2">
										<span className="text-xs text-charcoal/60 dark:text-gray-400">Made by Rudi K</span>
										<a
											href="https://github.com/rudi-q/leed_pdf_viewer"
											target="_blank"
											rel="noopener"
											className="text-charcoal/60 dark:text-gray-400 hover:text-sage dark:hover:text-sage transition-colors"
											aria-label="View on GitHub"
										>
											<svg
												width="14"
												height="14"
												viewBox="0 0 24 24"
												fill="currentColor"
												aria-hidden="true"
											>
												<path
													d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.30 3.297-1.30.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"
												/>
											</svg>
										</a>
									</div>
								</div>
							</div>
						</div>
					{/if}
				</div>
			</div> */}
        </div>
      </div>
    </div>
  )
}
