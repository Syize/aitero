import type {
  ZoteroCollectionNode,
  ZoteroDataDirSelectionResult,
  ZoteroItemDetail,
  ZoteroItemListFilters,
  ZoteroItemListEntry,
  ZoteroLibrarySummary,
  ZoteroResolvedPdf,
  ZoteroServiceErrorCode
} from './types'

export const zoteroIpcChannels = {
  selectZoteroDataDir: 'zotero:select-data-dir',
  getZoteroConfig: 'zotero:get-config',
  listCollections: 'zotero:list-collections',
  listItems: 'zotero:list-items',
  getItemDetail: 'zotero:get-item-detail',
  resolveItemDefaultPdf: 'zotero:resolve-default-pdf'
} as const

export interface ZoteroIpcError {
  code: ZoteroServiceErrorCode
  message: string
}

export type ZoteroIpcResult<T> =
  | {
      ok: true
      data: T
    }
  | {
      ok: false
      error: ZoteroIpcError
    }

export interface ZoteroPreloadApi {
  selectZoteroDataDir(): Promise<ZoteroDataDirSelectionResult>
  getZoteroConfig(): Promise<ZoteroLibrarySummary>
  listCollections(): Promise<ZoteroCollectionNode[]>
  listItems(filters: ZoteroItemListFilters): Promise<ZoteroItemListEntry[]>
  getItemDetail(itemId: number): Promise<ZoteroItemDetail | null>
  resolveItemDefaultPdf(itemId: number): Promise<ZoteroResolvedPdf | null>
}
