import { useState } from 'react'
import { monthlyReport } from '@shared/domain/reports'
import { monthLabel, monthKeyOf } from '@shared/domain/dates'
import { formatMoney } from '@shared/domain/money'
import { useLoadedStore } from '../state/AppStore'
import { Card, EmptyState, Stat } from '../components/ui'
import { MonthSwitcher } from '../components/MonthSwitcher'

export function Reports(): JSX.Element {
  const { data, month } = useLoadedStore()
  const [count, setCount] = useState(6)
  const rows = monthlyReport(data.transactions, month, count)
  const money = (n: number): string => formatMoney(n, data.profile.currency)
  const income = rows.reduce((s, r) => s + r.income, 0)
  const expense = rows.reduce((s, r) => s + r.expense, 0)
  const max = Math.max(1, ...rows.flatMap((r) => [r.income, r.expense]))
  const period = data.transactions.filter(
    (t) => t.date.slice(0, 7) >= rows[0].month && t.date.slice(0, 7) <= month
  )
  const categories = [
    ...data.categories.map((c) => ({ id: c.id as string | null, name: c.name })),
    { id: null, name: 'Uncategorized' }
  ]
    .map((c) => ({
      ...c,
      total: period
        .filter((t) => t.kind === 'expense' && t.categoryId === c.id)
        .reduce((s, t) => s + t.amount, 0)
    }))
    .filter((c) => c.total > 0)
    .sort((a, b) => b.total - a.total)
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Reports</h1>
          <p>
            Recorded activity from {monthLabel(rows[0].month)} to {monthLabel(month)}.
          </p>
        </div>
        <MonthSwitcher />
      </div>
      <div className="toolbar">
        <label className="checkbox-row">
          Period{' '}
          <select
            aria-label="Report period"
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
          >
            <option value={6}>6 months</option>
            <option value={12}>12 months</option>
          </select>
        </label>
      </div>
      <p className="muted">
        These totals use transactions you have recorded, including any future-dated entries. Your
        salary estimate and unrecorded bills are excluded. A month with no entries has no recorded
        activity.
      </p>
      <div className="grid grid--3" style={{ marginBottom: 16 }}>
        <Stat label="Recorded income" value={money(income)} />
        <Stat label="Recorded expenses" value={money(expense)} />
        <Stat
          label="Net recorded cash flow"
          value={money(income - expense)}
          sub="Income minus expenses"
        />
      </div>
      <Card title="Monthly cash flow">
        <div className="report-legend">
          <span>
            <i style={{ background: 'var(--green)' }} />
            Income
          </span>
          <span>
            <i style={{ background: 'var(--accent)' }} />
            Expenses
          </span>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Month</th>
                <th>Activity</th>
                <th className="num">Income</th>
                <th className="num">Expenses</th>
                <th className="num">Net</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.month}>
                  <td>
                    {monthLabel(r.month)}
                    {r.month === monthKeyOf(new Date()) && (
                      <div className="muted">Month in progress</div>
                    )}
                    {r.count === 0 && <div className="muted">No entries</div>}
                  </td>
                  <td style={{ minWidth: 100 }}>
                    <div className="report-bars" aria-hidden="true">
                      <div
                        style={{ width: `${(r.income / max) * 100}%`, background: 'var(--green)' }}
                      />
                      <div
                        style={{
                          width: `${(r.expense / max) * 100}%`,
                          background: 'var(--accent)'
                        }}
                      />
                    </div>
                  </td>
                  <td className="num">{money(r.income)}</td>
                  <td className="num">{money(r.expense)}</td>
                  <td className="num">{money(r.net)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <div style={{ marginTop: 16 }}>
        <Card title="Spending by category">
          {categories.length ? (
            categories.map((c) => (
              <div className="list-row" key={c.id ?? 'none'}>
                <strong>{c.name}</strong>
                <span className="tabular">
                  {money(c.total)}{' '}
                  <span className="muted">· {Math.round((c.total / expense) * 100)}%</span>
                </span>
              </div>
            ))
          ) : (
            <EmptyState title="No expenses in this period">
              Import a statement or record transactions to see trends.
            </EmptyState>
          )}
        </Card>
      </div>
    </>
  )
}
