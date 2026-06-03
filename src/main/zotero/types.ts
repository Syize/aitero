export interface ZoteroLibraryContext {
  dataDir: string | null
}

export interface ZoteroLibrarySummary {
  isConfigured: boolean
  dataDir: string | null
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
