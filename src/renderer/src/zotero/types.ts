export type ZoteroDataDirIssueCode =
  | 'data-dir-not-configured'
  | 'data-dir-not-found'
  | 'data-dir-not-directory'
  | 'missing-zotero-database'
  | 'missing-storage-directory'
  | 'storage-path-not-directory'

export interface ZoteroDataDirIssue {
  code: ZoteroDataDirIssueCode
  message: string
  path: string | null
}

export interface ZoteroDataDirValidation {
  isValid: boolean
  normalizedDataDir: string | null
  databasePath: string | null
  storageDir: string | null
  issues: ZoteroDataDirIssue[]
}

export interface ZoteroLibrarySummary {
  isConfigured: boolean
  dataDir: string | null
  validation: ZoteroDataDirValidation
}

export interface ZoteroCollectionNode {
  id: number
  name: string
  parentId: number | null
}

export interface ZoteroItemListEntry {
  id: number
  title: string
  year: string | null
  creatorsText: string
  hasPdf: boolean
}

export interface ZoteroAttachment {
  id: number
  title: string
  path: string | null
  contentType: string | null
}

export interface ZoteroItemDetail {
  id: number
  title: string
  year: string | null
  creatorsText: string
  attachments: ZoteroAttachment[]
}
