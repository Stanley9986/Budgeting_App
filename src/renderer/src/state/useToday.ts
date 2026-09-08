import { toISODate } from '@shared/domain/dates'
import { useEffect, useState } from 'react'

/** Refresh calendar-dependent projections after midnight or waking a sleeping laptop. */
export function useToday(): string {
  const [today, setToday] = useState(() => toISODate(new Date()))
  useEffect(() => {
    const update = (): void => setToday(toISODate(new Date()))
    const timer = setInterval(update, 60_000)
    window.addEventListener('focus', update)
    document.addEventListener('visibilitychange', update)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', update)
      document.removeEventListener('visibilitychange', update)
    }
  }, [])
  return today
}
