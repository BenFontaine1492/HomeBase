import { beforeEach, describe, expect, it, vi } from 'vitest'

// Hoisted so the same mocks are returned after vi.resetModules().
const service = vi.hoisted(() => ({ loadSettings: vi.fn(), setMaintenanceDueSoonDays: vi.fn() }))
vi.mock('@/services/settings.service', () => service)

/** Fresh module-level state for every test. */
async function load() {
  vi.resetModules()
  const { useSettings } = await import('@/composables/useSettings')
  return useSettings()
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('useSettings', () => {
  it('starts with the defaults and loads once', async () => {
    vi.mocked(service.loadSettings).mockResolvedValue({ maintenanceDueSoonDays: 14 })
    const state = await load()
    expect(state.settings.value).toEqual({ maintenanceDueSoonDays: null })

    await state.ensureLoaded()
    await state.ensureLoaded()

    expect(service.loadSettings).toHaveBeenCalledTimes(1)
    expect(state.settings.value).toEqual({ maintenanceDueSoonDays: 14 })
  })

  it('does not start a second load while one is running', async () => {
    vi.mocked(service.loadSettings).mockResolvedValue({ maintenanceDueSoonDays: null })
    const state = await load()
    const first = state.refresh()
    await state.ensureLoaded()
    await first
    expect(service.loadSettings).toHaveBeenCalledTimes(1)
  })

  it('keeps the defaults and the error message when loading fails', async () => {
    vi.mocked(service.loadSettings).mockRejectedValue(new Error('locked'))
    const state = await load()
    await state.refresh()
    expect(state.error.value).toBe('locked')
    expect(state.isLoading.value).toBe(false)
    expect(state.settings.value).toEqual({ maintenanceDueSoonDays: null })
  })

  it('saves a setting and reloads, or rethrows', async () => {
    vi.mocked(service.loadSettings).mockResolvedValue({ maintenanceDueSoonDays: 60 })
    const state = await load()
    await state.setMaintenanceDueSoonDays(60)
    expect(service.setMaintenanceDueSoonDays).toHaveBeenCalledWith(60)
    expect(state.settings.value.maintenanceDueSoonDays).toBe(60)

    vi.mocked(service.setMaintenanceDueSoonDays).mockRejectedValue(new Error('invalid'))
    await expect(state.setMaintenanceDueSoonDays(0)).rejects.toThrow('invalid')
    expect(service.loadSettings).toHaveBeenCalledTimes(1)
  })
})
