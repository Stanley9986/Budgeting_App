import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import type { AppData } from '../../shared/types'
import type { Database } from './database'
import { migrateCategoryColor } from '../../shared/palette'
import { defaultAppData, defaultCategories } from './defaults'
import { validateData } from './validation'

export const SCHEMA_VERSION = 2

/**
 * Stores everything in one JSON document inside Electron's userData directory.
 * Writes go to a temp file and are renamed into place, so a crash mid-write
 * can't leave a half-written budget on disk.
 */
export class JsonDatabase implements Database {
  private cache: AppData | null = null

  constructor(private readonly filePath: string) {}

  static in(directory: string): JsonDatabase {
    return new JsonDatabase(join(directory, 'budget-data.json'))
  }

  get path(): string {
    return this.filePath
  }

  load(): AppData {
    if (this.cache) return this.cache
    if (!existsSync(this.filePath)) {
      this.cache = defaultAppData()
      this.save(this.cache)
      return this.cache
    }
    try {
      this.cache = parseBudgetFile(readFileSync(this.filePath, 'utf-8'))
      return this.cache
    } catch (error) {
      if (error instanceof Error && error.message.includes('newer version')) throw error
      // A corrupt file should not brick the app: keep a copy and start clean.
      console.error('[db] could not read data file, starting fresh:', error)
      try {
        renameSync(this.filePath, `${this.filePath}.corrupt-${Date.now()}`)
      } catch {
        /* best effort */
      }
      this.cache = defaultAppData()
      this.save(this.cache)
      return this.cache
    }
  }

  save(data: AppData): void {
    validateData(data)
    mkdirSync(dirname(this.filePath), { recursive: true })
    const tmp = `${this.filePath}.tmp`
    writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8')
    renameSync(tmp, this.filePath)
    this.cache = data
  }
}

/**
 * Fills in fields added after a file was written, so upgrading the app never
 * discards an existing budget. `fixed` arrived with the recurring-bill work and
 * is absent from every file written before it.
 */
export function parseBudgetFile(content: string): AppData {
  const data = JSON.parse(content) as AppData
  if (!data || typeof data !== 'object' || !Number.isInteger(data.version) || data.version < 1) {
    throw new Error('This is not a Budgeting App backup.')
  }
  if (data.version > SCHEMA_VERSION)
    throw new Error('This budget needs a newer version of the app.')
  if (
    !data.profile ||
    !Array.isArray(data.categories) ||
    !Array.isArray(data.goals) ||
    !Array.isArray(data.transactions)
  ) {
    throw new Error('The budget file is missing required data.')
  }
  if (
    data.version === 2 &&
    (!Array.isArray(data.rules) || !Array.isArray(data.bills) || !Array.isArray(data.importPresets))
  ) {
    throw new Error('The budget file is missing rules, bills or import presets.')
  }
  const base = defaultAppData()
  const known = defaultCategories()
  return validateData({
    ...base,
    ...data,
    version: SCHEMA_VERSION,
    profile: {
      ...base.profile,
      ...data.profile,
      incomeBasis: data.profile.incomeBasis ?? 'estimate-plus-extra'
    },
    categories: (data.categories ?? base.categories).map((c) => ({
      ...c,
      // Recognise the built-in categories by id or name so an upgrade keeps
      // rent and utilities marked as bills instead of silently demoting them.
      fixed: c.fixed ?? known.find((d) => d.id === c.id || d.name === c.name)?.fixed ?? false,
      color: migrateCategoryColor(c.color)
    })),
    goals: data.goals ?? [],
    transactions: data.transactions ?? [],
    rules: data.rules ?? [],
    bills: data.bills ?? [],
    importPresets: data.importPresets ?? []
  })
}
