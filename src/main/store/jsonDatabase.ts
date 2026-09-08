import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import type { AppData } from '../../shared/types'
import type { Database } from './database'
import { migrateCategoryColor } from '../../shared/palette'
import { defaultAppData, defaultCategories } from './defaults'

export const SCHEMA_VERSION = 1

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
      const parsed = JSON.parse(readFileSync(this.filePath, 'utf-8')) as AppData
      this.cache = migrate(parsed)
      return this.cache
    } catch (error) {
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
function migrate(data: AppData): AppData {
  const base = defaultAppData()
  const known = defaultCategories()
  return {
    ...base,
    ...data,
    version: SCHEMA_VERSION,
    profile: { ...base.profile, ...data.profile },
    categories: (data.categories ?? base.categories).map((c) => ({
      ...c,
      // Recognise the built-in categories by id or name so an upgrade keeps
      // rent and utilities marked as bills instead of silently demoting them.
      fixed: c.fixed ?? known.find((d) => d.id === c.id || d.name === c.name)?.fixed ?? false,
      color: migrateCategoryColor(c.color)
    })),
    goals: data.goals ?? [],
    transactions: data.transactions ?? []
  }
}
