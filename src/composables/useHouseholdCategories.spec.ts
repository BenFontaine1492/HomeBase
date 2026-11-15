import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { HouseholdCategory } from '@/types/household-category'

// Hoisted so the same mocks are returned after vi.resetModules().
const service = vi.hoisted(() => ({
  listCategories: vi.fn(),
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  deleteCategory: vi.fn(),
}))
vi.mock('@/services/household-category.service', () => service)

const refreshObjects = vi.hoisted(() => vi.fn())
vi.mock('./useHouseholdObjects', () => ({ useHouseholdObjects: () => ({ refresh: refreshObjects }) }))

function category(id: number): HouseholdCategory {
  return { id, name: `#${id}`, icon: 'mdi-radiator', description: null, createdAt: '', updatedAt: '' }
}

/** Fresh module-level state for every test. */
async function load() {
  vi.resetModules()
  const { useHouseholdCategories } = await import('./useHouseholdCategories')
  return useHouseholdCategories()
}

const input = { name: 'Heating', icon: 'mdi-radiator' }

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  refreshObjects.mockResolvedValue(undefined)
})

describe('useHouseholdCategories', () => {
  it('loads once and finds categories by id', async () => {
    vi.mocked(service.listCategories).mockResolvedValue([category(1), category(2)])
    const state = await load()

    await state.ensureLoaded()
    await state.ensureLoaded()

    expect(service.listCategories).toHaveBeenCalledTimes(1)
    expect(state.categories.value).toHaveLength(2)
    expect(state.findCategory(2)?.id).toBe(2)
    expect(state.findCategory(3)).toBeUndefined()
    expect(state.findCategory(null)).toBeUndefined()
  })

  it('does not start a second load while one is running', async () => {
    let finish: (rows: HouseholdCategory[]) => void = () => {}
    vi.mocked(service.listCategories).mockReturnValue(new Promise((resolve) => (finish = resolve)))
    const state = await load()

    const first = state.refresh()
    expect(state.isLoading.value).toBe(true)
    await state.ensureLoaded()
    finish([])
    await first

    expect(service.listCategories).toHaveBeenCalledTimes(1)
  })

  it('keeps the error message when loading fails', async () => {
    vi.mocked(service.listCategories).mockRejectedValue(new Error('db gone'))
    const state = await load()
    await state.refresh()
    expect(state.error.value).toBe('db gone')
    expect(state.isLoading.value).toBe(false)
  })

  it('reloads after add and update, returning the new id', async () => {
    vi.mocked(service.listCategories).mockResolvedValue([])
    vi.mocked(service.createCategory).mockResolvedValue(7)
    const state = await load()

    await expect(state.addCategory(input)).resolves.toBe(7)
    await state.updateCategory(7, input)

    expect(service.updateCategory).toHaveBeenCalledWith(7, input)
    expect(service.listCategories).toHaveBeenCalledTimes(2)
    expect(refreshObjects).not.toHaveBeenCalled()
  })

  it('rethrows add errors without reloading', async () => {
    vi.mocked(service.createCategory).mockRejectedValue(new Error('duplicate'))
    const state = await load()
    await expect(state.addCategory(input)).rejects.toThrow('duplicate')
    expect(service.listCategories).not.toHaveBeenCalled()
  })

  it('reloads categories and objects after a delete', async () => {
    vi.mocked(service.listCategories).mockResolvedValue([])
    const state = await load()
    await state.deleteCategory(3, { deleteObjects: true })

    expect(service.deleteCategory).toHaveBeenCalledWith(3, { deleteObjects: true })
    expect(service.listCategories).toHaveBeenCalledTimes(1)
    expect(refreshObjects).toHaveBeenCalledTimes(1)
  })

  it('also reloads both lists when the delete fails halfway, then rethrows', async () => {
    vi.mocked(service.listCategories).mockResolvedValue([])
    vi.mocked(service.deleteCategory).mockRejectedValue(new Error('gone'))
    const state = await load()

    await expect(state.deleteCategory(3, { deleteObjects: false })).rejects.toThrow('gone')
    expect(service.listCategories).toHaveBeenCalledTimes(1)
    expect(refreshObjects).toHaveBeenCalledTimes(1)
  })
})
