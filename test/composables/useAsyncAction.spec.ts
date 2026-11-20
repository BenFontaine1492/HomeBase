import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAsyncAction } from '@/composables/useAsyncAction'

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('useAsyncAction', () => {
  it('is running while the task runs, with the name of the action', async () => {
    const state = useAsyncAction<'backup' | 'restore'>()
    let during: [boolean, string | null] = [false, null]

    await state.run(() => {
      during = [state.isRunning.value, state.current.value]
      return Promise.resolve()
    }, 'backup')

    expect(during).toEqual([true, 'backup'])
    expect(state.isRunning.value).toBe(false)
    expect(state.current.value).toBeNull()
    expect(state.error.value).toBeNull()
  })

  it('runs an action without a name', async () => {
    const state = useAsyncAction()
    const task = vi.fn(() => Promise.resolve())

    await state.run(task)

    expect(task).toHaveBeenCalledTimes(1)
    expect(state.current.value).toBeNull()
  })

  it('turns a failure into an error message and clears it on the next run', async () => {
    const state = useAsyncAction()

    await state.run(() => Promise.reject(new Error('Disk full')))
    expect(state.error.value).toBe('Disk full')
    expect(console.error).toHaveBeenCalled()

    await state.run(() => Promise.resolve())
    expect(state.error.value).toBeNull()
  })

  it('runs one action at a time and disables the others meanwhile', async () => {
    const state = useAsyncAction<'backup' | 'restore'>()
    let finish: () => void = () => {}
    const first = state.run(() => new Promise<void>((resolve) => (finish = resolve)), 'backup')
    const second = vi.fn(() => Promise.resolve())

    await state.run(second, 'restore')

    expect(second).not.toHaveBeenCalled()
    expect(state.isDisabled('restore')).toBe(true)
    expect(state.isDisabled('backup')).toBe(false)

    finish()
    await first

    expect(state.isDisabled('restore')).toBe(false)
  })
})
