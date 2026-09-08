import { computeMonthPace, type MonthPace } from '@shared/domain/pacing'
import { monthKeyOf } from '@shared/domain/dates'
import type { AppData } from '@shared/types'
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
  mutate: (fn: () => Promise<AppData>) => Promise<boolean>
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
  const inFlight = useRef(false)
  const [canUndo, setCanUndo] = useState(false)
  const dismissError = useCallback(() => setError(null), [])
  const reportError = useCallback(
    (e: unknown) => setError(e instanceof Error ? e.message : String(e)),
    []
  )

  const refresh = useCallback(async () => {
    try {
      setData(await window.budget.getData())
      setCanUndo(await window.budget.canUndo())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const mutate = useCallback(async (fn: () => Promise<AppData>) => {
    if (inFlight.current) return false
    inFlight.current = true
    setBusy(true)
    try {
      setData(await fn())
      setCanUndo(await window.budget.canUndo())
      setError(null)
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      return false
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }, [])

  const pace = useMemo(() => (data ? computeMonthPace(data, month) : null), [data, month])

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
