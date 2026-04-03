import { usePDFContext } from './pdfState'
import { PDFManagerProps } from './utils'

export default function PDFLoader({ manager }: PDFManagerProps) {
	const { setDocument, setIsLoading } = usePDFContext()

	async function handleFile(file: File) {
		setIsLoading(true)

		const doc = await manager.loadFromFile(file)

		setDocument(doc, 1, doc.numPages, 1.2, 0, false)
	}

	return (
		<input
			type="file"
			accept="application/pdf"
			onChange={(e) => {
				const file = e.target.files?.[0]
				if (file) handleFile(file)
			}}
		/>
	)
}
