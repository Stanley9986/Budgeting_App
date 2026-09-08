import { monthLabel } from '@shared/domain/dates'
import { allGoalProgress } from '@shared/domain/goals'
import { formatMoney, formatPct } from '@shared/domain/money'
import { STATUS_COPY } from '@shared/domain/pacing'
import { billsForMonth } from '@shared/domain/bills'
import type { Route } from '../App'
import { MonthSwitcher } from '../components/MonthSwitcher'
import { Bar, Card, EmptyState, Stat, STATUS_COLOR } from '../components/ui'
import { useAppStore } from '../state/AppStore'

export function Dashboard({ onNavigate }: { onNavigate: (r: Route) => void }): JSX.Element {
  const { data, pace, month, mutate } = useAppStore()
  if (!data || !pace) return <div />

  const currency = data.profile.currency
  const money = (n: number): string => formatMoney(n, currency)
  const copy =
    pace.period === 'past'
      ? {
          label: 'Month in review',
          blurb: 'Recorded spending, compared with your current budget and goal settings.'
        }
      : pace.period === 'future'
        ? {
            label: 'Planning ahead',
            blurb:
              'Known expenses and fixed commitments. A daily spending forecast starts when the month begins.'
          }
        : STATUS_COPY[pace.status]
  const goals = allGoalProgress(data.goals)
  const hasAnything =
    data.transactions.length > 0 ||
    data.profile.annualSalary > 0 ||
    data.profile.hourlyRate > 0 ||
    data.goals.length > 0 ||
    data.bills.length > 0
  const upcoming = billsForMonth(data, month).filter((r) => !r.transaction)

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Hi{data.profile.name ? `, ${data.profile.name}` : ''} 👋</h1>
          <p>
            {monthLabel(month)} ·{' '}
            {pace.period === 'past'
              ? 'monthly review'
              : pace.period === 'future'
                ? 'upcoming month'
                : 'month so far'}
          </p>
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
                  <button
                    className="btn"
                    onClick={() => void mutate(() => window.budget.loadDemoData())}
                  >
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
          <div className="stat__label">
            {pace.period === 'current' ? 'Projected savings' : 'Estimated savings'}
          </div>
          <div className="tabular" style={{ fontSize: 20, fontWeight: 640, marginTop: 4 }}>
            {money(pace.projectedSavings)}
          </div>
          <div className="faint" style={{ fontSize: 12 }}>
            current goals need {money(pace.requiredSavings)}/mo
          </div>
        </div>
      </div>

      <div className="grid grid--3" style={{ marginBottom: 16 }}>
        <Stat
          label={pace.period === 'current' ? 'Spent so far' : 'Recorded expenses'}
          value={money(pace.spent)}
          sub={
            pace.budgetTotal > 0
              ? `${formatPct(pace.spent / pace.budgetTotal)} of a ${money(pace.budgetTotal)} plan${pace.period === 'current' ? ` · pace says ${money(pace.expectedByNow)} by now` : ''}`
              : 'No category budgets set yet'
          }
        />
        <Stat
          label={
            pace.period === 'past'
              ? 'Month-end spending'
              : pace.period === 'future'
                ? 'Known commitments'
                : 'Projected month-end'
          }
          value={money(pace.projectedSpend)}
          tone={
            pace.budgetTotal > 0 && pace.projectedSpend > pace.budgetTotal ? 'yellow' : undefined
          }
          sub={
            pace.budgetTotal > 0
              ? pace.projectedSpend > pace.budgetTotal
                ? `${money(pace.projectedSpend - pace.budgetTotal)} over plan`
                : `${money(pace.budgetTotal - pace.projectedSpend)} under plan`
              : pace.period === 'current'
                ? 'Based on your daily rate this month'
                : 'Based on recorded expenses and known commitments'
          }
        />
        <Stat
          label="Savings gap"
          value={`${pace.savingsGap >= 0 ? '+' : ''}${money(pace.savingsGap)}`}
          tone={pace.savingsGap >= 0 ? 'green' : 'red'}
          sub={
            pace.savingsGap >= 0
              ? 'Above what your current goals need per month'
              : 'Below what your current goals need per month'
          }
        />
      </div>

      <div className="grid grid--2">
        <Card title="Where the money went">
          {data.categories.length === 0 ? (
            <EmptyState title="No categories yet">
              Add some in Settings to track spending.
            </EmptyState>
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
                            ? `· no expense recorded`
                            : c.status === 'red'
                              ? `· over by ${money(c.spent - c.category.monthlyLimit)}`
                              : '· expense recorded'}
                        </span>
                      ) : (
                        c.status !== 'green' && (
                          <span className={`faint text-${c.status}`} style={{ fontSize: 11 }}>
                            · {pace.period === 'current' ? 'pacing to' : 'recorded'}{' '}
                            {money(c.projected)}
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
      {upcoming.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <Card
            title="Bills still to record"
            actions={
              <button className="btn btn--ghost" onClick={() => onNavigate('bills')}>
                Manage bills
              </button>
            }
          >
            {upcoming.slice(0, 4).map((r) => (
              <div className="list-row" key={r.bill.id}>
                <div>
                  <strong>{r.bill.name}</strong>
                  <div className="muted">Due {r.dueDate}</div>
                </div>
                <strong className="tabular">{money(r.bill.amount)}</strong>
              </div>
            ))}
            <p className="muted">
              {pace.period === 'past'
                ? 'Unrecorded bills do not change historical spending totals.'
                : 'Reserved in the month-end projection.'}{' '}
              Link payments already in your transactions to keep this accurate.
            </p>
          </Card>
        </div>
      )}
      <p className="faint" style={{ fontSize: 12, marginTop: 18 }}>
        Savings use{' '}
        {data.profile.incomeBasis === 'recorded'
          ? 'recorded income'
          : data.profile.incomeBasis === 'estimate'
            ? 'your income estimate'
            : 'your income estimate plus income entries'}
        . Budget limits, income settings and goal balances reflect your current setup.
      </p>
    </>
  )
}
