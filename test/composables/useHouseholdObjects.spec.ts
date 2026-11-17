import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { HouseholdObject } from '@/types/household-object'
import type { HouseholdObjectAttribute } from '@/types/household-object-attribute'

// Hoisted so the same mocks are returned after vi.resetModules().
const service = vi.hoisted(() => ({
  listObjects: vi.fn(),
  createObject: vi.fn(),
  updateObject: vi.fn(),
  deleteObject: vi.fn(),
}))
vi.mock('@/services/household-object.service', () => service)
const attributeService = vi.hoisted(() => ({ listAttributes: vi.fn() }))
vi.mock('@/services/household-object-attribute.service', () => attributeService)

function attribute(id: number, objectId: number, name: string): HouseholdObjectAttribute {
  return { id, objectId, name, valueType: 'text', value: null, unit: null, sortOrder: id }
}

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
  vi.mocked(attributeService.listAttributes).mockResolvedValue([])
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

  it('loads attributes with the objects and finds them per object', async () => {
    vi.mocked(service.listObjects).mockResolvedValue([object(1, null), object(2, null)])
    vi.mocked(attributeService.listAttributes).mockResolvedValue([
      attribute(1, 1, 'Power'),
      attribute(2, 2, 'power'),
      attribute(3, 2, 'Colour'),
      attribute(4, 1, 'age'),
    ])
    const state = await load()
    await state.ensureLoaded()

    expect(state.findObject(2)?.name).toBe('#2')
    expect(state.findObject(9)).toBeUndefined()
    expect(state.attributesOf(1).map((a) => a.id)).toEqual([1, 4])
    expect(state.attributesOf(9)).toEqual([])
    // Each name once (first spelling wins), sorted ignoring case.
    expect(state.attributeNames.value).toEqual(['age', 'Colour', 'Power'])
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
    vi.mocked(service.createObject).mockResolvedValue(4)
    const state = await load()
    const input = { name: 'Chair', categoryId: null }
    const attributes = [{ name: 'Colour', valueType: 'text' as const, value: 'red' }]

    await expect(state.addObject(input, attributes)).resolves.toBe(4)
    await state.updateObject(1, input, attributes)
    await state.deleteObject(1)

    expect(service.createObject).toHaveBeenCalledWith(input, attributes)
    expect(service.updateObject).toHaveBeenCalledWith(1, input, attributes)
    expect(service.deleteObject).toHaveBeenCalledWith(1)
    expect(service.listObjects).toHaveBeenCalledTimes(3)
    expect(attributeService.listAttributes).toHaveBeenCalledTimes(3)
  })

  it('rethrows write errors without reloading', async () => {
    vi.mocked(service.createObject).mockRejectedValue(new Error('invalid'))
    const state = await load()
    await expect(state.addObject({ name: '', categoryId: null }, [])).rejects.toThrow('invalid')
    expect(service.listObjects).not.toHaveBeenCalled()
  })
})
