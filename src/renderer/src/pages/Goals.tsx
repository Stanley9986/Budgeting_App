import { toISODate } from '@shared/domain/dates'
import { allGoalProgress } from '@shared/domain/goals'
import { formatMoney, formatPct } from '@shared/domain/money'
import type { Goal, NewGoal } from '@shared/types'
import { useState } from 'react'
import { Bar, Card, EmptyState, Field, Modal } from '../components/ui'
import { useAppStore } from '../state/AppStore'

const BLANK = (horizon: NewGoal['horizon']): NewGoal => {
  const date = new Date()
  date.setFullYear(date.getFullYear() + (horizon === 'year' ? 0 : 4))
  if (horizon === 'year') date.setMonth(11, 31)
  return { name: '', horizon, targetAmount: 0, savedAmount: 0, targetDate: toISODate(date) }
}

export function Goals(): JSX.Element {
  const { data, pace, mutate } = useAppStore()
  const [editing, setEditing] = useState<Goal | NewGoal | null>(null)
  if (!data || !pace) return <div />

  const money = (n: number): string => formatMoney(n, data.profile.currency)
  const progress = allGoalProgress(data.goals)
  const yearGoals = progress.filter((g) => g.goal.horizon === 'year')
  const longTerm = progress.filter((g) => g.goal.horizon === 'long-term')

  const section = (
    title: string,
    items: typeof progress,
    horizon: NewGoal['horizon']
  ): JSX.Element => (
    <Card
      title={title}
      actions={
        <button className="btn btn--ghost" onClick={() => setEditing(BLANK(horizon))}>
          + Add
        </button>
      }
    >
      {items.length === 0 ? (
        <EmptyState title="Nothing here yet">
          {horizon === 'year'
            ? 'Something you want by December — a car, a trip, an emergency fund.'
            : 'The big one — a house, grad school, a sabbatical.'}
        </EmptyState>
      ) : (
        items.map((g) => (
          <div className="goal-card" key={g.goal.id} style={{ marginBottom: 22 }}>
            <div className="goal-card__head">
              <div>
                <h3 className="goal-card__name">{g.goal.name}</h3>
                <div className="faint" style={{ fontSize: 12, marginTop: 3 }}>
                  due{' '}
                  {new Date(g.goal.targetDate).toLocaleDateString('en-US', {
                    month: 'long',
                    year: 'numeric'
                  })}
                  {g.overdue && <span className="text-red"> · past due</span>}
                </div>
              </div>
              <div className="btn-row">
                <button className="btn btn--ghost" onClick={() => setEditing(g.goal)}>
                  Edit
                </button>
                <button
                  className="btn btn--ghost btn--danger"
                  onClick={() => void mutate(() => window.budget.deleteGoal(g.goal.id))}
                >
                  Delete
                </button>
              </div>
            </div>

            <Bar
              ratio={g.progress}
              color={g.funded ? 'var(--green)' : g.overdue ? 'var(--red)' : 'var(--accent)'}
            />

            <div className="goal-card__meta">
              <div>
                <span className="stat__label">Saved</span>
                <span className="tabular">
                  {money(g.goal.savedAmount)} of {money(g.goal.targetAmount)} (
                  {formatPct(g.progress)})
                </span>
              </div>
              <div>
                <span className="stat__label">Still needed</span>
                <span className="tabular">{money(g.remaining)}</span>
              </div>
              <div>
                <span className="stat__label">Per month</span>
                <span className="tabular">
                  {money(g.requiredMonthly)} × {g.monthsLeft} month{g.monthsLeft === 1 ? '' : 's'}
                </span>
              </div>
            </div>
          </div>
        ))
      )}
    </Card>
  )

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Goals</h1>
          <p>
            Together your goals need{' '}
            <strong className="tabular">{money(pace.requiredSavings)}</strong> set aside every
            month. This month you are pacing to save{' '}
            <strong className={`tabular text-${pace.savingsGap >= 0 ? 'green' : 'red'}`}>
              {money(pace.projectedSavings)}
            </strong>
            .
          </p>
        </div>
      </div>

      <div className="grid" style={{ gap: 16 }}>
        {section('Goal of the year', yearGoals, 'year')}
        {section('Long term', longTerm, 'long-term')}
      </div>

      {editing && <GoalDialog initial={editing} onClose={() => setEditing(null)} />}
    </>
  )
}

function GoalDialog({
  initial,
  onClose
}: {
  initial: Goal | NewGoal
  onClose: () => void
}): JSX.Element {
  const { mutate } = useAppStore()
  const [draft, setDraft] = useState(initial)
  const isEdit = 'id' in initial && Boolean(initial.id)

  return (
    <Modal title={isEdit ? 'Edit goal' : 'New goal'} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void mutate(() => window.budget.upsertGoal(draft)).then((saved) => {
            if (saved) onClose()
          })
        }}
      >
        <div className="form-grid">
          <Field label="What is it?">
            <input
              autoFocus
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="Car fund"
            />
          </Field>
          <Field label="Horizon">
            <select
              value={draft.horizon}
              onChange={(e) =>
                setDraft({ ...draft, horizon: e.target.value as NewGoal['horizon'] })
              }
            >
              <option value="year">Goal of the year</option>
              <option value="long-term">Long term</option>
            </select>
          </Field>
          <Field label="Target amount">
            <input
              type="number"
              min="0"
              step="100"
              value={draft.targetAmount || ''}
              onChange={(e) => setDraft({ ...draft, targetAmount: Number(e.target.value) })}
            />
          </Field>
          <Field label="Saved so far">
            <input
              type="number"
              min="0"
              step="100"
              value={draft.savedAmount || ''}
              onChange={(e) => setDraft({ ...draft, savedAmount: Number(e.target.value) })}
            />
          </Field>
          <Field
            label="Target date"
            hint="What is left gets spread evenly over the months until then."
          >
            <input
              type="date"
              value={draft.targetDate}
              onChange={(e) => setDraft({ ...draft, targetDate: e.target.value })}
            />
          </Field>
        </div>
        <div className="modal__actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn--primary"
            disabled={!draft.name || draft.targetAmount <= 0}
          >
            {isEdit ? 'Save goal' : 'Add goal'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
