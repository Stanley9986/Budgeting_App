import type { PaceStatus } from '@shared/domain/pacing'
import { useEffect, type ReactNode } from 'react'

export function Card({
  title,
  children,
  actions,
  className = ''
}: {
  title?: string
  children: ReactNode
  actions?: ReactNode
  className?: string
}): JSX.Element {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {title && <h2 className="card__title">{title}</h2>}
          {actions}
        </header>
      )}
      {children}
    </section>
  )
}

export function Stat({
  label,
  value,
  sub,
  tone
}: {
  label: string
  value: string
  sub?: ReactNode
  tone?: PaceStatus
}): JSX.Element {
  return (
    <div className="card">
      <div className="stat__label">{label}</div>
      <div className={`stat__value ${tone ? `text-${tone}` : ''}`}>{value}</div>
      {sub && <div className="stat__sub">{sub}</div>}
    </div>
  )
}

/** A simple spent-of-limit progress bar. */
export function Bar({ ratio, color }: { ratio: number; color: string }): JSX.Element {
  const width = Math.min(100, Math.max(0, ratio * 100))
  return (
    <div className="bar">
      <div className="bar__fill" style={{ width: `${width}%`, background: color }} />
    </div>
  )
}

export const STATUS_COLOR: Record<PaceStatus, string> = {
  green: 'var(--green)',
  yellow: 'var(--yellow)',
  red: 'var(--red)'
}

export function StatusPill({ status, children }: { status: PaceStatus; children: ReactNode }): JSX.Element {
  return (
    <span className="pill">
      <span className={`swatch dot-${status}`} style={{ borderRadius: '50%' }} />
      {children}
    </span>
  )
}

export function Field({
  label,
  hint,
  children
}: {
  label: string
  hint?: string
  children: ReactNode
}): JSX.Element {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <span className="field__hint">{hint}</span>}
    </label>
  )
}

export function Modal({
  title,
  onClose,
  children,
  wide = false
}: {
  title: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
}): JSX.Element {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="modal"
        style={wide ? { width: 'min(720px, 100%)' } : undefined}
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  )
}

export function EmptyState({
  title,
  children,
  action
}: {
  title: string
  children?: ReactNode
  action?: ReactNode
}): JSX.Element {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action && <div style={{ marginTop: 14 }}>{action}</div>}
    </div>
  )
}
