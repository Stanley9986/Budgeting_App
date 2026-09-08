import type { AppData } from '../../shared/types'

/**
 * The only contract the rest of the app has with storage. The MVP ships a
 * JSON-file implementation; swapping in SQLite (or a remote API once the
 * mobile client exists) means writing one new class, not touching feature code.
 */
export interface Database {
  /** Return a detached snapshot; callers must not be able to mutate persisted state. */
  load(): AppData
  /** Persist atomically and retain no mutable references to the caller's data. */
  save(data: AppData): void
}
