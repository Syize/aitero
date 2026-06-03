export interface ReaderTabState {
  itemId?: number
  attachmentId?: number
  title: string
  pdfPath?: string
}

export interface LibraryFilterState {
  collectionId: number | null
  query: string
  selectedItemId: number | null
}

export interface LibraryTab {
  id: 'library'
  type: 'library'
  label: 'Library'
  closable: false
}

export interface ReaderTab {
  id: string
  type: 'reader'
  label: string
  closable: true
  reader: ReaderTabState
}

export type WorkspaceTab =
  | LibraryTab
  | ReaderTab
