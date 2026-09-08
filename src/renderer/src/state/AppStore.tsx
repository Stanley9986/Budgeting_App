import { computeMonthPace, type MonthPace } from '@shared/domain/pacing'
import { fromISODate, monthKeyOf } from '@shared/domain/dates'
import type { AppData } from '@shared/types'
import { SerialQueue } from './serialQueue'
import { useToday } from './useToday'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react'

interface AppStoreValue {
  data: AppData | null
  ready: boolean
  error: string | null
  /** yyyy-mm currently being viewed. */
  month: string
  setMonth: (key: string) => void
  pace: MonthPace | null
  /** Runs an API call and folds the returned snapshot back into state. */
  mutate: (fn: (current: AppData) => Promise<AppData>) => Promise<boolean>
  refresh: () => Promise<void>
  busy: boolean
  canUndo: boolean
  dismissError: () => void
  reportError: (error: unknown) => void
}

const AppStoreContext = createContext<AppStoreValue | null>(null)

export function AppStoreProvider({ children }: { children: ReactNode }): JSX.Element {
  const [data, setData] = useState<AppData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [month, setMonth] = useState(() => monthKeyOf(new Date()))
  const [busy, setBusy] = useState(false)
  const queue = useRef(new SerialQueue()).current
  const pending = useRef(0)
  const currentData = useRef<AppData | null>(null)
  const [canUndo, setCanUndo] = useState(false)
  const dismissError = useCallback(() => setError(null), [])
  const reportError = useCallback(
    (e: unknown) => setError(e instanceof Error ? e.message : String(e)),
    []
  )

  const applySnapshot = useCallback((snapshot: AppData) => {
    currentData.current = snapshot
    setData(snapshot)
  }, [])

  const refreshUndo = useCallback(async () => {
    try {
      setCanUndo(await window.budget.canUndo())
    } catch {
      setCanUndo(false)
      // The data write has already succeeded; never invite a duplicate retry of it.
      setError(
        'Your budget is saved, but undo availability could not be refreshed. Reload the app to retry.'
      )
    }
  }, [])

  const refresh = useCallback(
    () =>
      queue.run(async () => {
        try {
          applySnapshot(await window.budget.getData())
          setError(null)
          await refreshUndo()
        } catch (e) {
          reportError(e)
        }
      }),
    [queue, applySnapshot, refreshUndo, reportError]
  )

  useEffect(() => {
    void refresh()
  }, [refresh])

  const mutate = useCallback(
    async (fn: (current: AppData) => Promise<AppData>) => {
      pending.current += 1
      setBusy(true)
      return queue.run(async () => {
        try {
          if (!currentData.current) throw new Error('Wait for your budget to finish loading.')
          applySnapshot(await fn(currentData.current))
          setError(null)
          await refreshUndo()
          return true
        } catch (e) {
          reportError(e)
          return false
        } finally {
          pending.current -= 1
          setBusy(pending.current > 0)
        }
      })
    },
    [queue, applySnapshot, refreshUndo, reportError]
  )

  const today = useToday()
  const pace = useMemo(
    () => (data ? computeMonthPace(data, month, fromISODate(today)) : null),
    [data, month, today]
  )

  const value = useMemo(
    () => ({
      data,
      ready: data !== null,
      error,
      month,
      setMonth,
      pace,
      mutate,
      refresh,
      busy,
      canUndo,
      dismissError,
      reportError
    }),
    [data, error, month, pace, mutate, refresh, busy, canUndo, dismissError, reportError]
  )

  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>
}

export function useAppStore(): AppStoreValue {
  const ctx = useContext(AppStoreContext)
  if (!ctx) throw new Error('useAppStore must be used inside <AppStoreProvider>')
  return ctx
}

/** Convenience hook for screens that only render once data exists. */
export function useLoadedStore(): AppStoreValue & { data: AppData; pace: MonthPace } {
  const store = useAppStore()
  if (!store.data || !store.pace) throw new Error('Data is not loaded yet')
  return store as AppStoreValue & { data: AppData; pace: MonthPace }
}
