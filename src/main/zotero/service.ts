import { access, stat } from 'node:fs/promises'
import { constants, copyFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs'
import { basename, isAbsolute, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { dialog } from 'electron'
import type { BrowserWindow } from 'electron'
import type { OpenDialogOptions } from 'electron'
import { DatabaseSync } from 'node:sqlite'
import type { AppConfigStore } from '../config/store'
import type {
  ZoteroCollectionNode,
  ZoteroDataDirIssue,
  ZoteroDataDirIssueCode,
  ZoteroDataDirSelectionResult,
  ZoteroDataDirValidation,
  ZoteroItemDetail,
  ZoteroItemListFilters,
  ZoteroItemListEntry,
  ZoteroLibraryContext,
  ZoteroLibrarySummary,
  ZoteroResolvedPdf,
  ZoteroServiceErrorCode
} from './types'

export class ZoteroService {
  constructor(private readonly configStore: AppConfigStore) {}

  private context: ZoteroLibraryContext = {
    dataDir: null,
    validation: createUnconfiguredValidation(),
    databaseAccess: createDirectDatabaseAccessState()
  }

  async initialize(): Promise<void> {
    let config: Awaited<ReturnType<AppConfigStore['load']>>

    try {
      config = await this.configStore.load()
    } catch (error) {
      throw mapUnexpectedError(
        error,
        'config-load-failed',
        'Unable to read the saved Zotero configuration.'
      )
    }

    try {
      await this.refreshContext(config.zotero.dataDir)
    } catch (error) {
      throw mapUnexpectedError(
        error,
        'data-dir-validation-failed',
        'Unable to validate the saved Zotero data directory.'
      )
    }
  }

  getSummary(): ZoteroLibrarySummary {
    return {
      isConfigured: this.context.dataDir !== null,
      dataDir: this.context.dataDir,
      validation: this.context.validation,
      databaseAccess: this.context.databaseAccess
    }
  }

  getDataDir(): string | null {
    return this.context.dataDir
  }

  async getZoteroConfig(): Promise<ZoteroLibrarySummary> {
    return this.getSummary()
  }

  async selectZoteroDataDir(
    ownerWindow?: BrowserWindow
  ): Promise<ZoteroDataDirSelectionResult> {
    const dialogOptions: OpenDialogOptions = {
      title: 'Select Zotero Data Directory',
      defaultPath: this.context.dataDir ?? undefined,
      properties: ['openDirectory']
    }

    let selection: Awaited<ReturnType<typeof dialog.showOpenDialog>>

    try {
      selection = ownerWindow
        ? await dialog.showOpenDialog(ownerWindow, dialogOptions)
        : await dialog.showOpenDialog(dialogOptions)
    } catch (error) {
      throw mapUnexpectedError(
        error,
        'directory-selection-failed',
        'Unable to open the Zotero data directory picker.'
      )
    }

    if (selection.canceled || selection.filePaths.length === 0) {
      return {
        canceled: true,
        summary: this.getSummary()
      }
    }

    await this.configureDataDir(selection.filePaths[0])

    return {
      canceled: false,
      summary: this.getSummary()
    }
  }

  async configureDataDir(dataDir: string | null): Promise<void> {
    try {
      await this.refreshContext(dataDir)
    } catch (error) {
      throw mapUnexpectedError(
        error,
        'data-dir-validation-failed',
        'Unable to validate the selected Zotero data directory.'
      )
    }

    try {
      await this.configStore.save({
        zotero: {
          dataDir
        }
      })
    } catch (error) {
      throw mapUnexpectedError(
        error,
        'config-save-failed',
        'Unable to save the selected Zotero data directory.'
      )
    }
  }

  async listCollections(): Promise<ZoteroCollectionNode[]> {
    this.assertConfigured()

    return this.withReadonlyDatabase((database) => {
      const statement = database.prepare(`
        SELECT
          collections.collectionID AS id,
          collections.collectionName AS name,
          collections.parentCollectionID AS parentId
        FROM collections
        LEFT JOIN deletedCollections
          ON deletedCollections.collectionID = collections.collectionID
        WHERE deletedCollections.collectionID IS NULL
        ORDER BY
          CASE WHEN collections.parentCollectionID IS NULL THEN 0 ELSE 1 END,
          collections.parentCollectionID,
          collections.collectionName COLLATE NOCASE,
          collections.collectionID
      `)

      return statement.all().map((row) => mapCollectionRow(row))
    })
  }

  async listItems(filters: ZoteroItemListFilters): Promise<ZoteroItemListEntry[]> {
    this.assertConfigured()

    return this.withReadonlyDatabase((database) => {
      const collectionId = filters.collectionId
      const queryTokens = tokenizeItemSearchQuery(filters.query)
      const queryWhereClause =
        queryTokens.length > 0
          ? queryTokens
              .map(
                () => `
            AND (
              LOWER(COALESCE(titleValues.value, '')) LIKE ?
              OR (
                CASE
                  WHEN dateValues.value GLOB '[0-9][0-9][0-9][0-9]*' THEN SUBSTR(dateValues.value, 1, 4)
                  ELSE ''
                END
              ) LIKE ?
              OR EXISTS (
                SELECT 1
                FROM itemCreators searchItemCreators
                INNER JOIN creators searchCreators
                  ON searchCreators.creatorID = searchItemCreators.creatorID
                WHERE searchItemCreators.itemID = items.itemID
                  AND (
                    LOWER(COALESCE(searchCreators.firstName, '')) LIKE ?
                    OR LOWER(COALESCE(searchCreators.lastName, '')) LIKE ?
                    OR LOWER(TRIM(COALESCE(searchCreators.firstName, '') || ' ' || COALESCE(searchCreators.lastName, ''))) LIKE ?
                  )
              )
            )`
              )
              .join('')
          : ''
      const queryParameters = queryTokens.flatMap((token) => {
        const likeToken = `%${token}%`
        return [likeToken, likeToken, likeToken, likeToken, likeToken]
      })
      const itemRows = database
        .prepare(`
          SELECT
            items.itemID AS id,
            COALESCE(titleValues.value, '') AS title,
            CASE
              WHEN dateValues.value GLOB '[0-9][0-9][0-9][0-9]*' THEN SUBSTR(dateValues.value, 1, 4)
              ELSE NULL
            END AS year,
            EXISTS (
              SELECT 1
              FROM itemAttachments
              INNER JOIN items attachmentItems ON attachmentItems.itemID = itemAttachments.itemID
              LEFT JOIN deletedItems deletedAttachmentItems
                ON deletedAttachmentItems.itemID = attachmentItems.itemID
              WHERE itemAttachments.parentItemID = items.itemID
                AND deletedAttachmentItems.itemID IS NULL
                AND LOWER(COALESCE(itemAttachments.contentType, '')) = 'application/pdf'
            ) AS hasPdf
          FROM items
          INNER JOIN itemTypes ON itemTypes.itemTypeID = items.itemTypeID
          LEFT JOIN deletedItems ON deletedItems.itemID = items.itemID
          LEFT JOIN itemData titleItemData
            ON titleItemData.itemID = items.itemID
            AND titleItemData.fieldID = (
              SELECT fieldID
              FROM fields
              WHERE fieldName = 'title'
              LIMIT 1
            )
          LEFT JOIN itemDataValues titleValues ON titleValues.valueID = titleItemData.valueID
          LEFT JOIN itemData dateItemData
            ON dateItemData.itemID = items.itemID
            AND dateItemData.fieldID = (
              SELECT fieldID
              FROM fields
              WHERE fieldName = 'date'
              LIMIT 1
            )
          LEFT JOIN itemDataValues dateValues ON dateValues.valueID = dateItemData.valueID
          WHERE deletedItems.itemID IS NULL
            AND itemTypes.typeName NOT IN ('attachment', 'note', 'annotation')
            AND (
              ? IS NULL OR EXISTS (
                SELECT 1
                FROM collectionItems
                WHERE collectionItems.itemID = items.itemID
                  AND collectionItems.collectionID = ?
              )
            )
            ${queryWhereClause}
          ORDER BY items.dateModified DESC, items.itemID DESC
        `)
        .all(collectionId, collectionId, ...queryParameters)
        .map((row) => mapItemSummaryRow(row))

      if (itemRows.length === 0) {
        return []
      }

      const creatorRows = this.listCreatorRowsForItems(
        database,
        itemRows.map((row) => row.id)
      )

      const creatorsByItemId = groupCreatorsByItemId(creatorRows)

      return itemRows.map((row) => ({
        id: row.id,
        title: row.title,
        year: row.year,
        hasPdf: row.hasPdf,
        creatorsText: formatCreatorsText(creatorsByItemId.get(row.id) ?? [])
      }))
    })
  }

  async getItemDetail(itemId: number): Promise<ZoteroItemDetail | null> {
    this.assertConfigured()

    return this.withReadonlyDatabase((database) => {
      const itemRow = database
        .prepare(`
          SELECT
            items.itemID AS id,
            COALESCE(titleValues.value, '') AS title,
            CASE
              WHEN dateValues.value GLOB '[0-9][0-9][0-9][0-9]*' THEN SUBSTR(dateValues.value, 1, 4)
              ELSE NULL
            END AS year
          FROM items
          INNER JOIN itemTypes ON itemTypes.itemTypeID = items.itemTypeID
          LEFT JOIN deletedItems ON deletedItems.itemID = items.itemID
          LEFT JOIN itemData titleItemData
            ON titleItemData.itemID = items.itemID
            AND titleItemData.fieldID = (
              SELECT fieldID
              FROM fields
              WHERE fieldName = 'title'
              LIMIT 1
            )
          LEFT JOIN itemDataValues titleValues ON titleValues.valueID = titleItemData.valueID
          LEFT JOIN itemData dateItemData
            ON dateItemData.itemID = items.itemID
            AND dateItemData.fieldID = (
              SELECT fieldID
              FROM fields
              WHERE fieldName = 'date'
              LIMIT 1
            )
          LEFT JOIN itemDataValues dateValues ON dateValues.valueID = dateItemData.valueID
          WHERE items.itemID = ?
            AND deletedItems.itemID IS NULL
            AND itemTypes.typeName NOT IN ('attachment', 'note', 'annotation')
          LIMIT 1
        `)
        .get(itemId)

      if (!itemRow) {
        return null
      }

      const detailRow = mapItemDetailRow(itemRow)
      const creatorRows = this.listCreatorRowsForItems(database, [detailRow.id])
      const creators = groupCreatorsByItemId(creatorRows).get(detailRow.id) ?? []
      const attachments = this.listAttachmentsForItem(database, detailRow.id)

      return {
        id: detailRow.id,
        title: detailRow.title,
        year: detailRow.year,
        creators,
        creatorsText: formatCreatorsText(creators),
        attachments
      }
    })
  }

  async resolveItemDefaultPdf(itemId: number): Promise<ZoteroResolvedPdf | null> {
    this.assertConfigured()

    return this.withReadonlyDatabase((database) => {
      const attachments = this.listAttachmentsForItem(database, itemId)
      const defaultAttachment = chooseDefaultPdfAttachment(attachments)

      if (!defaultAttachment) {
        return null
      }

      return {
        itemId,
        attachmentId: defaultAttachment.id,
        title: defaultAttachment.title,
        pdfPath: defaultAttachment.path
      }
    })
  }

  private assertConfigured(): void {
    if (!this.context.dataDir) {
      throw new ZoteroServiceError(
        'data-dir-not-configured',
        'Zotero data directory is not configured.'
      )
    }

    if (!this.context.validation.isValid) {
      const issue = this.context.validation.issues[0]

      throw new ZoteroServiceError(
        issue?.code ?? 'data-dir-not-configured',
        issue?.message ?? 'Zotero data directory is invalid.'
      )
    }
  }

  private withReadonlyDatabase<T>(run: (database: DatabaseSync) => T): T {
    const databasePath = this.getValidatedDatabasePath()
    try {
      const result = this.withReadonlyDatabasePath(databasePath, run)
      this.context.databaseAccess = createDirectDatabaseAccessState()
      return result
    } catch (error) {
      if (isDatabaseLockedError(error)) {
        const result = this.withReadonlyDatabaseSnapshot(databasePath, run)
        this.context.databaseAccess = createSnapshotDatabaseAccessState()
        return result
      }

      throw error
    }
  }

  private withReadonlyDatabasePath<T>(
    databasePath: string,
    run: (database: DatabaseSync) => T
  ): T {
    let database: DatabaseSync

    try {
      database = new DatabaseSync(databasePath, {
        readOnly: true
      })
    } catch (error) {
      throw mapUnexpectedError(
        error,
        'database-open-failed',
        'Unable to open the Zotero database. Check that the selected data directory is accessible.'
      )
    }

    let result: T | undefined
    let operationError: unknown = null

    try {
      result = run(database)
    } catch (error) {
      operationError = error
    }

    try {
      database.close()
    } catch (error) {
      if (operationError === null) {
        throw mapUnexpectedError(
          error,
          'database-close-failed',
          'Unable to finish reading from the Zotero database.'
        )
      }
    }

    if (operationError !== null) {
      throw mapUnexpectedError(
        operationError,
        'database-query-failed',
        'Unable to read data from the Zotero database.'
      )
    }

    return result as T
  }

  private withReadonlyDatabaseSnapshot<T>(
    databasePath: string,
    run: (database: DatabaseSync) => T
  ): T {
    const snapshotDir = mkdtempSync(join(tmpdir(), 'aitero-zotero-'))
    const snapshotPath = join(snapshotDir, basename(databasePath))

    try {
      copySqliteSnapshot(databasePath, snapshotPath)
      return this.withReadonlyDatabasePath(snapshotPath, run)
    } finally {
      rmSync(snapshotDir, { recursive: true, force: true })
    }
  }

  private getValidatedDatabasePath(): string {
    this.assertConfigured()

    const databasePath = this.context.validation.databasePath
    if (!databasePath) {
      throw new ZoteroServiceError(
        'missing-zotero-database',
        'Zotero database path is unavailable after validation.'
      )
    }

    return databasePath
  }

  private listCreatorRowsForItems(database: DatabaseSync, itemIds: number[]): CreatorRow[] {
    const placeholders = itemIds.map(() => '?').join(', ')
    const statement = database.prepare(`
      SELECT
        itemCreators.itemID AS itemId,
        itemCreators.orderIndex AS orderIndex,
        creators.firstName AS firstName,
        creators.lastName AS lastName
      FROM itemCreators
      INNER JOIN creators ON creators.creatorID = itemCreators.creatorID
      WHERE itemCreators.itemID IN (${placeholders})
      ORDER BY itemCreators.itemID, itemCreators.orderIndex
    `)

    return statement.all(...itemIds).map((row) => mapCreatorRow(row))
  }

  private listAttachmentsForItem(database: DatabaseSync, itemId: number): ZoteroItemDetail['attachments'] {
    const storageDir = this.getValidatedStorageDir()
    const statement = database.prepare(`
      SELECT
        attachmentItems.itemID AS id,
        attachmentItems.key AS attachmentKey,
        COALESCE(titleValues.value, '') AS title,
        itemAttachments.path AS rawPath,
        itemAttachments.contentType AS contentType
      FROM itemAttachments
      INNER JOIN items attachmentItems ON attachmentItems.itemID = itemAttachments.itemID
      LEFT JOIN deletedItems deletedAttachmentItems
        ON deletedAttachmentItems.itemID = attachmentItems.itemID
      LEFT JOIN itemData titleItemData
        ON titleItemData.itemID = attachmentItems.itemID
        AND titleItemData.fieldID = (
          SELECT fieldID
          FROM fields
          WHERE fieldName = 'title'
          LIMIT 1
        )
      LEFT JOIN itemDataValues titleValues ON titleValues.valueID = titleItemData.valueID
      WHERE itemAttachments.parentItemID = ?
        AND deletedAttachmentItems.itemID IS NULL
      ORDER BY attachmentItems.itemID
    `)

    return statement.all(itemId).map((row) => mapAttachmentRow(row, storageDir))
  }

  private getValidatedStorageDir(): string {
    this.assertConfigured()

    const storageDir = this.context.validation.storageDir
    if (!storageDir) {
      throw new ZoteroServiceError(
        'missing-storage-directory',
        'Zotero storage directory is unavailable after validation.'
      )
    }

    return storageDir
  }

  private async refreshContext(dataDir: string | null): Promise<void> {
    const validation = await validateZoteroDataDir(dataDir)

    this.context = {
      dataDir: validation.normalizedDataDir,
      validation,
      databaseAccess: createDirectDatabaseAccessState()
    }
  }
}

export function createZoteroService(configStore: AppConfigStore): ZoteroService {
  return new ZoteroService(configStore)
}

export class ZoteroServiceError extends Error {
  constructor(
    readonly code: ZoteroServiceErrorCode,
    message: string,
    readonly cause?: unknown
  ) {
    super(message)
    this.name = 'ZoteroServiceError'
  }
}

interface CollectionRow {
  id: number
  name: string
  parentId: number | null
}

interface ItemSummaryRow {
  id: number
  title: string
  year: string | null
  hasPdf: boolean
}

interface ItemDetailRow {
  id: number
  title: string
  year: string | null
}

interface CreatorRow {
  itemId: number
  orderIndex: number
  firstName: string
  lastName: string
}

interface AttachmentRow {
  id: number
  attachmentKey: string
  title: string
  rawPath: string | null
  contentType: string | null
}

async function validateZoteroDataDir(dataDir: string | null): Promise<ZoteroDataDirValidation> {
  if (dataDir === null) {
    return createUnconfiguredValidation()
  }

  const normalizedDataDir = resolve(dataDir)
  const issues: ZoteroDataDirIssue[] = []

  const dataDirStats = await safeStat(normalizedDataDir)
  if (dataDirStats === null) {
    issues.push(
      createIssue(
        'data-dir-not-found',
        `Zotero data directory does not exist: ${normalizedDataDir}`,
        normalizedDataDir
      )
    )

    return {
      isValid: false,
      normalizedDataDir,
      databasePath: null,
      storageDir: null,
      issues
    }
  }

  if (!dataDirStats.isDirectory()) {
    issues.push(
      createIssue(
        'data-dir-not-directory',
        `Zotero data directory is not a directory: ${normalizedDataDir}`,
        normalizedDataDir
      )
    )

    return {
      isValid: false,
      normalizedDataDir,
      databasePath: null,
      storageDir: null,
      issues
    }
  }

  const databasePath = join(normalizedDataDir, 'zotero.sqlite')
  const storageDir = join(normalizedDataDir, 'storage')

  if (!(await pathExists(databasePath))) {
    issues.push(
      createIssue(
        'missing-zotero-database',
        `Missing Zotero database file: ${databasePath}`,
        databasePath
      )
    )
  }

  const storageStats = await safeStat(storageDir)
  if (storageStats === null) {
    issues.push(
      createIssue(
        'missing-storage-directory',
        `Missing Zotero storage directory: ${storageDir}`,
        storageDir
      )
    )
  } else if (!storageStats.isDirectory()) {
    issues.push(
      createIssue(
        'storage-path-not-directory',
        `Zotero storage path is not a directory: ${storageDir}`,
        storageDir
      )
    )
  }

  return {
    isValid: issues.length === 0,
    normalizedDataDir,
    databasePath,
    storageDir,
    issues
  }
}

async function safeStat(filePath: string): Promise<Awaited<ReturnType<typeof stat>> | null> {
  try {
    return await stat(filePath)
  } catch (error) {
    if (isMissingPathError(error)) {
      return null
    }

    throw error
  }
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.F_OK)
    return true
  } catch (error) {
    if (isMissingPathError(error)) {
      return false
    }

    throw error
  }
}

