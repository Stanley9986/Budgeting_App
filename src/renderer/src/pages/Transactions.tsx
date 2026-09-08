import { fromISODate, monthKey, toISODate } from '@shared/domain/dates'
import { formatMoney } from '@shared/domain/money'
import type { NewTransaction, Transaction } from '@shared/types'
import { useMemo, useState } from 'react'
import { ImportDialog } from '../components/ImportDialog'
import { MonthSwitcher } from '../components/MonthSwitcher'
import { Card, EmptyState, Field, Modal } from '../components/ui'
import { useAppStore } from '../state/AppStore'

const BLANK = (): NewTransaction => ({
  date: toISODate(new Date()),
  description: '',
  amount: 0,
  kind: 'expense',
  categoryId: null
})

export function Transactions(): JSX.Element {
  const { data, month, mutate } = useAppStore()
  const [editing, setEditing] = useState<Transaction | NewTransaction | null>(null)
  const [importing, setImporting] = useState(false)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [showAllMonths, setShowAllMonths] = useState(false)

  const rows = useMemo(() => {
    if (!data) return []
    return data.transactions
      .filter((t) => showAllMonths || monthKey(t.date) === month)
      .filter((t) =>
        categoryFilter === 'all'
          ? true
          : categoryFilter === 'none'
            ? t.categoryId === null
            : t.categoryId === categoryFilter
      )
      .filter((t) => t.description.toLowerCase().includes(search.trim().toLowerCase()))
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
  }, [data, month, showAllMonths, categoryFilter, search])

  if (!data) return <div />
  const money = (n: number): string => formatMoney(n, data.profile.currency)
  const nameOf = (id: string | null): string =>
    data.categories.find((c) => c.id === id)?.name ?? 'Uncategorized'

  const total = rows.reduce((s, t) => s + (t.kind === 'expense' ? t.amount : -t.amount), 0)

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Transactions</h1>
          <p>
            {rows.length} shown · net {money(total)}
          </p>
        </div>
        <div className="btn-row">
          <MonthSwitcher />
          <button className="btn" onClick={() => setImporting(true)}>
            Import CSV
          </button>
          <button className="btn btn--primary" onClick={() => setEditing(BLANK())}>
            Add transaction
          </button>
        </div>
      </div>

      <div className="toolbar">
        <input
          placeholder="Search descriptions…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          <option value="all">All categories</option>
          {data.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
          <option value="none">Uncategorized</option>
        </select>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={showAllMonths}
            onChange={(e) => setShowAllMonths(e.target.checked)}
          />
          Show every month
        </label>
      </div>

      <Card>
        {rows.length === 0 ? (
          <EmptyState
            title="No transactions here"
            action={
              <button className="btn btn--primary" onClick={() => setEditing(BLANK())}>
                Add your first one
              </button>
            }
          >
            Log an expense by hand, or import a CSV your bank exported.
          </EmptyState>
        ) : (
          <table>
            <thead>
              <tr>
                <th style={{ width: 110 }}>Date</th>
                <th>Description</th>
                <th style={{ width: 170 }}>Category</th>
                <th className="num" style={{ width: 120 }}>
                  Amount
                </th>
                <th style={{ width: 90 }} />
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id}>
                  <td className="muted tabular">
                    {fromISODate(t.date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric'
                    })}
                  </td>
                  <td>
                    {t.description}
                    {t.source === 'csv' && (
                      <span className="pill" style={{ marginLeft: 8 }}>
                        CSV
                      </span>
                    )}
                  </td>
                  <td className="muted">{nameOf(t.categoryId)}</td>
                  <td className={`num ${t.kind === 'income' ? 'text-green' : ''}`}>
                    {t.kind === 'income' ? '+' : '−'}
                    {money(t.amount)}
                  </td>
                  <td>
                    <div className="row-actions">
                      <button className="btn btn--ghost" onClick={() => setEditing(t)}>
                        Edit
                      </button>
                      <button
                        className="btn btn--ghost btn--danger"
                        onClick={() => void mutate(() => window.budget.deleteTransaction(t.id))}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {editing && <TransactionDialog initial={editing} onClose={() => setEditing(null)} />}
      {importing && <ImportDialog onClose={() => setImporting(false)} />}
    </>
  )
}

function TransactionDialog({
  initial,
  onClose
}: {
  initial: Transaction | NewTransaction
  onClose: () => void
}): JSX.Element {
  const { data, mutate } = useAppStore()
  const [draft, setDraft] = useState(initial)
  const isEdit = 'id' in initial && Boolean(initial.id)
  const amountText = draft.amount === 0 ? '' : String(draft.amount)

  const submit = async (): Promise<void> => {
    await mutate(() =>
      isEdit
        ? window.budget.updateTransaction(draft as Transaction)
        : window.budget.addTransaction(draft)
    )
    onClose()
  }

  return (
    <Modal title={isEdit ? 'Edit transaction' : 'Add transaction'} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <div className="form-grid">
          <Field label="Description">
            <input
              autoFocus
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              placeholder="Groceries"
            />
          </Field>
          <Field label="Amount">
            <input
              type="number"
              step="0.01"
              min="0"
              value={amountText}
              onChange={(e) => setDraft({ ...draft, amount: Number(e.target.value) })}
              placeholder="0.00"
            />
          </Field>
          <Field label="Date">
            <input
              type="date"
              value={draft.date}
              onChange={(e) => setDraft({ ...draft, date: e.target.value })}
            />
          </Field>
          <Field label="Type">
            <select
              value={draft.kind}
              onChange={(e) =>
                setDraft({ ...draft, kind: e.target.value as NewTransaction['kind'] })
              }
            >
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
          </Field>
          <Field label="Category">
            <select
              value={draft.categoryId ?? ''}
              onChange={(e) => setDraft({ ...draft, categoryId: e.target.value || null })}
            >
              <option value="">Uncategorized</option>
              {data?.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="modal__actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={!draft.description || draft.amount <= 0}>
            {isEdit ? 'Save changes' : 'Add transaction'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
