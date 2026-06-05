import type {
  ZoteroAttachment,
  ZoteroCollectionNode,
  ZoteroItemDetail,
  ZoteroItemListFilters,
  ZoteroItemListEntry,
  ZoteroLibrarySummary
} from './types'

export interface ZoteroResolvedPdf {
  itemId: number
  attachmentId: number
  title: string
  pdfPath: string
}

export interface ZoteroApi {
  selectZoteroDataDir(): Promise<ZoteroDataDirSelectionResult>
  getZoteroConfig(): Promise<ZoteroLibrarySummary>
  listCollections(): Promise<ZoteroCollectionNode[]>
  listItems(filters: ZoteroItemListFilters): Promise<ZoteroItemListEntry[]>
  getItemDetail(itemId: number): Promise<ZoteroItemDetail | null>
  resolveItemDefaultPdf(itemId: number): Promise<ZoteroResolvedPdf | null>
}

export type ZoteroWindowApi = ZoteroApi

export type ZoteroDataDirIssueCode =
  | 'data-dir-not-configured'
  | 'data-dir-not-found'
  | 'data-dir-not-directory'
  | 'missing-zotero-database'
  | 'missing-storage-directory'
  | 'storage-path-not-directory'

export type ZoteroApiErrorCode =
  | ZoteroDataDirIssueCode
  | 'config-load-failed'
  | 'config-save-failed'
  | 'data-dir-validation-failed'
  | 'directory-selection-failed'
  | 'database-open-failed'
  | 'database-query-failed'
  | 'database-close-failed'

export interface ZoteroDataDirSelectionResult {
  canceled: boolean
  summary: ZoteroLibrarySummary
}

export class ZoteroApiError extends Error {
  constructor(
    readonly code: ZoteroApiErrorCode,
    message: string
  ) {
    super(message)
    this.name = 'ZoteroApiError'
  }
}

export const zoteroApi: ZoteroApi = {
  selectZoteroDataDir: () => window.api.zotero.selectZoteroDataDir(),
  getZoteroConfig: () => window.api.zotero.getZoteroConfig(),
  listCollections: () => window.api.zotero.listCollections(),
  listItems: (filters) => window.api.zotero.listItems(filters),
  getItemDetail: (itemId) => window.api.zotero.getItemDetail(itemId),
  resolveItemDefaultPdf: (itemId) => window.api.zotero.resolveItemDefaultPdf(itemId)
}

export type {
  ZoteroAttachment,
  ZoteroCollectionNode,
  ZoteroItemDetail,
  ZoteroItemListFilters,
  ZoteroItemListEntry,
  ZoteroLibrarySummary
}