function createIssue(
  code: ZoteroDataDirIssueCode,
  message: string,
  path: string | null
): ZoteroDataDirIssue {
  return {
    code,
    message,
    path
  }
}

function createUnconfiguredValidation(): ZoteroDataDirValidation {
  return {
    isValid: false,
    normalizedDataDir: null,
    databasePath: null,
    storageDir: null,
    issues: [
      createIssue(
        'data-dir-not-configured',
        'Zotero data directory is not configured.',
        null
      )
    ]
  }
}

function createDirectDatabaseAccessState(): ZoteroLibraryContext['databaseAccess'] {
  return {
    mode: 'direct',
    notice: null
  }
}

function createSnapshotDatabaseAccessState(): ZoteroLibraryContext['databaseAccess'] {
  return {
    mode: 'snapshot',
    notice:
      'Zotero is locking the live database, so Aitero is reading from a temporary snapshot. Changes made in Zotero will not appear here until the next refresh.'
  }
}

function isMissingPathError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error && (error.code === 'ENOENT' || error.code === 'ENOTDIR')
}

function mapCollectionRow(row: Record<string, unknown>): ZoteroCollectionNode {
  const typedRow = row as Partial<CollectionRow>

  return {
    id: Number(typedRow.id),
    name: String(typedRow.name ?? ''),
    parentId: typedRow.parentId === null || typedRow.parentId === undefined ? null : Number(typedRow.parentId)
  }
}

