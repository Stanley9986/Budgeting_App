import type { AppData } from '../../shared/types'

/**
 * The only contract the rest of the app has with storage. The MVP ships a
 * JSON-file implementation; swapping in SQLite (or a remote API once the
 * mobile client exists) means writing one new class, not touching feature code.
 */
export interface Database {
  load(): AppData
  save(data: AppData): void
}
