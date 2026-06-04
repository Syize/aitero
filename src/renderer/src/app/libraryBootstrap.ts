import { useEffect, useEffectEvent, useState } from 'react'
import { zoteroApi } from '../zotero/api'
import type { ZoteroApiErrorCode } from '../zotero/api'
import type { ZoteroLibrarySummary } from '../zotero/types'

export type LibraryBootstrapStatus =
  | 'loading-config'
  | 'needs-setup'
  | 'invalid-config'
  | 'selecting-directory'
  | 'load-failed'
  | 'ready'

export interface LibraryBootstrapError {
  code: ZoteroApiErrorCode | 'unknown'
  message: string
}

export interface LibraryBootstrapState {
  status: LibraryBootstrapStatus
  summary: ZoteroLibrarySummary | null
  error: LibraryBootstrapError | null
  pendingLabel: string | null
}

export function useLibraryBootstrap() {
  const [state, setState] = useState<LibraryBootstrapState>({
    status: 'loading-config',
    summary: null,
    error: null,
    pendingLabel: 'Loading saved Zotero configuration...'
  })

  const loadConfig = useEffectEvent(async () => {
    setState((currentState) => ({
      ...currentState,
      status: 'loading-config',
      error: null,
      pendingLabel: 'Loading saved Zotero configuration...'
    }))

    try {
      const summary = await zoteroApi.getZoteroConfig()

      setState({
        status: resolveBootstrapStatus(summary),
        summary,
        error: null,
        pendingLabel: null
      })
    } catch (error) {
      setState({
        status: 'load-failed',
        summary: null,
        error: normalizeBootstrapError(error),
        pendingLabel: null
      })
    }
  })

  useEffect(() => {
    void loadConfig()
  }, [])

  const selectDataDir = useEffectEvent(async () => {
    const previousSummary = state.summary
    const previousStatus = state.status

    setState((currentState) => ({
      ...currentState,
      status: 'selecting-directory',
      error: null,
      pendingLabel: 'Waiting for Zotero directory selection...'
    }))

    try {
      const result = await zoteroApi.selectZoteroDataDir()

      setState({
        status: resolveBootstrapStatus(result.summary),
        summary: result.summary,
        error: null,
        pendingLabel: null
      })
    } catch (error) {
      setState({
        status: resolveFallbackStatus(previousStatus, previousSummary),
        summary: previousSummary,
        error: normalizeBootstrapError(error),
        pendingLabel: null
      })
    }
  })

  return {
    ...state,
    retry: () => void loadConfig(),
    selectDataDir: () => void selectDataDir()
  }
}

function resolveBootstrapStatus(summary: ZoteroLibrarySummary): LibraryBootstrapStatus {
  if (!summary.isConfigured) {
    return 'needs-setup'
  }

  if (!summary.validation.isValid) {
    return 'invalid-config'
  }

  return 'ready'
}

function normalizeBootstrapError(error: unknown): LibraryBootstrapError {
  if (error instanceof Error && 'code' in error && typeof error.code === 'string') {
    return {
      code: error.code as ZoteroApiErrorCode,
      message: error.message
    }
  }

  if (error instanceof Error) {
    return {
      code: 'unknown',
      message: error.message
    }
  }

  return {
    code: 'unknown',
    message: 'Unable to read Zotero startup state.'
  }
}

function resolveFallbackStatus(
  previousStatus: LibraryBootstrapStatus,
  summary: ZoteroLibrarySummary | null
): LibraryBootstrapStatus {
  if (previousStatus === 'needs-setup' || previousStatus === 'invalid-config') {
    return previousStatus
  }

  if (summary) {
    return resolveBootstrapStatus(summary)
  }

  return 'needs-setup'
}