function mapItemSummaryRow(row: Record<string, unknown>): ItemSummaryRow {
  const typedRow = row as Partial<{
    id: number
    title: string
    year: string | null
    hasPdf: number | boolean
  }>

  return {
    id: Number(typedRow.id),
    title: String(typedRow.title ?? ''),
    year: typeof typedRow.year === 'string' ? typedRow.year : null,
    hasPdf: typedRow.hasPdf === true || typedRow.hasPdf === 1
  }
}

function mapItemDetailRow(row: Record<string, unknown>): ItemDetailRow {
  const typedRow = row as Partial<ItemDetailRow>

  return {
    id: Number(typedRow.id),
    title: String(typedRow.title ?? ''),
    year: typeof typedRow.year === 'string' ? typedRow.year : null
  }
}

function mapCreatorRow(row: Record<string, unknown>): CreatorRow {
  const typedRow = row as Partial<CreatorRow>

  return {
    itemId: Number(typedRow.itemId),
    orderIndex: Number(typedRow.orderIndex ?? 0),
    firstName: String(typedRow.firstName ?? ''),
    lastName: String(typedRow.lastName ?? '')
  }
}

function mapAttachmentRow(
  row: Record<string, unknown>,
  storageDir: string
): ZoteroItemDetail['attachments'][number] {
  const typedRow = row as Partial<AttachmentRow>
  const rawPath = typeof typedRow.rawPath === 'string' ? typedRow.rawPath : null
  const resolvedPath = resolveAttachmentPath(rawPath, String(typedRow.attachmentKey ?? ''), storageDir)
  const title = String(typedRow.title ?? '').trim()

  return {
    id: Number(typedRow.id),
    title: title || inferAttachmentTitle(rawPath, resolvedPath),
    path: resolvedPath,
    contentType: typeof typedRow.contentType === 'string' ? typedRow.contentType : null
  }
}

