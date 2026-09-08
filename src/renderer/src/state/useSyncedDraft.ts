import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { acknowledgeSave, editDraft, receiveSaved, shallowEqual, type DraftState } from './drafts'

type DraftActions<T extends object> = {
  acknowledge: (submitted: Partial<T>, saved: T) => void
  reset: (saved: T) => void
}

/** Flat form fields keep unsaved edits, and accept undo/restore changes after acknowledgement. */
export function useSyncedDraft<T extends object>(
  saved: T
): [T, Dispatch<SetStateAction<T>>, DraftActions<T>] {
  const [state, setState] = useState<DraftState<T>>(() => ({ value: saved, dirty: {} }))
  const previousSaved = useRef(saved)
  useEffect(() => {
    // Callers may construct a new flat object each render. Only a changed snapshot
    // should reconcile it; a local edit or acknowledgement must not reapply old data.
    if (shallowEqual(previousSaved.current, saved)) return
    previousSaved.current = saved
    setState((previous) => receiveSaved(previous, saved))
  }, [saved])

  const setDraft = useCallback<Dispatch<SetStateAction<T>>>((update) => {
    setState((previous) =>
      editDraft(previous, typeof update === 'function' ? update(previous.value) : update)
    )
  }, [])
  const acknowledge = useCallback((submitted: Partial<T>, next: T) => {
    setState((previous) => acknowledgeSave(previous, submitted, next))
  }, [])
  const reset = useCallback((next: T) => setState({ value: next, dirty: {} }), [])
  return [state.value, setDraft, { acknowledge, reset }]
}
