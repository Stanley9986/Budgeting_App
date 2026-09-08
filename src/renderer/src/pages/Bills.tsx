import { useState } from 'react'
import type { NewBill } from '@shared/types'
import { billsForMonth, type BillOccurrence } from '@shared/domain/bills'
import { toISODate } from '@shared/domain/dates'
import { formatMoney } from '@shared/domain/money'
import { useLoadedStore } from '../state/AppStore'
import { Card, EmptyState, Field, Modal, Stat } from '../components/ui'
import { MonthSwitcher } from '../components/MonthSwitcher'

export function Bills(): JSX.Element {
  const { data, month, mutate, busy } = useLoadedStore()
  const [editing, setEditing] = useState<NewBill | null>(null)
  const [recording, setRecording] = useState<BillOccurrence | null>(null)
  const rows = billsForMonth(data, month)
  const today = toISODate(new Date())
  const unpaid = rows.filter((r) => !r.transaction)
  const money = (n: number): string => formatMoney(n, data.profile.currency)
  const fixed = data.categories.filter((c) => c.fixed)
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Bills</h1>
          <p>See what is due, then record or link the payment.</p>
        </div>
        <div className="btn-row">
          <MonthSwitcher />
          <button
            className="btn btn--primary"
            onClick={() =>
              setEditing({
                name: '',
                amount: 0,
                categoryId: fixed[0]?.id ?? '',
                frequency: 'monthly',
                startDate: `${month}-01`
              })
            }
          >
            Add bill
          </button>
        </div>
      </div>
      <div className="grid grid--3" style={{ marginBottom: 16 }}>
        <Stat
          label="Scheduled this month"
          value={money(rows.reduce((s, r) => s + r.bill.amount, 0))}
        />
        <Stat
          label="Still to record"
          value={money(unpaid.reduce((s, r) => s + r.bill.amount, 0))}
        />
        <Stat
          label="Past due, unrecorded"
          value={String(unpaid.filter((r) => r.dueDate < today).length)}
          sub="Link a payment if you already paid"
        />
      </div>
      <p className="muted">
        Bills reserve money in their fixed category on the dashboard. Adding a schedule does not
        create an expense. Payment status comes from linked transactions.
      </p>
      <Card title="This month">
        {rows.length ? (
          rows.map((r) => (
            <div className="list-row" key={r.bill.id}>
              <div>
                <strong>{r.bill.name}</strong>
                <div className="muted">
                  {r.dueDate} · {data.categories.find((c) => c.id === r.bill.categoryId)?.name}
                </div>
              </div>
              <div className="btn-row">
                <strong className="tabular">{money(r.bill.amount)}</strong>
                <span
                  className={`pill ${r.transaction ? 'text-green' : r.dueDate < today ? 'text-red' : ''}`}
                >
                  {r.transaction
                    ? 'Recorded'
                    : r.dueDate < today
                      ? 'Past due · unrecorded'
                      : r.dueDate === today
                        ? 'Due today'
                        : 'Upcoming'}
                </span>
                {!r.transaction && (
                  <button className="btn" disabled={busy} onClick={() => setRecording(r)}>
                    Record / link…
                  </button>
                )}
              </div>
            </div>
          ))
        ) : (
          <EmptyState title="No bills scheduled this month">
            Add monthly or yearly bills to see their due dates.
          </EmptyState>
        )}
      </Card>
      <div style={{ marginTop: 16 }}>
        <Card title="All schedules">
          {data.bills.length ? (
            data.bills.map((b) => (
              <div className="list-row" key={b.id}>
                <div>
                  <strong>{b.name}</strong>
                  <div className="muted">
                    {money(b.amount)} · {b.frequency} · from {b.startDate}
                  </div>
                </div>
                <div className="btn-row">
                  <button className="btn btn--ghost" onClick={() => setEditing(b)}>
                    Edit
                  </button>
                  <button
                    className="btn btn--ghost btn--danger"
                    disabled={busy}
                    onClick={() => {
                      if (
                        confirm(
                          `Remove ${b.name} from your schedules? Recorded expenses will stay.`
                        )
                      )
                        void mutate(() => window.budget.deleteBill(b.id))
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p className="muted">Your schedules will appear here.</p>
          )}
        </Card>
      </div>
      {editing && <BillEditor initial={editing} onClose={() => setEditing(null)} />}
      {recording && <RecordBill occurrence={recording} onClose={() => setRecording(null)} />}
    </>
  )
}

function BillEditor({ initial, onClose }: { initial: NewBill; onClose: () => void }): JSX.Element {
  const { data, mutate, busy } = useLoadedStore()
  const [draft, setDraft] = useState(initial)
  return (
    <Modal title={initial.id ? 'Edit bill schedule' : 'Add bill schedule'} onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          if (await mutate(() => window.budget.upsertBill(draft))) onClose()
        }}
      >
        <div className="form-grid">
          <Field label="Bill name">
            <input
              required
              autoFocus
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </Field>
          <Field label="Amount">
            <input
              required
              type="number"
              min="0.01"
              step="0.01"
              value={draft.amount || ''}
              onChange={(e) => setDraft({ ...draft, amount: Number(e.target.value) })}
            />
          </Field>
          <Field label="First due date">
            <input
              required
              type="date"
              value={draft.startDate}
              onChange={(e) => setDraft({ ...draft, startDate: e.target.value })}
            />
          </Field>
          <Field label="Repeat">
            <select
              value={draft.frequency}
              onChange={(e) =>
                setDraft({ ...draft, frequency: e.target.value as NewBill['frequency'] })
              }
            >
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </Field>
          <Field
            label="Fixed category"
            hint="Mark a category as recurring in Settings to use it here."
          >
            <select
              required
              value={draft.categoryId}
              onChange={(e) => setDraft({ ...draft, categoryId: e.target.value })}
            >
              <option value="">Choose category</option>
              {data.categories
                .filter((c) => c.fixed)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </Field>
        </div>
        <p className="muted">
          Dates on the 29th–31st use the last available day in shorter months. Schedule edits apply
          from the first due date; existing payments stay recorded.
        </p>
        <div className="modal__actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn--primary"
            disabled={busy || !draft.name.trim() || !draft.categoryId}
          >
            Save bill
          </button>
        </div>
      </form>
    </Modal>
  )
}

function RecordBill({
  occurrence: r,
  onClose
}: {
  occurrence: BillOccurrence
  onClose: () => void
}): JSX.Element {
  const { data, mutate, busy } = useLoadedStore()
  const [transactionId, setTransactionId] = useState('')
  const existing = data.transactions.filter(
    (t) => t.kind === 'expense' && !t.billId && t.date.startsWith(r.dueDate.slice(0, 7))
  )
  const future = r.dueDate > toISODate(new Date())
  return (
    <Modal title={`Record ${r.bill.name}`} onClose={onClose}>
      <p className="muted">
        If this payment is already in your transactions, link it to avoid counting it twice. The
        linked expense will use this bill’s category.
      </p>
      <Field label="Payment">
        <select value={transactionId} onChange={(e) => setTransactionId(e.target.value)}>
          <option value="">
            Create expense for {formatMoney(r.bill.amount, data.profile.currency)} on {r.dueDate}
          </option>
          {existing.map((t) => (
            <option key={t.id} value={t.id}>
              {t.date} · {t.description} · {formatMoney(t.amount, data.profile.currency)}
            </option>
          ))}
        </select>
      </Field>
      {future && !transactionId && (
        <p className="muted">
          This bill is in the future. You can link an existing payment now, or record a new expense
          on its due date.
        </p>
      )}
      <div className="modal__actions">
        <button className="btn" onClick={onClose}>
          Cancel
        </button>
        <button
          className="btn btn--primary"
          disabled={busy || (future && !transactionId)}
          onClick={async () => {
            if (
              await mutate(() =>
                window.budget.recordBill(r.bill.id, r.dueDate, transactionId || undefined)
              )
            )
              onClose()
          }}
        >
          {transactionId ? 'Link payment' : 'Record expense'}
        </button>
      </div>
    </Modal>
  )
}
