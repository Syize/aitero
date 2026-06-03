import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

export interface AppConfig {
  zotero: {
    dataDir: string | null
  }
}

const DEFAULT_APP_CONFIG: AppConfig = {
  zotero: {
    dataDir: null
  }
}

export class AppConfigStore {
  private readonly filePath: string

  constructor(userDataPath: string) {
    this.filePath = join(userDataPath, 'config.json')
  }

  async load(): Promise<AppConfig> {
    try {
      const raw = await readFile(this.filePath, 'utf-8')
      const parsed = JSON.parse(raw) as Partial<AppConfig>

      return {
        zotero: {
          dataDir: parsed.zotero?.dataDir ?? DEFAULT_APP_CONFIG.zotero.dataDir
        }
      }
    } catch (error) {
      if (isMissingFileError(error)) {
        return DEFAULT_APP_CONFIG
      }

      throw error
    }
  }

  async save(config: AppConfig): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true })
    await writeFile(this.filePath, JSON.stringify(config, null, 2), 'utf-8')
  }

  getConfigPath(): string {
    return this.filePath
  }
}

export function createAppConfigStore(userDataPath: string): AppConfigStore {
  return new AppConfigStore(userDataPath)
}

function isMissingFileError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT'
}
