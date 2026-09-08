import { fromISODate, monthKey, toISODate } from '@shared/domain/dates'
import { formatMoney } from '@shared/domain/money'
import type { NewTransaction, Transaction } from '@shared/types'
import { useEffect, useMemo, useState } from 'react'
import { ImportDialog } from '../components/ImportDialog'
import { MonthSwitcher } from '../components/MonthSwitcher'
import { Card, EmptyState, Field, Modal } from '../components/ui'
import { useAppStore } from '../state/AppStore'

const BLANK = (month: string): NewTransaction => ({
  date: toISODate(new Date()).startsWith(month) ? toISODate(new Date()) : `${month}-01`,
  description: '',
  amount: 0,
  kind: 'expense',
  categoryId: null
})

export function Transactions(): JSX.Element {
  const { data, month, mutate, busy, reportError } = useAppStore()
  const [editing, setEditing] = useState<Transaction | NewTransaction | null>(null)
  const [importing, setImporting] = useState(false)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [showAllMonths, setShowAllMonths] = useState(false)
  const [kindFilter, setKindFilter] = useState('all')
  const [reviewFilter, setReviewFilter] = useState(false)
  const [sort, setSort] = useState('date')
  const [selection, setSelection] = useState<Set<string>>(new Set())
  const [page, setPage] = useState(0)
  const [exporting, setExporting] = useState(false)
  const [exported, setExported] = useState(false)
  const [bulkCategory, setBulkCategory] = useState('')
  useEffect(() => {
    setSelection(new Set())
    setPage(0)
  }, [month, showAllMonths, categoryFilter, search, kindFilter, reviewFilter, sort])

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
      .filter((t) => kindFilter === 'all' || t.kind === kindFilter)
      .filter((t) => !reviewFilter || t.reviewed === false)
      .sort(
        (a, b) =>
          (sort === 'amount'
            ? b.amount - a.amount
            : sort === 'description'
              ? a.description.localeCompare(b.description)
              : b.date.localeCompare(a.date)) || b.createdAt.localeCompare(a.createdAt)
      )
  }, [data, month, showAllMonths, categoryFilter, search, kindFilter, reviewFilter, sort])

  if (!data) return <div />
  const money = (n: number): string => formatMoney(n, data.profile.currency)
  const nameOf = (id: string | null): string =>
    data.categories.find((c) => c.id === id)?.name ?? 'Uncategorized'

  const income = rows.filter((t) => t.kind === 'income').reduce((s, t) => s + t.amount, 0)
  const expense = rows.filter((t) => t.kind === 'expense').reduce((s, t) => s + t.amount, 0)
  const currentPage = Math.min(page, Math.max(0, Math.ceil(rows.length / 100) - 1))
  const visible = rows.slice(currentPage * 100, (currentPage + 1) * 100)
  const selected = visible.filter((t) => selection.has(t.id)).map((t) => t.id)
  const hasFilters = Boolean(
    search || categoryFilter !== 'all' || kindFilter !== 'all' || reviewFilter
  )
  const clearFilters = (): void => {
    setSearch('')
    setCategoryFilter('all')
    setKindFilter('all')
    setReviewFilter(false)
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Transactions</h1>
          <p>
            {rows.length} matched · income {money(income)} · expenses {money(expense)}
          </p>
        </div>
        <div className="btn-row">
          <MonthSwitcher />
          <button className="btn" onClick={() => setImporting(true)}>
            Import CSV
          </button>
          <button
            className="btn"
            disabled={!rows.length || exporting}
            onClick={async () => {
              setExporting(true)
              setExported(false)
              try {
                setExported(await window.budget.exportCsv(rows.map((t) => t.id)))
              } catch (e) {
                reportError(e)
              } finally {
                setExporting(false)
              }
            }}
          >
            {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
          <button className="btn btn--primary" onClick={() => setEditing(BLANK(month))}>
            Add transaction
          </button>
        </div>
      </div>

      <div className="toolbar">
        <input
          placeholder="Search descriptions…"
          aria-label="Search descriptions"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          aria-label="Filter category"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="all">All categories</option>
          {data.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
          <option value="none">Uncategorized</option>
        </select>
        <select
          aria-label="Filter transaction type"
          value={kindFilter}
          onChange={(e) => setKindFilter(e.target.value)}
        >
          <option value="all">Income & expenses</option>
          <option value="expense">Expenses</option>
          <option value="income">Income</option>
        </select>
        <select
          aria-label="Sort transactions"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="date">Newest first</option>
          <option value="amount">Largest first</option>
          <option value="description">Description A–Z</option>
        </select>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={reviewFilter}
            onChange={(e) => setReviewFilter(e.target.checked)}
          />
          Needs review
        </label>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={showAllMonths}
            onChange={(e) => setShowAllMonths(e.target.checked)}
          />
          Show every month
        </label>
        {hasFilters && (
          <button className="btn btn--ghost" onClick={clearFilters}>
            Clear filters
          </button>
        )}
      </div>
      {exported && (
        <p className="text-green" role="status">
          CSV exported with all matching transactions.
        </p>
      )}
      {selected.length > 0 && (
        <div className="toolbar bulk-toolbar">
          <strong>{selected.length} selected</strong>
          <select
            aria-label="Bulk category"
            value={bulkCategory}
            onChange={(e) => setBulkCategory(e.target.value)}
          >
            <option value="">Choose category</option>
            <option value="none">Uncategorized</option>
            {data.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            className="btn"
            disabled={busy || !bulkCategory}
            onClick={() =>
              void mutate(() =>
                window.budget.bulkTransactions(selected, {
                  categoryId: bulkCategory === 'none' ? null : bulkCategory
                })
              )
            }
          >
            Categorize
          </button>
          <button
            className="btn"
            disabled={busy}
            onClick={() =>
              void mutate(() => window.budget.bulkTransactions(selected, { reviewed: true }))
            }
          >
            Mark reviewed
          </button>
          <button
            className="btn btn--danger"
            disabled={busy}
            onClick={() => {
              if (
                confirm(
                  `Delete ${selected.length} selected transactions? You can undo this during this session.`
                )
              )
                void mutate(() => window.budget.bulkTransactions(selected, { delete: true }))
            }}
          >
            Delete selected…
          </button>
          <button className="btn btn--ghost" onClick={() => setSelection(new Set())}>
            Clear selection
          </button>
        </div>
      )}

      <Card>
        {rows.length === 0 ? (
          <EmptyState
            title={hasFilters ? 'No matching transactions' : 'No transactions here'}
            action={
              <button
                className="btn btn--primary"
                onClick={() => (hasFilters ? clearFilters() : setImporting(true))}
              >
                {hasFilters ? 'Clear filters' : 'Import a statement'}
              </button>
            }
          >
            Log an expense by hand, or import a CSV your bank exported.
          </EmptyState>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      aria-label="Select this page"
                      checked={visible.length > 0 && selected.length === visible.length}
                      onChange={(e) =>
                        setSelection(new Set(e.target.checked ? visible.map((t) => t.id) : []))
                      }
                    />
                  </th>
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
                {visible.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`Select ${t.description} on ${t.date}`}
                        checked={selection.has(t.id)}
                        onChange={(e) =>
                          setSelection((prev) => {
                            const next = new Set(prev)
                            if (e.target.checked) next.add(t.id)
                            else next.delete(t.id)
                            return next
                          })
                        }
                      />
                    </td>
                    <td className="muted tabular">
                      {fromISODate(t.date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: showAllMonths ? 'numeric' : undefined
                      })}
                    </td>
                    <td>
                      {t.description}
                      {t.reviewed === false && (
                        <span className="pill" style={{ marginLeft: 8 }}>
                          Needs review
                        </span>
                      )}
                      {t.billId && (
                        <span className="pill" style={{ marginLeft: 8 }}>
                          Bill
                        </span>
                      )}
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
          </div>
        )}
      </Card>
      {rows.length > 100 && (
        <div className="toolbar" style={{ marginTop: 16 }}>
          <button
            className="btn"
            disabled={currentPage === 0}
            onClick={() => {
              setPage(currentPage - 1)
              setSelection(new Set())
            }}
          >
            Previous
          </button>
          <span>
            Page {currentPage + 1} of {Math.ceil(rows.length / 100)}
          </span>
          <button
            className="btn"
            disabled={(currentPage + 1) * 100 >= rows.length}
            onClick={() => {
              setPage(currentPage + 1)
              setSelection(new Set())
            }}
          >
            Next
          </button>
        </div>
      )}

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
  const { data, mutate, busy } = useAppStore()
  const [draft, setDraft] = useState(initial)
  const isEdit = 'id' in initial && Boolean(initial.id)
  const amountText = draft.amount === 0 ? '' : String(draft.amount)

  const submit = async (): Promise<void> => {
    const saved = await mutate(() =>
      isEdit
        ? window.budget.updateTransaction(draft as Transaction)
        : window.budget.addTransaction(draft)
    )
    if (saved) onClose()
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
              required
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
          <button
            type="submit"
            className="btn btn--primary"
            disabled={busy || !draft.description.trim() || draft.amount <= 0 || !draft.date}
          >
            {isEdit ? 'Save changes' : 'Add transaction'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