function groupCreatorsByItemId(creatorRows: CreatorRow[]): Map<number, string[]> {
  const creatorsByItemId = new Map<number, string[]>()

  for (const creatorRow of creatorRows) {
    const displayName = formatCreatorName(creatorRow)
    if (!displayName) {
      continue
    }

    const existingCreators = creatorsByItemId.get(creatorRow.itemId)
    if (existingCreators) {
      existingCreators.push(displayName)
      continue
    }

    creatorsByItemId.set(creatorRow.itemId, [displayName])
  }

  return creatorsByItemId
}

function formatCreatorName(creator: CreatorRow): string {
  const firstName = creator.firstName.trim()
  const lastName = creator.lastName.trim()

  if (firstName && lastName) {
    return `${firstName} ${lastName}`
  }

  return firstName || lastName
}

function formatCreatorsText(creators: string[]): string {
  if (creators.length === 0) {
    return ''
  }

  if (creators.length === 1) {
    return creators[0]
  }

  if (creators.length === 2) {
    return `${creators[0]} and ${creators[1]}`
  }

  return `${creators[0]} et al.`
}

function tokenizeItemSearchQuery(query: string): string[] {
  return query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => token.length > 0)
}

function resolveAttachmentPath(
  rawPath: string | null,
  attachmentKey: string,
  storageDir: string
): string | null {
  if (!rawPath) {
    return null
  }

  if (rawPath.startsWith('storage:')) {
    const relativeFilePath = rawPath.slice('storage:'.length)
    if (!relativeFilePath || !attachmentKey) {
      return null
    }

    return join(storageDir, attachmentKey, relativeFilePath)
  }

  if (rawPath.startsWith('attachments:')) {
    return null
  }

  if (isAbsolute(rawPath)) {
    return rawPath
  }

  return null
}

