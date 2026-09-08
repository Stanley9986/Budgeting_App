import { useEffect, useState } from 'react'
import { applyCategoryRules } from '@shared/domain/rules'
import { useLoadedStore } from '../state/AppStore'
import { Card, Field } from './ui'

export function RulesEditor(): JSX.Element {
  const { data, mutate, busy } = useLoadedStore()
  const [contains, setContains] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [editingId, setEditingId] = useState<string | undefined>()
  useEffect(() => {
    // Delete, undo, or restore can remove a rule while its editor is open.
    if (editingId && !data.rules.some((rule) => rule.id === editingId)) {
      setEditingId(undefined)
      setContains('')
      setCategoryId('')
    }
  }, [editingId, data.rules])
  const preview = data.transactions.filter(
    (t) =>
      t.kind === 'expense' &&
      !t.categoryId &&
      contains.trim() &&
      t.description.toLowerCase().includes(contains.trim().toLowerCase())
  )
  const matches = data.transactions.filter(
    (t) => !t.categoryId && applyCategoryRules(t, data.rules).categoryId
  )
  return (
    <Card title="Automatic categories">
      <p className="muted">
        Match words in a description when importing uncategorized expenses. Your chosen categories
        stay as they are. The longest matching phrase wins.
      </p>
      {data.rules.map((r) => (
        <div className="list-row" key={r.id}>
          <div>
            <strong>{r.contains}</strong>
            <div className="muted">
              → {data.categories.find((c) => c.id === r.categoryId)?.name}
            </div>
          </div>
          <div className="btn-row">
            <button
              className="btn btn--ghost"
              disabled={busy}
              onClick={() => {
                setEditingId(r.id)
                setContains(r.contains)
                setCategoryId(r.categoryId)
              }}
            >
              Edit
            </button>
            <button
              className="btn btn--ghost btn--danger"
              disabled={busy}
              onClick={() => void mutate(() => window.budget.deleteRule(r.id))}
            >
              Delete
            </button>
          </div>
        </div>
      ))}
      <form
        style={{ marginTop: 16 }}
        onSubmit={async (e) => {
          e.preventDefault()
          if (busy) return
          if (
            await mutate(() => window.budget.upsertRule({ id: editingId, contains, categoryId }))
          ) {
            setContains('')
            setCategoryId('')
            setEditingId(undefined)
          }
        }}
      >
        <div className="form-grid">
          <Field label="Description contains">
            <input
              required
              disabled={busy}
              value={contains}
              onChange={(e) => setContains(e.target.value)}
              placeholder="e.g. Trader Joe"
            />
          </Field>
          <Field label="Assign category">
            <select
              required
              disabled={busy}
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">Choose category</option>
              {data.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="btn-row" style={{ marginTop: 12 }}>
          <button className="btn" disabled={busy || !contains.trim() || !categoryId}>
            {editingId ? 'Save rule' : 'Add rule'}
          </button>
          {editingId && (
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => {
                setEditingId(undefined)
                setContains('')
                setCategoryId('')
              }}
            >
              Cancel edit
            </button>
          )}
          {contains.trim() && (
            <span className="muted">
              Matches {preview.length} uncategorized expense{preview.length === 1 ? '' : 's'}
            </span>
          )}
        </div>
      </form>
      {matches.length > 0 && (
        <button
          className="btn"
          style={{ marginTop: 16 }}
          disabled={busy}
          onClick={() => {
            if (
              confirm(
                `Apply saved rules to ${matches.length} uncategorized expenses across all months?`
              )
            )
              void mutate(() =>
                window.budget.bulkTransactions(
                  matches.map((t) => t.id),
                  { applyRules: true }
                )
              )
          }}
        >
          Apply rules to {matches.length} existing expenses…
        </button>
      )}
    </Card>
  )
}
