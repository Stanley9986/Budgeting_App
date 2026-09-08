import { randomUUID } from 'crypto'
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import type { AppData } from '../../shared/types'
import type { Database } from './database'
import { migrateCategoryColor } from '../../shared/palette'
import { defaultAppData, defaultCategories } from './defaults'
import { validateData } from './validation'

export const SCHEMA_VERSION = 2

class NewerBudgetVersionError extends Error {}

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
    if (this.cache) return structuredClone(this.cache)
    let content: string
    try {
      content = readFileSync(this.filePath, 'utf-8')
    } catch (error) {
      // Permissions and device errors are not corruption. In particular, never
      // replace an existing budget merely because this process cannot read it.
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      this.save(defaultAppData())
      return this.load()
    }
    try {
      this.cache = parseBudgetFile(content)
      return structuredClone(this.cache)
    } catch (error) {
      if (error instanceof NewerBudgetVersionError) throw error
      // Recovery is allowed only after the original is safely preserved. If
      // archiving fails, propagate the error and leave the original untouched.
      const recoveryPath = `${this.filePath}.corrupt-${Date.now()}-${randomUUID()}`
      renameSync(this.filePath, recoveryPath)
      console.error(`[db] invalid budget preserved at ${recoveryPath}:`, error)
      this.save(defaultAppData())
      return this.load()
    }
  }

  save(data: AppData): void {
    validateData(data)
    mkdirSync(dirname(this.filePath), { recursive: true })
    // Take ownership before I/O so a caller cannot mutate the cache by keeping
    // a reference to an object that was passed to save().
    const snapshot = structuredClone(data)
    const tmp = `${this.filePath}.${randomUUID()}.tmp`
    try {
      writeFileSync(tmp, JSON.stringify(snapshot, null, 2), {
        encoding: 'utf-8',
        mode: 0o600,
        flag: 'wx',
        flush: true
      })
      renameSync(tmp, this.filePath)
      this.cache = snapshot
    } finally {
      // A failed write never changes the cache or leaves a partial replacement.
      try {
        rmSync(tmp, { force: true })
      } catch (error) {
        // Cleanup must not turn a successful rename into an apparent failed save.
        console.error('[db] could not remove temporary file:', error)
      }
    }
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
    throw new NewerBudgetVersionError('This budget needs a newer version of the app.')
  if (
    !data.profile ||
    typeof data.profile !== 'object' ||
    Array.isArray(data.profile) ||
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
      ...(data.version === 1 ? base.profile : {}),
      ...data.profile,
      incomeBasis: data.profile.incomeBasis === undefined
        ? 'estimate-plus-extra'
        : data.profile.incomeBasis
    },
    categories: (data.categories ?? base.categories).map((c) => ({
      ...c,
      // Recognise the built-in categories by id or name so an upgrade keeps
      // rent and utilities marked as bills instead of silently demoting them.
      fixed: c.fixed === undefined && data.version === 1
        ? known.find((d) => d.id === c.id || d.name === c.name)?.fixed ?? false
        : c.fixed,
      color: migrateCategoryColor(c.color)
    })),
    goals: data.goals ?? [],
    transactions: data.transactions ?? [],
    rules: data.rules ?? [],
    bills: data.bills ?? [],
    importPresets: data.importPresets ?? []
  })
}
