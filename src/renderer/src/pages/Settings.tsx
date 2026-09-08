import { formatMoney } from '@shared/domain/money'
import { monthlyIncome } from '@shared/domain/pacing'
import type { AppData, Profile } from '@shared/types'
import { useEffect, useRef, useState } from 'react'
import { Card, Field } from '../components/ui'
import { useLoadedStore } from '../state/AppStore'
import { useSyncedDraft } from '../state/useSyncedDraft'
import { ThemePicker } from '../components/ThemePicker'
import { CategoryEditor } from '../components/CategoryEditor'
import { RulesEditor } from '../components/RulesEditor'

const EMOJI = ['🙂', '🦊', '🐢', '🚀', '🌱', '🍀', '⭐️', '🐧', '🎧', '🧋']

export function Settings(): JSX.Element {
  const { data, mutate, busy, reportError } = useLoadedStore()
  const [profile, setProfile, profileDraft] = useSyncedDraft(data.profile)
  const [saved, setSaved] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exported, setExported] = useState(false)

  const savedTimer = useRef<ReturnType<typeof setTimeout>>()
  useEffect(() => () => clearTimeout(savedTimer.current), [])

  const replaceBudget = (load: () => Promise<AppData>, forceDraftReset = false): Promise<boolean> =>
    mutate(async (current) => {
      const next = await load()
      // Restore cancellation returns an unchanged snapshot. Explicit demo/reset actions
      // discard drafts even when the replacement profile happens to equal the old one.
      if (forceDraftReset || JSON.stringify(current) !== JSON.stringify(next))
        profileDraft.reset(next.profile)
      return next
    })

  const money = (n: number): string => formatMoney(n, profile.currency)
  const budgetTotal = data.categories.reduce((s, c) => s + c.monthlyLimit, 0)
  const income = monthlyIncome(profile)

  const save = async (): Promise<void> => {
    if (busy) return
    const submitted = profile
    if (
      !(await mutate(async () => {
        const next = await window.budget.saveProfile(submitted)
        // Reflect server normalization while retaining anything typed after submission.
        profileDraft.acknowledge(submitted, next.profile)
        return next
      }))
    )
      return
    setSaved(true)
    clearTimeout(savedTimer.current)
    savedTimer.current = setTimeout(() => setSaved(false), 1600)
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
            current={data.profile.themeId}
            disabled={busy}
            onPick={(themeId) => {
              // Persist only appearance. Unsaved income/name edits still require Save profile.
              void mutate((current) => window.budget.saveProfile({ ...current.profile, themeId }))
            }}
          />
        </Card>

        <Card title="How you earn">
          <div className="form-grid">
            <Field
              label="Dashboard income basis"
              hint="Reports always use recorded income. Use estimate + entries only when every income entry is extra pay."
            >
              <select
                value={profile.incomeBasis ?? 'estimate-plus-extra'}
                onChange={(e) =>
                  setProfile({ ...profile, incomeBasis: e.target.value as Profile['incomeBasis'] })
                }
              >
                <option value="estimate">Salary/hourly estimate only</option>
                <option value="recorded">Recorded income only</option>
                <option value="estimate-plus-extra">Estimate + extra income entries</option>
              </select>
            </Field>
            <Field label="Method of measurement">
              <select
                value={profile.incomeMethod}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    incomeMethod: e.target.value as Profile['incomeMethod']
                  })
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
                    onChange={(e) =>
                      setProfile({ ...profile, hoursPerWeek: Number(e.target.value) })
                    }
                  />
                </Field>
              </>
            )}
            <Field
              label="Withheld for taxes (%)"
              hint="Rough estimate; used to get to take-home pay."
            >
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
            <button className="btn btn--primary" disabled={busy} onClick={() => void save()}>
              Save profile
            </button>
            {saved && <span className="text-green">Saved</span>}
          </div>
        </Card>

        <Card title="Monthly budget">
          <p className="muted" style={{ marginTop: 0 }}>
            Planned spend {money(budgetTotal)} of {money(income)} estimated take-home ·{' '}
            <span className={budgetTotal > income ? 'text-red' : 'text-green'}>
              {money(income - budgetTotal)} left to save
            </span>
          </p>
          <CategoryEditor categories={data.categories} currency={profile.currency} />
        </Card>

        <RulesEditor />

        <Card title="Data & backups">
          <p className="muted" style={{ marginTop: 0 }}>
            Save a full backup of your profile, budgets, goals, bills, rules and transactions.
            Backups stay wherever you save them. Export transaction CSVs from Transactions.
          </p>
          <div className="btn-row">
            <button
              className="btn"
              disabled={busy || exporting}
              onClick={async () => {
                setExporting(true)
                setExported(false)
                try {
                  setExported(await window.budget.exportBackup())
                } catch (e) {
                  reportError(e)
                } finally {
                  setExporting(false)
                }
              }}
            >
              {exporting ? 'Saving…' : 'Save backup'}
            </button>
            <button
              className="btn"
              disabled={busy || exporting}
              onClick={async () => {
                await replaceBudget(() => window.budget.restoreBackup())
              }}
            >
              Restore backup…
            </button>
            {exported && (
              <span className="text-green" role="status">
                Backup saved
              </span>
            )}
          </div>
          <div className="btn-row" style={{ marginTop: 18 }}>
            <button
              className="btn"
              disabled={busy}
              onClick={async () => {
                if (
                  confirm(
                    'Replace your budget with demo data? You can undo this during this session.'
                  )
                )
                  await replaceBudget(() => window.budget.loadDemoData(), true)
              }}
            >
              Load demo data
            </button>
            <button
              className="btn btn--danger"
              disabled={busy}
              onClick={() => {
                if (confirm('Erase everything and start over?'))
                  void replaceBudget(() => window.budget.resetData(), true)
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
