import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import {
  type ZoteroIpcError,
  type ZoteroIpcResult,
  type ZoteroPreloadApi,
  zoteroIpcChannels
} from '../main/zotero/ipc'

// Custom APIs for renderer
const api = {
  zotero: {
    selectZoteroDataDir: () =>
      invokeZotero<ReturnType<ZoteroPreloadApi['selectZoteroDataDir']>>(
        zoteroIpcChannels.selectZoteroDataDir
      ),
    getZoteroConfig: () =>
      invokeZotero<ReturnType<ZoteroPreloadApi['getZoteroConfig']>>(zoteroIpcChannels.getZoteroConfig),
    listCollections: () =>
      invokeZotero<ReturnType<ZoteroPreloadApi['listCollections']>>(zoteroIpcChannels.listCollections),
    listItems: (filters) =>
      invokeZotero<ReturnType<ZoteroPreloadApi['listItems']>>(zoteroIpcChannels.listItems, filters),
    getItemDetail: (itemId: number) =>
      invokeZotero<ReturnType<ZoteroPreloadApi['getItemDetail']>>(
        zoteroIpcChannels.getItemDetail,
        itemId
      ),
    resolveItemDefaultPdf: (itemId: number) =>
      invokeZotero<ReturnType<ZoteroPreloadApi['resolveItemDefaultPdf']>>(
        zoteroIpcChannels.resolveItemDefaultPdf,
        itemId
      )
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}

async function invokeZotero<T extends Promise<unknown>>(
  channel: string,
  ...args: unknown[]
): Promise<Awaited<T>> {
  const result = await ipcRenderer.invoke(channel, ...args)

  return unwrapZoteroResult(result as ZoteroIpcResult<Awaited<T>>)
}

function unwrapZoteroResult<T>(result: ZoteroIpcResult<T>): T {
  if (result.ok) {
    return result.data
  }

  throw createZoteroRendererError(result.error)
}

function createZoteroRendererError(error: ZoteroIpcError): Error & { code: ZoteroIpcError['code'] } {
  const rendererError = new Error(error.message) as Error & { code: ZoteroIpcError['code'] }
  rendererError.name = 'ZoteroRendererError'
  rendererError.code = error.code
  return rendererError
}
