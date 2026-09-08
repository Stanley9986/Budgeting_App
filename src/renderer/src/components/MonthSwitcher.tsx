import { addMonths, monthKeyOf, monthLabel } from '@shared/domain/dates'
import { activeMonths } from '@shared/domain/pacing'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useAppStore } from '../state/AppStore'

const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec'
]

/**
 * Moves the whole app between months; every screen reads `month` from the store.
 * The arrows step one month, and the label opens a year-at-a-glance picker.
 */
export function MonthSwitcher(): JSX.Element {
  const { month, setMonth, data } = useAppStore()
  const [open, setOpen] = useState(false)
  const [pickerYear, setPickerYear] = useState(() => Number(month.slice(0, 4)))
  const root = useRef<HTMLDivElement>(null)

  const [year, m] = month.split('-').map(Number)
  const current = new Date(year, m - 1, 1)
  const thisMonth = monthKeyOf(new Date())

  // Months that actually hold transactions get a dot, so empty months are obvious.
  const active = useMemo(() => activeMonths(data?.transactions ?? []), [data])

  // Always open on the year you're looking at, even after browsing away last time.
  useEffect(() => {
    if (open) setPickerYear(Number(month.slice(0, 4)))
  }, [open, month])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent): void => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const pick = (key: string): void => {
    setMonth(key)
    setOpen(false)
  }

  return (
    <div className="month-switcher" ref={root}>
      <button
        className="btn btn--ghost"
        onClick={() => setMonth(monthKeyOf(addMonths(current, -1)))}
        aria-label="Previous month"
      >
        ‹
      </button>

      <button
        type="button"
        className="month-switcher__label"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Jump to a month"
      >
        {monthLabel(month)}
      </button>

      <button
        className="btn btn--ghost"
        onClick={() => setMonth(monthKeyOf(addMonths(current, 1)))}
        aria-label="Next month"
      >
        ›
      </button>

      {month !== thisMonth && (
        <button className="btn btn--ghost" onClick={() => setMonth(thisMonth)}>
          Today
        </button>
      )}

      {open && (
        <div className="month-picker" role="dialog" aria-label="Jump to a month">
          <div className="month-picker__head">
            <button
              className="btn btn--ghost"
              onClick={() => setPickerYear((y) => y - 1)}
              aria-label="Previous year"
            >
              ‹
            </button>
            <strong className="tabular">{pickerYear}</strong>
            <button
              className="btn btn--ghost"
              onClick={() => setPickerYear((y) => y + 1)}
              aria-label="Next year"
            >
              ›
            </button>
          </div>

          <div className="month-picker__grid">
            {MONTH_LABELS.map((label, i) => {
              const key = `${pickerYear}-${String(i + 1).padStart(2, '0')}`
              return (
                <button
                  key={key}
                  type="button"
                  className="month-picker__month"
                  aria-pressed={key === month}
                  aria-label={`${label} ${pickerYear}`}
                  data-today={key === thisMonth ? '' : undefined}
                  onClick={() => pick(key)}
                >
                  {label}
                  {active.has(key) && <span className="month-picker__dot" aria-hidden="true" />}
                </button>
              )
            })}
          </div>

          <button className="month-picker__today" onClick={() => pick(thisMonth)}>
            Jump to {monthLabel(thisMonth)}
          </button>
        </div>
      )}
    </div>
  )
}
