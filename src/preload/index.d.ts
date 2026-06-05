import { ElectronAPI } from '@electron-toolkit/preload'
import type { ZoteroWindowApi } from '../renderer/src/zotero/api'

export interface AppApi {
  zotero: ZoteroWindowApi
  reader: {
    readPdfFile(filePath: string): Promise<ArrayBuffer>
  }
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: AppApi
  }
}
