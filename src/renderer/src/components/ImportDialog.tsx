import { importCsv, isDuplicate, type CsvImportResult } from '@shared/domain/csv'
import { formatMoney } from '@shared/domain/money'
import type { NewTransaction } from '@shared/types'
import { useMemo, useState } from 'react'
import { useAppStore } from '../state/AppStore'
import { Modal } from './ui'

/**
 * Import is a three-step flow: pick a file, review what the parser understood,
 * then commit. Nothing is written until the user confirms.
 */
export function ImportDialog({ onClose }: { onClose: () => void }): JSX.Element {
  const { data, mutate } = useAppStore()
  const [fileName, setFileName] = useState<string | null>(null)
  const [raw, setRaw] = useState<string | null>(null)
  const [positiveIsExpense, setPositiveIsExpense] = useState(false)
  const [skipDuplicates, setSkipDuplicates] = useState(true)
  const [busy, setBusy] = useState(false)

  const money = (n: number): string => formatMoney(n, data?.profile.currency ?? 'USD')

  const result: CsvImportResult | null = useMemo(() => {
    if (!raw || !data) return null
    const byName = new Map(data.categories.map((c) => [c.name.toLowerCase(), c.id]))
    return importCsv(raw, {
      positiveIsExpense,
      resolveCategoryId: (label) => byName.get(label.trim().toLowerCase()) ?? null
    })
  }, [raw, data, positiveIsExpense])

  const toImport: NewTransaction[] = useMemo(() => {
    if (!result || !data) return []
    if (!skipDuplicates) return result.transactions
    return result.transactions.filter((t) => !isDuplicate(t, data.transactions))
  }, [result, data, skipDuplicates])

  const duplicates = (result?.transactions.length ?? 0) - toImport.length

  const pick = async (): Promise<void> => {
    setBusy(true)
    try {
      const file = await window.budget.pickCsvFile()
      if (file) {
        setFileName(file.fileName)
        setRaw(file.content)
      }
    } finally {
      setBusy(false)
    }
  }

  const commit = async (): Promise<void> => {
    await mutate(() => window.budget.importTransactions(toImport))
    onClose()
  }

  return (
    <Modal title="Import transactions from CSV" onClose={onClose} wide>
      {!raw ? (
        <>
          <p className="muted">
            Most banks can export a statement as CSV. The importer looks for a date column, a
            description and either an <code>Amount</code> column or separate <code>Debit</code> /
            <code> Credit</code> columns.
          </p>
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
                checked={positiveIsExpense}
                onChange={(e) => setPositiveIsExpense(e.target.checked)}
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
            <button className="btn btn--primary" onClick={() => void commit()} disabled={toImport.length === 0}>
              Import {toImport.length} transaction{toImport.length === 1 ? '' : 's'}
            </button>
          </div>
        </>
      )}
    </Modal>
  )
}
