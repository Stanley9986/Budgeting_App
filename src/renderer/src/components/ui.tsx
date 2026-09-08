import type { PaceStatus } from '@shared/domain/pacing'
import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  type ReactElement,
  type ReactNode
} from 'react'

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

export function StatusPill({
  status,
  children
}: {
  status: PaceStatus
  children: ReactNode
}): JSX.Element {
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
  const generatedId = useId()
  const isControl =
    isValidElement(children) && ['input', 'select', 'textarea'].includes(String(children.type))
  const control = children as ReactElement<{ id?: string; 'aria-describedby'?: string }>
  const id = isControl ? (control.props.id ?? generatedId) : generatedId
  return (
    <div
      className="field"
      role={isControl ? undefined : 'group'}
      aria-labelledby={isControl ? undefined : `${id}-label`}
    >
      {isControl ? <label htmlFor={id}>{label}</label> : <span id={`${id}-label`}>{label}</span>}
      {isControl
        ? cloneElement(control, {
            id,
            'aria-describedby': hint ? `${id}-hint` : control.props['aria-describedby']
          })
        : children}
      {hint && (
        <span id={`${id}-hint`} className="field__hint">
          {hint}
        </span>
      )}
    </div>
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
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const dialog = dialogRef.current
    const controls = (): HTMLElement[] =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, [tabindex="0"]'
        ) ?? []
      ).filter((element) => element.getClientRects().length > 0)
    if (!dialog?.contains(document.activeElement)) (controls()[0] ?? dialog)?.focus()
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault()
        closeRef.current()
      }
      if (e.key === 'Tab') {
        const items = controls()
        const first = items[0]
        const last = items[items.length - 1]
        if (!first) {
          e.preventDefault()
          dialog?.focus()
        } else if (
          e.shiftKey &&
          (document.activeElement === first || !dialog?.contains(document.activeElement))
        ) {
          e.preventDefault()
          last.focus()
        } else if (
          !e.shiftKey &&
          (document.activeElement === last || !dialog?.contains(document.activeElement))
        ) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      if (previous?.isConnected) previous.focus()
    }
  }, [])

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="modal"
        ref={dialogRef}
        tabIndex={-1}
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
