import { monthLabel } from '@shared/domain/dates'
import { allGoalProgress } from '@shared/domain/goals'
import { formatMoney, formatPct } from '@shared/domain/money'
import { STATUS_COPY } from '@shared/domain/pacing'
import type { Route } from '../App'
import { MonthSwitcher } from '../components/MonthSwitcher'
import { Bar, Card, EmptyState, Stat, STATUS_COLOR } from '../components/ui'
import { useAppStore } from '../state/AppStore'

export function Dashboard({ onNavigate }: { onNavigate: (r: Route) => void }): JSX.Element {
  const { data, pace, month, mutate } = useAppStore()
  if (!data || !pace) return <div />

  const currency = data.profile.currency
  const money = (n: number): string => formatMoney(n, currency)
  const copy = STATUS_COPY[pace.status]
  const goals = allGoalProgress(data.goals)
  const hasAnything = data.transactions.length > 0 || data.profile.annualSalary > 0

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Hi{data.profile.name ? `, ${data.profile.name}` : ''} 👋</h1>
          <p>Here is how {monthLabel(month)} is going.</p>
        </div>
        <MonthSwitcher />
      </div>

      {!hasAnything && (
        <div style={{ marginBottom: 18 }}>
          <Card>
            <EmptyState
              title="Nothing to show yet"
              action={
                <div className="btn-row" style={{ justifyContent: 'center' }}>
                  <button className="btn btn--primary" onClick={() => onNavigate('settings')}>
                    Set up my income
                  </button>
                  <button className="btn" onClick={() => void mutate(() => window.budget.loadDemoData())}>
                    Load demo data
                  </button>
                </div>
              }
            >
              Add your income and a few transactions, or load a month of sample data to see how the
              app works.
            </EmptyState>
          </Card>
        </div>
      )}

      <div className={`status-banner status-banner--${pace.status}`} style={{ marginBottom: 18 }}>
        <span className={`status-banner__dot dot-${pace.status}`} />
        <div>
          <h2>{copy.label}</h2>
          <p>{copy.blurb}</p>
        </div>
        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
          <div className="stat__label">Projected savings</div>
          <div className="tabular" style={{ fontSize: 20, fontWeight: 640, marginTop: 4 }}>
            {money(pace.projectedSavings)}
          </div>
          <div className="faint" style={{ fontSize: 12 }}>
            goals need {money(pace.requiredSavings)}/mo
          </div>
        </div>
      </div>

      <div className="grid grid--3" style={{ marginBottom: 16 }}>
        <Stat
          label="Spent so far"
          value={money(pace.spent)}
          sub={
            pace.budgetTotal > 0
              ? `${formatPct(pace.spent / pace.budgetTotal)} of a ${money(pace.budgetTotal)} plan · pace says ${money(pace.expectedByNow)} by now`
              : 'No category budgets set yet'
          }
        />
        <Stat
          label="Projected month-end"
          value={money(pace.projectedSpend)}
          tone={pace.budgetTotal > 0 && pace.projectedSpend > pace.budgetTotal ? 'yellow' : undefined}
          sub={
            pace.budgetTotal > 0
              ? pace.projectedSpend > pace.budgetTotal
                ? `${money(pace.projectedSpend - pace.budgetTotal)} over plan`
                : `${money(pace.budgetTotal - pace.projectedSpend)} under plan`
              : 'Based on your daily rate this month'
          }
        />
        <Stat
          label="Savings gap"
          value={`${pace.savingsGap >= 0 ? '+' : ''}${money(pace.savingsGap)}`}
          tone={pace.savingsGap >= 0 ? 'green' : 'red'}
          sub={
            pace.savingsGap >= 0
              ? 'Ahead of what your goals need this month'
              : 'Short of what your goals need this month'
          }
        />
      </div>

      <div className="grid grid--2">
        <Card title="Where the money went">
          {data.categories.length === 0 ? (
            <EmptyState title="No categories yet">Add some in Settings to track spending.</EmptyState>
          ) : (
            <div>
              {[...pace.categories]
                .sort((a, b) => b.spent - a.spent)
                .map((c) => (
                  <div className="cat-row" key={c.category.id}>
                    <div className="cat-row__name">
                      <span className="swatch" style={{ background: c.category.color }} />
                      {c.category.name}
                      {c.category.fixed ? (
                        <span className="faint" style={{ fontSize: 11 }}>
                          {c.spent <= 0
                            ? `· bill not paid yet`
                            : c.status === 'red'
                              ? `· over by ${money(c.spent - c.category.monthlyLimit)}`
                              : '· paid'}
                        </span>
                      ) : (
                        c.status !== 'green' && (
                          <span className={`faint text-${c.status}`} style={{ fontSize: 11 }}>
                            · pacing to {money(c.projected)}
                          </span>
                        )
                      )}
                    </div>
                    <div className="cat-row__amount">
                      {money(c.spent)}{' '}
                      <span className="faint">/ {money(c.category.monthlyLimit)}</span>
                    </div>
                    <div className="cat-row__bar">
                      <Bar ratio={c.ratio} color={STATUS_COLOR[c.status]} />
                    </div>
                  </div>
                ))}
              {pace.uncategorizedSpend > 0 && (
                <div className="cat-row">
                  <div className="cat-row__name faint">Uncategorized</div>
                  <div className="cat-row__amount">{money(pace.uncategorizedSpend)}</div>
                </div>
              )}
            </div>
          )}
        </Card>

        <Card
          title="Goals"
          actions={
            <button className="btn btn--ghost" onClick={() => onNavigate('goals')}>
              Manage
            </button>
          }
        >
          {goals.length === 0 ? (
            <EmptyState title="No goals yet">
              A goal of the year and a long-term goal are what turn the colours on.
            </EmptyState>
          ) : (
            goals.map((g) => (
              <div key={g.goal.id} style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <strong>{g.goal.name}</strong>
                  <span className="muted tabular">
                    {money(g.goal.savedAmount)} / {money(g.goal.targetAmount)}
                  </span>
                </div>
                <Bar ratio={g.progress} color={g.overdue ? 'var(--red)' : 'var(--accent)'} />
                <div className="faint" style={{ fontSize: 12, marginTop: 5 }}>
                  {g.funded
                    ? 'Funded 🎉'
                    : `${money(g.requiredMonthly)}/mo for ${g.monthsLeft} more month${g.monthsLeft === 1 ? '' : 's'}`}
                </div>
              </div>
            ))
          )}
        </Card>
      </div>
    </>
  )
}