function inferAttachmentTitle(rawPath: string | null, resolvedPath: string | null): string {
  if (resolvedPath) {
    return basename(resolvedPath)
  }

  if (!rawPath) {
    return ''
  }

  if (rawPath.startsWith('storage:')) {
    return rawPath.slice('storage:'.length)
  }

  if (rawPath.startsWith('attachments:')) {
    return rawPath.slice('attachments:'.length)
  }

  return basename(rawPath)
}

function chooseDefaultPdfAttachment(
  attachments: ZoteroItemDetail['attachments']
): (ZoteroItemDetail['attachments'][number] & { path: string }) | null {
  const pdfAttachments = attachments
    .filter((attachment): attachment is ZoteroItemDetail['attachments'][number] & { path: string } => {
      return (
        typeof attachment.path === 'string' &&
        attachment.path.length > 0 &&
        typeof attachment.contentType === 'string' &&
        attachment.contentType.toLowerCase() === 'application/pdf'
      )
    })
    .sort((left, right) => left.id - right.id)

  return pdfAttachments[0] ?? null
}

function mapUnexpectedError(
  error: unknown,
  code: ZoteroServiceErrorCode,
  message: string
): ZoteroServiceError {
  if (error instanceof ZoteroServiceError) {
    return error
  }

  return new ZoteroServiceError(code, message, error)
}

function isDatabaseLockedError(error: unknown): boolean {
  if (error instanceof ZoteroServiceError && error.cause) {
    return isDatabaseLockedError(error.cause)
  }

  if (!(error instanceof Error)) {
    return false
  }

  const sqliteError = error as Error & {
    code?: string
    errstr?: string
  }

  return (
    sqliteError.code === 'ERR_SQLITE_ERROR' &&
    typeof sqliteError.errstr === 'string' &&
    sqliteError.errstr.toLowerCase().includes('database is locked')
  )
}

function copySqliteSnapshot(sourceDatabasePath: string, targetDatabasePath: string): void {
  const sidecarSuffixes = ['', '-journal', '-wal', '-shm']

  for (const suffix of sidecarSuffixes) {
    const sourcePath = `${sourceDatabasePath}${suffix}`

    if (!existsSync(sourcePath)) {
      continue
    }

    copyFileSync(sourcePath, `${targetDatabasePath}${suffix}`)
  }
}
