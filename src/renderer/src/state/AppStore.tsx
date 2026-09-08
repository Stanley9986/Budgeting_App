import { computeMonthPace, type MonthPace } from '@shared/domain/pacing'
import { monthKeyOf } from '@shared/domain/dates'
import type { AppData } from '@shared/types'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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
  mutate: (fn: () => Promise<AppData>) => Promise<void>
  refresh: () => Promise<void>
}

const AppStoreContext = createContext<AppStoreValue | null>(null)

export function AppStoreProvider({ children }: { children: ReactNode }): JSX.Element {
  const [data, setData] = useState<AppData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [month, setMonth] = useState(() => monthKeyOf(new Date()))

  const refresh = useCallback(async () => {
    try {
      setData(await window.budget.getData())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const mutate = useCallback(async (fn: () => Promise<AppData>) => {
    try {
      setData(await fn())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  const pace = useMemo(() => (data ? computeMonthPace(data, month) : null), [data, month])

  const value = useMemo(
    () => ({ data, ready: data !== null, error, month, setMonth, pace, mutate, refresh }),
    [data, error, month, pace, mutate, refresh]
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
