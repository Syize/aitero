import type { AppConfigStore } from '../config/store'
import type {
  ZoteroCollectionNode,
  ZoteroItemDetail,
  ZoteroItemListEntry,
  ZoteroLibraryContext,
  ZoteroLibrarySummary
} from './types'

export class ZoteroService {
  constructor(private readonly configStore: AppConfigStore) {}

  private context: ZoteroLibraryContext = {
    dataDir: null
  }

  async initialize(): Promise<void> {
    const config = await this.configStore.load()

    this.context = {
      ...this.context,
      dataDir: config.zotero.dataDir
    }
  }

  getSummary(): ZoteroLibrarySummary {
    return {
      isConfigured: this.context.dataDir !== null,
      dataDir: this.context.dataDir
    }
  }

  getDataDir(): string | null {
    return this.context.dataDir
  }

  async configureDataDir(dataDir: string | null): Promise<void> {
    this.context = {
      ...this.context,
      dataDir
    }

    await this.configStore.save({
      zotero: {
        dataDir
      }
    })
  }

  async listCollections(): Promise<ZoteroCollectionNode[]> {
    this.assertConfigured()
    return []
  }

  async listItems(): Promise<ZoteroItemListEntry[]> {
    this.assertConfigured()
    return []
  }

  async getItemDetail(_itemId: number): Promise<ZoteroItemDetail | null> {
    this.assertConfigured()
    return null
  }

  private assertConfigured(): void {
    if (!this.context.dataDir) {
      throw new Error('Zotero data directory is not configured')
    }
  }
}

export function createZoteroService(configStore: AppConfigStore): ZoteroService {
  return new ZoteroService(configStore)
}
