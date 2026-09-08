import * as fs from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppData } from '../../../shared/types'
import { defaultAppData } from '../defaults'
import { JsonDatabase, parseBudgetFile } from '../jsonDatabase'

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>()
  return {
    ...actual,
    readFileSync: vi.fn(actual.readFileSync),
    renameSync: vi.fn(actual.renameSync),
    writeFileSync: vi.fn(actual.writeFileSync)
  }
})

describe('atomic budget persistence', () => {
  let directory: string
  let db: JsonDatabase
  beforeEach(() => {
    directory = fs.mkdtempSync(join(tmpdir(), 'budget-persistence-'))
    db = JsonDatabase.in(directory)
  })
  afterEach(() => {
    vi.restoreAllMocks()
    fs.rmSync(directory, { recursive: true, force: true })
  })

  it('returns detached snapshots and takes ownership of saved input', () => {
    const input = defaultAppData()
    db.save(input)
    input.categories[0].name = 'Changed after save'
    const firstRead = db.load()
    firstRead.profile.name = 'Changed after read'
    expect(db.load()).toEqual(defaultAppData())
    expect(new JsonDatabase(db.path).load()).toEqual(defaultAppData())
  })

  it('never archives or overwrites an unreadable existing budget', () => {
    const content = JSON.stringify(defaultAppData())
    fs.writeFileSync(db.path, content)
    vi.mocked(fs.readFileSync).mockImplementationOnce(() => {
      throw Object.assign(new Error('Permission denied'), { code: 'EACCES' })
    })
    expect(() => db.load()).toThrow('Permission denied')
    expect(fs.readFileSync(db.path, 'utf8')).toBe(content)
    expect(fs.readdirSync(directory)).toEqual(['budget-data.json'])
  })

  it('does not reset a malformed budget if preserving the original fails', () => {
    fs.writeFileSync(db.path, '{ damaged budget')
    vi.mocked(fs.renameSync).mockImplementationOnce(() => {
      throw new Error('Recovery copy failed')
    })
    expect(() => db.load()).toThrow('Recovery copy failed')
    expect(fs.readFileSync(db.path, 'utf8')).toBe('{ damaged budget')
    expect(fs.readdirSync(directory)).toEqual(['budget-data.json'])
  })

  it('preserves the exact malformed bytes before creating a new budget', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    fs.writeFileSync(db.path, '{ damaged budget')
    expect(db.load()).toEqual(defaultAppData())
    const recovery = fs.readdirSync(directory).find((name) => name.includes('.corrupt-'))!
    expect(fs.readFileSync(join(directory, recovery), 'utf8')).toBe('{ damaged budget')
  })

  it.each(['write', 'rename'])('retains the disk and cached budget after a failed %s', (failure) => {
    const original = db.load()
    const content = fs.readFileSync(db.path, 'utf8')
    const operation = failure === 'write' ? fs.writeFileSync : fs.renameSync
    vi.mocked(operation).mockImplementationOnce(() => {
      throw new Error('Disk failure')
    })
    expect(() => db.save({ ...original, profile: { ...original.profile, name: 'Unsaved' } })).toThrow('Disk failure')
    expect(db.load()).toEqual(original)
    expect(fs.readFileSync(db.path, 'utf8')).toBe(content)
    expect(fs.readdirSync(directory)).toEqual(['budget-data.json'])
  })

  it('does not cache initial defaults if creating the first budget fails', () => {
    vi.mocked(fs.writeFileSync).mockImplementationOnce(() => {
      throw new Error('Disk full')
    })
    expect(() => db.load()).toThrow('Disk full')
    expect(fs.existsSync(db.path)).toBe(false)
    expect(db.load()).toEqual(defaultAppData())
    expect(fs.existsSync(db.path)).toBe(true)
  })

  it.each([
    (data: AppData) => { data.profile = [] as unknown as AppData['profile'] },
    (data: AppData) => { data.profile.currency = ['USD'] as unknown as string },
    (data: AppData) => { delete (data.profile as Partial<AppData['profile']>).annualSalary },
    (data: AppData) => {
      data.importPresets = [{ id: 'preset', name: 'Bank', columns: [] as unknown as AppData['importPresets'][number]['columns'], positiveIsExpense: false, dayFirst: false }]
    }
  ])('rejects malformed current-version backups instead of silently repairing them', (damage) => {
    const data = defaultAppData()
    damage(data)
    expect(() => parseBudgetFile(JSON.stringify(data))).toThrow()
  })
})
