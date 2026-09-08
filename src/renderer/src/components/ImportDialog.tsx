import { importCsv, withoutDuplicates, parseCsv, type CsvImportResult } from '@shared/domain/csv'
import { formatMoney } from '@shared/domain/money'
import type { CsvColumns, NewTransaction, Profile } from '@shared/types'
import { applyCategoryRules } from '@shared/domain/rules'
import { useMemo, useState } from 'react'
import { useAppStore } from '../state/AppStore'
import { Field, Modal } from './ui'

/**
 * Import is a three-step flow: pick a file, review what the parser understood,
 * then commit. Nothing is written until the user confirms.
 */
export function ImportDialog({ onClose }: { onClose: () => void }): JSX.Element {
  const { data, mutate, busy: saving, setMonth } = useAppStore()
  const [fileName, setFileName] = useState<string | null>(null)
  const [raw, setRaw] = useState<string | null>(null)
  const [positiveIsExpense, setPositiveIsExpense] = useState(false)
  const [skipDuplicates, setSkipDuplicates] = useState(true)
  const [busy, setBusy] = useState(false)
  const [columns, setColumns] = useState<CsvColumns>({})
  const [dayFirst, setDayFirst] = useState(false)
  const [presetId, setPresetId] = useState('')
  const [presetName, setPresetName] = useState('')
  const [presetSaved, setPresetSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [incomeBasis, setIncomeBasis] = useState<Profile['incomeBasis']>(
    data?.profile.incomeBasis === 'recorded' ? 'recorded' : 'estimate'
  )
  const headers = useMemo(() => (raw ? (parseCsv(raw)[0] ?? []) : []), [raw])

  const money = (n: number): string => formatMoney(n, data?.profile.currency ?? 'USD')

  const result: CsvImportResult | null = useMemo(() => {
    if (raw === null || !data) return null
    const byName = new Map(data.categories.map((c) => [c.name.toLowerCase(), c.id]))
    return importCsv(raw, {
      positiveIsExpense,
      columns,
      dayFirst,
      resolveCategoryId: (label) => byName.get(label.trim().toLowerCase()) ?? null
    })
  }, [raw, data, positiveIsExpense, columns, dayFirst])

  const toImport: NewTransaction[] = useMemo(() => {
    if (!result || !data) return []
    const accepted = skipDuplicates
      ? withoutDuplicates(result.transactions, data.transactions)
      : result.transactions
    return accepted.map((tx) => applyCategoryRules(tx, data.rules))
  }, [result, data, skipDuplicates])

  const duplicates = (result?.transactions.length ?? 0) - toImport.length

  const pick = async (): Promise<void> => {
    setBusy(true)
    try {
      const file = await window.budget.pickCsvFile()
      if (file) {
        setFileName(file.fileName)
        setRaw(file.content)
        setError(null)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const commit = async (): Promise<void> => {
    if (
      await mutate(() =>
        window.budget.importTransactions(
          toImport,
          skipDuplicates,
          toImport.some((t) => t.kind === 'income') ? incomeBasis : undefined
        )
      )
    ) {
      const latest = toImport
        .map((t) => t.date.slice(0, 7))
        .sort()
        .at(-1)
      if (latest) setMonth(latest)
      onClose()
    }
  }

  const presets = (
    <div className="toolbar" style={{ marginTop: 12 }}>
      <label className="checkbox-row">
        Bank format{' '}
        <select
          aria-label="Bank import preset"
          value={presetId}
          onChange={(e) => {
            const preset = data?.importPresets.find((p) => p.id === e.target.value)
            setPresetId(e.target.value)
            setPresetName(preset?.name ?? '')
            setColumns(preset?.columns ?? {})
            setPositiveIsExpense(preset?.positiveIsExpense ?? false)
            setDayFirst(preset?.dayFirst ?? false)
            setPresetSaved(false)
          }}
        >
          <option value="">Auto-detect / custom</option>
          {data?.importPresets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      {presetId && (
        <button
          className="btn btn--ghost btn--danger"
          disabled={saving}
          onClick={async () => {
            if (await mutate(() => window.budget.deleteImportPreset(presetId))) {
              setPresetId('')
              setPresetName('')
              setPresetSaved(false)
            }
          }}
        >
          Delete preset
        </button>
      )}
    </div>
  )

  return (
    <Modal title="Import transactions from CSV" onClose={onClose} wide>
      {error && (
        <p className="banner-warning" role="alert">
          {error}
        </p>
      )}
      {presets}
      {raw === null ? (
        <>
          <p className="muted">
            Most banks can export a statement as CSV. The importer looks for a date column, a
            description and either an <code>Amount</code> column or separate <code>Debit</code> /
            <code> Credit</code> columns.
          </p>
          <div
            className="import-drop"
            onDragOver={(e) => e.preventDefault()}
            onDrop={async (e) => {
              e.preventDefault()
              const file = e.dataTransfer.files[0]
              if (!file || !/\.(csv|txt)$/i.test(file.name)) {
                setError('Drop a CSV or text file.')
                return
              }
              if (file.size > 25 * 1024 * 1024) {
                setError('Choose a statement smaller than 25 MB.')
                return
              }
              setBusy(true)
              try {
                setRaw(await file.text())
                setFileName(file.name)
                setError(null)
              } catch (err) {
                setError(String(err))
              } finally {
                setBusy(false)
              }
            }}
          >
            Drop a bank CSV here, or choose a file below.
          </div>
          <div className="modal__actions">
            <button className="btn" onClick={onClose}>
              Cancel
            </button>
            <button className="btn btn--primary" onClick={() => void pick()} disabled={busy}>
              {busy ? 'Opening…' : 'Choose a CSV file…'}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="muted" style={{ marginTop: 0 }}>
            <strong>{fileName}</strong> — matched columns: {result?.detected.date} ·{' '}
            {result?.detected.description} · {result?.detected.amount}
          </p>

          {result && result.errors.length > 0 && (
            <div className="banner-warning" style={{ marginBottom: 12 }}>
              {result.skipped} row{result.skipped === 1 ? '' : 's'} skipped.
              <ul style={{ margin: '6px 0 0 16px', padding: 0 }}>
                {result.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}

          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={dayFirst}
                onChange={(e) => {
                  setDayFirst(e.target.checked)
                  setPresetSaved(false)
                }}
              />
              Day-first dates (DD/MM/YYYY)
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={positiveIsExpense}
                onChange={(e) => {
                  setPositiveIsExpense(e.target.checked)
                  setPresetSaved(false)
                }}
              />
              Positive amounts are expenses
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={skipDuplicates}
                onChange={(e) => setSkipDuplicates(e.target.checked)}
              />
              Skip duplicates ({duplicates} found)
            </label>
          </div>

          <details style={{ marginTop: 16 }}>
            <summary>Adjust columns & save bank format</summary>
            <p className="muted">
              Map unusual bank headers once and save them as a preset. Choose “None” for Amount to
              use separate Debit and Credit columns.
            </p>
            <div className="form-grid">
              {(['date', 'description', 'amount', 'debit', 'credit', 'category'] as const).map(
                (key) => (
                  <Field key={key} label={`${key[0].toUpperCase()}${key.slice(1)} column`}>
                    <select
                      value={columns[key] ?? '__auto__'}
                      onChange={(e) => {
                        const next = { ...columns }
                        if (e.target.value === '__auto__') delete next[key]
                        else next[key] = e.target.value
                        setColumns(next)
                        setPresetSaved(false)
                      }}
                    >
                      <option value="__auto__">Auto-detect</option>
                      <option value="">None</option>
                      {headers.map((h, i) => (
                        <option key={i} value={h}>
                          {h || '(blank header)'}
                        </option>
                      ))}
                    </select>
                  </Field>
                )
              )}
            </div>
            <div className="toolbar" style={{ marginTop: 14 }}>
              <input
                aria-label="Bank format name"
                placeholder="e.g. Checking account"
                value={presetName}
                onChange={(e) => {
                  setPresetName(e.target.value)
                  setPresetSaved(false)
                }}
              />
              <button
                className="btn"
                disabled={saving || !presetName.trim()}
                onClick={async () => {
                  const id = presetId || crypto.randomUUID()
                  if (
                    await mutate(() =>
                      window.budget.saveImportPreset({
                        id,
                        name: presetName,
                        columns,
                        positiveIsExpense,
                        dayFirst
                      })
                    )
                  ) {
                    setPresetId(id)
                    setPresetSaved(true)
                  }
                }}
              >
                Save format
              </button>
              {presetSaved && (
                <span role="status" className="text-green">
                  Saved
                </span>
              )}
            </div>
          </details>
          <p className="muted">
            {toImport.filter((t) => t.categoryId).length} categorized ·{' '}
            {toImport.filter((t) => !t.categoryId).length} uncategorized · {duplicates} duplicates
            skipped. Imported rows are marked for review.
          </p>
          {toImport.some((t) => t.kind === 'income') && (
            <Field
              label="Dashboard income after import"
              hint="Choose one basis so an imported paycheck is not counted twice. Reports always show recorded income."
            >
              <select
                value={incomeBasis}
                onChange={(e) => setIncomeBasis(e.target.value as Profile['incomeBasis'])}
              >
                <option value="estimate">Use my salary/hourly estimate only</option>
                <option value="recorded">Use recorded income only</option>
                <option value="estimate-plus-extra">
                  Estimate + income entries (all entries are extra income)
                </option>
              </select>
            </Field>
          )}

          <div className="import-list">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Category</th>
                  <th className="num">Amount</th>
                </tr>
              </thead>
              <tbody>
                {toImport.slice(0, 100).map((t, i) => (
                  <tr key={i}>
                    <td className="muted tabular">{t.date}</td>
                    <td>{t.description}</td>
                    <td className="muted">
                      {data?.categories.find((c) => c.id === t.categoryId)?.name ?? '—'}
                    </td>
                    <td className={`num ${t.kind === 'income' ? 'text-green' : ''}`}>
                      {t.kind === 'income' ? '+' : '−'}
                      {money(t.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="modal__actions">
            <button
              className="btn"
              onClick={() => {
                setRaw(null)
                setFileName(null)
              }}
            >
              Choose another file
            </button>
            <button
              className="btn btn--primary"
              onClick={() => void commit()}
              disabled={saving || busy || toImport.length === 0}
            >
              Import {toImport.length} transaction{toImport.length === 1 ? '' : 's'}
            </button>
          </div>
        </>
      )}
    </Modal>
  )
}
