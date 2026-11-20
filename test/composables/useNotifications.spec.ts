import { describe, expect, it, vi } from 'vitest'

/** Fresh module-level state for every test. */
async function load() {
  vi.resetModules()
  const { useNotifications } = await import('@/composables/useNotifications')
  return useNotifications
}

describe('useNotifications', () => {
  it('queues messages in order, shared by every caller', async () => {
    const useNotifications = await load()

    useNotifications().notify('Saved.')
    useNotifications().notify('Backup saved.')

    expect(useNotifications().queue.value).toEqual(['Saved.', 'Backup saved.'])
  })

  it('shows the same message twice in a row only once', async () => {
    const useNotifications = await load()
    const { notify, queue } = useNotifications()

    notify('Saved.')
    notify('Saved.')
    expect(queue.value).toEqual(['Saved.'])

    queue.value = []
    notify('Saved.')
    expect(queue.value).toEqual(['Saved.'])
  })
})
