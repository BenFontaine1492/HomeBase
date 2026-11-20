import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAutoSave } from '@/composables/useAutoSave'

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('useAutoSave', () => {
  it('saves one change after the other, in order', async () => {
    const events: string[] = []
    let finishFirst: () => void = () => {}
    let calls = 0
    const task = vi.fn(() => {
      calls += 1
      const call = calls
      events.push(`start ${call}`)
      if (call === 1)
        return new Promise<void>((resolve) => (finishFirst = resolve)).then(() => void events.push('end 1'))
      events.push(`end ${call}`)
      return Promise.resolve()
    })
    const { save } = useAutoSave(task, () => events.push('saved'))

    const first = save()
    const second = save()
    await Promise.resolve()
    expect(events).toEqual(['start 1'])

    finishFirst()
    await Promise.all([first, second])

    expect(events).toEqual(['start 1', 'end 1', 'saved', 'start 2', 'end 2', 'saved'])
  })

  it('keeps the error of a failed save and clears it when a save works again', async () => {
    const onSaved = vi.fn()
    const task = vi.fn<() => Promise<void>>().mockRejectedValueOnce(new Error('Locked')).mockResolvedValue(undefined)
    const { error, save } = useAutoSave(task, onSaved)

    await save()
    expect(error.value).toBe('Locked')
    expect(onSaved).not.toHaveBeenCalled()
    expect(console.error).toHaveBeenCalled()

    await save()
    expect(error.value).toBeNull()
    expect(onSaved).toHaveBeenCalledTimes(1)
  })
})
