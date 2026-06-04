import { ElectronAPI } from '@electron-toolkit/preload'
import type { ZoteroWindowApi } from '../renderer/src/zotero/api'

export interface AppApi {
  zotero: ZoteroWindowApi
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: AppApi
  }
}
