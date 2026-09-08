import { useRef, useState } from 'react'
import type { Category } from '@shared/types'
import { formatMoney, round2 } from '@shared/domain/money'
import { useLoadedStore } from '../state/AppStore'
import { useSyncedDraft } from '../state/useSyncedDraft'

/** Each row owns its text draft, while every persisted patch uses the latest store record. */
function CategoryRow({
  category,
  currency
}: {
  category: Category
  currency: string
}): JSX.Element {
  const { mutate, busy, reportError } = useLoadedStore()
  const pendingSaves = useRef(0)
  const [draft, setDraft, categoryDraft] = useSyncedDraft({
    name: category.name,
    limit: String(category.monthlyLimit)
  })
  const save = async (patch: Partial<Category>): Promise<boolean> => {
    pendingSaves.current += 1
    try {
      return await mutate(async (current) => {
        const latest = current.categories.find((c) => c.id === category.id)
        if (!latest)
          throw new Error('This category was removed. Refresh your budget and try again.')
        const next = await window.budget.upsertCategory({ ...latest, ...patch })
        const saved = next.categories.find((c) => c.id === category.id)!
        categoryDraft.acknowledge(
          {
            ...(patch.name === undefined ? {} : { name: patch.name }),
            ...(patch.monthlyLimit === undefined ? {} : { limit: String(patch.monthlyLimit) })
          },
          { name: saved.name, limit: String(saved.monthlyLimit) }
        )
        return next
      })
    } finally {
      pendingSaves.current -= 1
    }
  }
  return (
    <tr>
      <td>
        <input
          aria-label={`Category name: ${category.name}`}
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          onBlur={() => {
            const name = draft.name.trim()
            if (!name) {
              reportError('Category names cannot be empty.')
              return
            }
            setDraft((current) => ({ ...current, name }))
            // Reverting an in-flight edit is still a new intent, even if it matches the old snapshot.
            if (name !== category.name || pendingSaves.current > 0) void save({ name })
            else
              categoryDraft.acknowledge(
                { name },
                { name: category.name, limit: String(category.monthlyLimit) }
              )
          }}
        />
      </td>
      <td>
        <input
          aria-label={`Monthly limit: ${category.name}`}
          type="number"
          min="0"
          step="0.01"
          value={draft.limit}
          onChange={(e) => setDraft({ ...draft, limit: e.target.value })}
          onBlur={() => {
            const monthlyLimit = round2(Number(draft.limit))
            if (!Number.isFinite(monthlyLimit) || monthlyLimit < 0) {
              reportError('Enter a monthly limit of zero or more.')
              return
            }
            setDraft((current) => ({ ...current, limit: String(monthlyLimit) }))
            if (monthlyLimit !== category.monthlyLimit || pendingSaves.current > 0)
              void save({ monthlyLimit })
            else
              categoryDraft.acknowledge(
                { limit: String(monthlyLimit) },
                { name: category.name, limit: String(category.monthlyLimit) }
              )
          }}
        />
      </td>
      <td>
        <label className="checkbox-row">
          <input
            aria-label={`Recurring category: ${category.name}`}
            type="checkbox"
            checked={category.fixed}
            disabled={busy}
            onChange={(e) => void save({ fixed: e.target.checked })}
          />
          {category.fixed ? 'Fixed' : 'Variable'}
        </label>
      </td>
      <td>
        <div className="row-actions">
          <button
            className="btn btn--ghost btn--danger"
            disabled={busy}
            title={`Delete ${category.name} (${formatMoney(category.monthlyLimit, currency)})`}
            onClick={() => void mutate(() => window.budget.deleteCategory(category.id))}
          >
            Delete
          </button>
        </div>
      </td>
    </tr>
  )
}

export function CategoryEditor({
  categories,
  currency
}: {
  categories: Category[]
  currency: string
}): JSX.Element {
  const { mutate, busy } = useLoadedStore()
  const [newName, setNewName] = useState('')
  return (
    <>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Category</th>
              <th style={{ width: 170 }}>Monthly limit</th>
              <th
                style={{ width: 120 }}
                title="Fixed costs are reserved in full, rather than projected at a daily rate."
              >
                Recurring bill
              </th>
              <th style={{ width: 80 }} />
            </tr>
          </thead>
          <tbody>
            {categories.map((category) => (
              <CategoryRow key={category.id} category={category} currency={currency} />
            ))}
          </tbody>
        </table>
      </div>
      <form
        className="btn-row"
        style={{ marginTop: 14 }}
        onSubmit={async (e) => {
          e.preventDefault()
          const name = newName.trim()
          if (!name || busy) return
          if (
            await mutate(() =>
              window.budget.upsertCategory({ name, monthlyLimit: 0, color: '', fixed: false })
            )
          ) {
            // Don't clear newer typing if the previous name took a while to save.
            setNewName((current) => (current.trim() === name ? '' : current))
          }
        }}
      >
        <input
          aria-label="New category name"
          style={{ maxWidth: 260 }}
          placeholder="New category name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <button type="submit" className="btn" disabled={busy || !newName.trim()}>
          Add category
        </button>
      </form>
    </>
  )
}
