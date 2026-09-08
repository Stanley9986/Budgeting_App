import { describe, expect, it } from 'vitest'
import { SerialQueue } from '../serialQueue'
import { acknowledgeSave, editDraft, receiveSaved, type DraftState } from '../drafts'

describe('ordered saves', () => {
  it('saves rapid field edits in order against the last persisted record', async () => {
    const queue = new SerialQueue()
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    let saved = { name: 'Rent', limit: 100 }
    const first = queue.run(async () => {
      await gate
      saved = { ...saved, name: 'Housing' }
    })
    const second = queue.run(async () => {
      saved = { ...saved, limit: 200 }
    })
    release()
    await Promise.all([first, second])
    expect(saved).toEqual({ name: 'Housing', limit: 200 })
  })

  it('continues processing after a failed operation', async () => {
    const queue = new SerialQueue()
    const failed = queue.run(async () => {
      throw new Error('disk full')
    })
    const next = queue.run(async () => 'saved')
    await expect(failed).rejects.toThrow('disk full')
    await expect(next).resolves.toBe('saved')
  })
})

describe('form draft synchronization', () => {
  const initial = <T extends object>(value: T): DraftState<T> => ({ value, dirty: {} })

  it('refreshes fields after a successful save followed by undo', () => {
    const original = { name: 'Rent', limit: '100' }
    const submitted = { name: 'Housing', limit: '200' }
    const edited = editDraft(initial(original), submitted)
    const acknowledged = acknowledgeSave(edited, submitted, submitted)
    expect(receiveSaved(acknowledged, original).value).toEqual(original)
  })

  it('keeps an unsaved name while a theme change is persisted', () => {
    const edited = editDraft(initial({ name: 'Old', theme: 'sand' }), {
      name: 'Draft',
      theme: 'sand'
    })
    expect(receiveSaved(edited, { name: 'Old', theme: 'midnight' }).value).toEqual({
      name: 'Draft',
      theme: 'midnight'
    })
  })

  it('keeps newer typing when the user returns to the original value during a save', () => {
    const submitted = { name: 'B' }
    const pending = editDraft(initial({ name: 'A' }), submitted)
    const newer = editDraft(pending, { name: 'A' })
    const result = acknowledgeSave(newer, submitted, submitted)
    expect(receiveSaved(result, submitted).value).toEqual({ name: 'A' })
    expect(result.dirty.name).toBe(true)
  })

  it('accepts server normalization and allows undo afterwards', () => {
    const original = { withholding: 20 }
    const submitted = { withholding: 150 }
    const normalized = { withholding: 100 }
    const result = acknowledgeSave(editDraft(initial(original), submitted), submitted, normalized)
    expect(result.value).toEqual(normalized)
    expect(receiveSaved(result, original).value).toEqual(original)
  })

  it('acknowledges only the field submitted by an autosave', () => {
    const edited = editDraft(initial({ name: 'Rent', limit: '100' }), {
      name: 'Housing',
      limit: '200'
    })
    const result = acknowledgeSave(edited, { limit: '200' }, { name: 'Rent', limit: '200' })
    expect(result.value).toEqual({ name: 'Housing', limit: '200' })
    expect(result.dirty).toEqual({ name: true })
  })

  it('allows undo after a normalized blur needs no persistence change', () => {
    const saved = { limit: '200' }
    const typed = editDraft(initial(saved), { limit: '200.00' })
    const normalized = editDraft(typed, saved)
    const acknowledged = acknowledgeSave(normalized, saved, saved)
    expect(receiveSaved(acknowledged, { limit: '100' }).value).toEqual({ limit: '100' })
  })

  it('keeps the latest value when it matches an older queued submission', () => {
    let state = editDraft(initial({ name: 'A' }), { name: 'B' })
    state = editDraft(state, { name: 'C' })
    state = editDraft(state, { name: 'B' })
    state = acknowledgeSave(state, { name: 'B' }, { name: 'B' })
    state = acknowledgeSave(state, { name: 'C' }, { name: 'C' })
    expect(receiveSaved(state, { name: 'C' }).value).toEqual({ name: 'B' })
    expect(state.dirty.name).toBe(true)
  })

  it('keeps newer typing after an earlier submission is normalized', () => {
    const original = initial({ name: 'Old' })
    const newer = editDraft(editDraft(original, { name: 'Submitted' }), { name: 'Newer' })
    expect(acknowledgeSave(newer, { name: 'Submitted' }, { name: 'Submitted' }).value).toEqual({
      name: 'Newer'
    })
  })
})
