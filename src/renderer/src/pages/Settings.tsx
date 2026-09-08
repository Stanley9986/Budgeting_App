import { formatMoney } from '@shared/domain/money'
import { monthlyIncome } from '@shared/domain/pacing'
import { THEMES, type ThemeScheme } from '@shared/themes'
import type { Category, Profile } from '@shared/types'
import { useEffect, useState } from 'react'
import { Card, Field } from '../components/ui'
import { useAppStore } from '../state/AppStore'

const EMOJI = ['🙂', '🦊', '🐢', '🚀', '🌱', '🍀', '⭐️', '🐧', '🎧', '🧋']

export function Settings(): JSX.Element {
  const { data, mutate } = useAppStore()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (data && !profile) setProfile(data.profile)
  }, [data, profile])

  if (!data || !profile) return <div />

  const money = (n: number): string => formatMoney(n, profile.currency)
  const budgetTotal = data.categories.reduce((s, c) => s + c.monthlyLimit, 0)
  const income = monthlyIncome(profile)

  const save = async (): Promise<void> => {
    await mutate(() => window.budget.saveProfile(profile))
    setSaved(true)
    setTimeout(() => setSaved(false), 1600)
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Settings</h1>
          <p>Your profile, how you earn, and what you plan to spend.</p>
        </div>
      </div>

      <div className="grid" style={{ gap: 16 }}>
        <Card title="Profile">
          <div className="form-grid">
            <Field label="Name">
              <input
                value={profile.name}
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                placeholder="Your name"
              />
            </Field>
            <Field label="Avatar">
              <div className="btn-row" style={{ flexWrap: 'wrap' }}>
                {EMOJI.map((e) => (
                  <button
                    key={e}
                    type="button"
                    className="btn"
                    style={{
                      padding: '6px 9px',
                      borderColor: profile.avatarEmoji === e ? 'var(--accent)' : undefined
                    }}
                    onClick={() => setProfile({ ...profile, avatarEmoji: e })}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </Field>
          </div>
        </Card>

        <Card title="Appearance">
          <ThemePicker
            current={profile.themeId}
            onPick={(themeId) => {
              // Applied and saved immediately — a theme you have to confirm is
              // a theme you can't preview.
              const next = { ...profile, themeId }
              setProfile(next)
              void mutate(() => window.budget.saveProfile(next))
            }}
          />
        </Card>

        <Card title="How you earn">
          <div className="form-grid">
            <Field label="Method of measurement">
              <select
                value={profile.incomeMethod}
                onChange={(e) =>
                  setProfile({ ...profile, incomeMethod: e.target.value as Profile['incomeMethod'] })
                }
              >
                <option value="salary">Yearly salary</option>
                <option value="hourly">Hourly rate</option>
              </select>
            </Field>
            {profile.incomeMethod === 'salary' ? (
              <Field label="Gross annual salary">
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={profile.annualSalary || ''}
                  onChange={(e) => setProfile({ ...profile, annualSalary: Number(e.target.value) })}
                />
              </Field>
            ) : (
              <>
                <Field label="Hourly rate">
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={profile.hourlyRate || ''}
                    onChange={(e) => setProfile({ ...profile, hourlyRate: Number(e.target.value) })}
                  />
                </Field>
                <Field label="Hours per week">
                  <input
                    type="number"
                    min="0"
                    max="168"
                    value={profile.hoursPerWeek || ''}
                    onChange={(e) => setProfile({ ...profile, hoursPerWeek: Number(e.target.value) })}
                  />
                </Field>
              </>
            )}
            <Field label="Withheld for taxes (%)" hint="Rough estimate; used to get to take-home pay.">
              <input
                type="number"
                min="0"
                max="100"
                value={profile.withholdingPct}
                onChange={(e) => setProfile({ ...profile, withholdingPct: Number(e.target.value) })}
              />
            </Field>
          </div>
          <p className="muted" style={{ marginBottom: 0 }}>
            Estimated take-home: <strong className="tabular">{money(income)}</strong> per month.
          </p>
          <div className="btn-row" style={{ marginTop: 14 }}>
            <button className="btn btn--primary" onClick={() => void save()}>
              Save profile
            </button>
            {saved && <span className="text-green">Saved</span>}
          </div>
        </Card>

        <Card title="Monthly budget">
          <p className="muted" style={{ marginTop: 0 }}>
            Planned spend {money(budgetTotal)} of {money(income)} take-home ·{' '}
            <span className={budgetTotal > income ? 'text-red' : 'text-green'}>
              {money(income - budgetTotal)} left to save
            </span>
          </p>
          <CategoryEditor categories={data.categories} currency={profile.currency} />
        </Card>

        <Card title="Data">
          <p className="muted" style={{ marginTop: 0 }}>
            Everything lives in a JSON file in this Mac&apos;s application-support folder. Nothing is
            uploaded anywhere.
          </p>
          <div className="btn-row">
            <button className="btn" onClick={() => void mutate(() => window.budget.loadDemoData())}>
              Load demo data
            </button>
            <button
              className="btn btn--danger"
              onClick={() => {
                if (confirm('Erase everything and start over?'))
                  void mutate(() => window.budget.resetData())
              }}
            >
              Reset everything
            </button>
          </div>
        </Card>
      </div>
    </>
  )
}


function ThemePicker({
  current,
  onPick
}: {
  current: string
  onPick: (id: string) => void
}): JSX.Element {
  const groups: [string, ThemeScheme][] = [
    ['Light', 'light'],
    ['Dark', 'dark']
  ]

  return (
    <>
      {groups.map(([label, scheme]) => (
        <div key={scheme} style={{ marginBottom: 12 }}>
          <div className="theme-group-label">{label}</div>
          <div className="theme-grid">
            {THEMES.filter((t) => t.scheme === scheme).map((theme) => (
              <button
                key={theme.id}
                type="button"
                className="theme-swatch"
                aria-pressed={theme.id === current}
                onClick={() => onPick(theme.id)}
              >
                <span className="theme-swatch__preview">
                  <span style={{ background: theme.tokens.bg }} />
                  <span style={{ background: theme.tokens.bgElevated }} />
                  <span style={{ background: theme.tokens.accent }} />
                  <span style={{ background: theme.tokens.green }} />
                </span>
                <span className="theme-swatch__name">
                  {theme.name}
                  {theme.id === current && ' ✓'}
                </span>
                <span className="theme-swatch__desc">{theme.description}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </>
  )
}

function CategoryEditor({
  categories,
  currency
}: {
  categories: Category[]
  currency: string
}): JSX.Element {
  const { mutate } = useAppStore()
  const [newName, setNewName] = useState('')

  return (
    <>
      <table>
        <thead>
          <tr>
            <th>Category</th>
            <th style={{ width: 170 }}>Monthly limit</th>
            <th style={{ width: 120 }} title="A bill charged as one lump each month, like rent. These skip pace projection.">
              Recurring bill
            </th>
            <th style={{ width: 80 }} />
          </tr>
        </thead>
        <tbody>
          {categories.map((c) => (
            <tr key={c.id}>
              <td>
                <div className="cat-row__name">
                  <span className="swatch" style={{ background: c.color }} />
                  <input
                    defaultValue={c.name}
                    onBlur={(e) =>
                      e.target.value !== c.name &&
                      void mutate(() => window.budget.upsertCategory({ ...c, name: e.target.value }))
                    }
                  />
                </div>
              </td>
              <td>
                <input
                  type="number"
                  min="0"
                  step="10"
                  defaultValue={c.monthlyLimit}
                  onBlur={(e) =>
                    Number(e.target.value) !== c.monthlyLimit &&
                    void mutate(() =>
                      window.budget.upsertCategory({ ...c, monthlyLimit: Number(e.target.value) })
                    )
                  }
                />
              </td>
              <td>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={c.fixed}
                    onChange={(e) =>
                      void mutate(() =>
                        window.budget.upsertCategory({ ...c, fixed: e.target.checked })
                      )
                    }
                  />
                  {c.fixed ? 'Fixed' : 'Variable'}
                </label>
              </td>
              <td>
                <div className="row-actions">
                  <button
                    className="btn btn--ghost btn--danger"
                    onClick={() => void mutate(() => window.budget.deleteCategory(c.id))}
                    title={`Delete ${c.name} (${formatMoney(c.monthlyLimit, currency)})`}
                  >
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <form
        className="btn-row"
        style={{ marginTop: 14 }}
        onSubmit={(e) => {
          e.preventDefault()
          if (!newName.trim()) return
          void mutate(() =>
            window.budget.upsertCategory({ name: newName, monthlyLimit: 0, color: '', fixed: false })
          )
          setNewName('')
        }}
      >
        <input
          style={{ maxWidth: 260 }}
          placeholder="New category name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <button type="submit" className="btn">
          Add category
        </button>
      </form>
    </>
  )
}
