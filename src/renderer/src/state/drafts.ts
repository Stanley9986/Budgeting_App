export function shallowEqual<T extends object>(a: T, b: T): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)] as (keyof T)[])
  return [...keys].every((key) => Object.is(a[key], b[key]))
}

export interface DraftState<T extends object> {
  value: T
  dirty: Partial<Record<keyof T, boolean>>
}

export function editDraft<T extends object>(state: DraftState<T>, value: T): DraftState<T> {
  const dirty = { ...state.dirty }
  for (const key of Object.keys(value) as (keyof T)[]) {
    // Remember edits even when the user returns to the old saved value while a write is pending.
    if (!Object.is(state.value[key], value[key])) dirty[key] = true
  }
  return { value, dirty }
}

/** Apply external snapshots, such as undo, only to fields with no unsaved edits. */
export function receiveSaved<T extends object>(state: DraftState<T>, saved: T): DraftState<T> {
  const value = { ...saved }
  for (const key of Object.keys(saved) as (keyof T)[]) {
    if (state.dirty[key]) value[key] = state.value[key]
  }
  return { ...state, value }
}

/** Acknowledge only submitted fields; preserve edits made while that request was pending. */
export function acknowledgeSave<T extends object>(
  state: DraftState<T>,
  submitted: Partial<T>,
  saved: T
): DraftState<T> {
  const dirty = { ...state.dirty }
  for (const key of Object.keys(submitted) as (keyof T)[]) {
    if (Object.is(state.value[key], submitted[key])) delete dirty[key]
    // An older acknowledgement may have cleared this flag while another save
    // was queued. A different current value still represents a newer edit.
    else dirty[key] = true
  }
  return receiveSaved({ ...state, dirty }, saved)
}
