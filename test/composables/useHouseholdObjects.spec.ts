import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { HouseholdObject } from '@/types/household-object'

// Hoisted so the same mocks are returned after vi.resetModules().
const service = vi.hoisted(() => ({
  listObjects: vi.fn(),
  createObject: vi.fn(),
  updateObject: vi.fn(),
  deleteObject: vi.fn(),
}))
vi.mock('@/services/household-object.service', () => service)

function object(id: number, categoryId: number | null): HouseholdObject {
  return {
    id,
    name: `#${id}`,
    categoryId,
    manufacturer: null,
    model: null,
    serialNumber: null,
    purchaseDate: null,
    purchasePriceCents: null,
    installationDate: null,
    location: null,
    notes: null,
    createdAt: '',
    updatedAt: '',
  }
}

/** Fresh module-level state for every test. */
async function load() {
  vi.resetModules()
  const { useHouseholdObjects } = await import('@/composables/useHouseholdObjects')
  return useHouseholdObjects()
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('useHouseholdObjects', () => {
  it('counts and filters objects per category', async () => {
    vi.mocked(service.listObjects).mockResolvedValue([object(1, 5), object(2, 5), object(3, null), object(4, 6)])
    const state = await load()
    expect(state.uncategorizedCount.value).toBe(0)

    await state.ensureLoaded()
    await state.ensureLoaded()

    expect(service.listObjects).toHaveBeenCalledTimes(1)
    expect(state.objects.value).toHaveLength(4)
    expect(state.countFor(5)).toBe(2)
    expect(state.countFor(6)).toBe(1)
    expect(state.countFor(99)).toBe(0)
    expect(state.uncategorizedCount.value).toBe(1)
    expect(state.objectsInCategory(5).map((o) => o.id)).toEqual([1, 2])
    expect(state.objectsInCategory(null).map((o) => o.id)).toEqual([3])
  })

  it('does not start a second load while one is running', async () => {
    let finish: (rows: HouseholdObject[]) => void = () => {}
    vi.mocked(service.listObjects).mockReturnValue(new Promise((resolve) => (finish = resolve)))
    const state = await load()

    const first = state.refresh()
    expect(state.isLoading.value).toBe(true)
    await state.ensureLoaded()
    finish([])
    await first

    expect(service.listObjects).toHaveBeenCalledTimes(1)
  })

  it('keeps the error message when loading fails', async () => {
    vi.mocked(service.listObjects).mockRejectedValue('locked')
    const state = await load()
    await state.ensureLoaded()
    expect(state.error.value).toBe('locked')
    expect(state.isLoading.value).toBe(false)
  })

  it('reloads after every write', async () => {
    vi.mocked(service.listObjects).mockResolvedValue([])
    const state = await load()
    const input = { name: 'Chair', categoryId: null }

    await state.addObject(input)
    await state.updateObject(1, input)
    await state.deleteObject(1)

    expect(service.createObject).toHaveBeenCalledWith(input)
    expect(service.updateObject).toHaveBeenCalledWith(1, input)
    expect(service.deleteObject).toHaveBeenCalledWith(1)
    expect(service.listObjects).toHaveBeenCalledTimes(3)
  })

  it('rethrows write errors without reloading', async () => {
    vi.mocked(service.createObject).mockRejectedValue(new Error('invalid'))
    const state = await load()
    await expect(state.addObject({ name: '', categoryId: null })).rejects.toThrow('invalid')
    expect(service.listObjects).not.toHaveBeenCalled()
  })
})
