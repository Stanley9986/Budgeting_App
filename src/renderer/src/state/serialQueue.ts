/**
 * Persist user actions in order. A rejected write must not poison later writes,
 * and callers must resolve their record from the latest snapshot when they run.
 */
export class SerialQueue {
  private tail: Promise<void> = Promise.resolve()

  run<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.tail.then(operation)
    this.tail = result.then(
      () => undefined,
      () => undefined
    )
    return result
  }
}
