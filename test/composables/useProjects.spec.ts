import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Project } from '@/types/project'

// Hoisted so the same mocks are returned after vi.resetModules().
const service = vi.hoisted(() => ({
  listProjects: vi.fn(),
  createProject: vi.fn(),
  updateProject: vi.fn(),
  reorderProjects: vi.fn(),
  deleteProject: vi.fn(),
}))
vi.mock('@/services/project.service', () => service)

const investments = vi.hoisted(() => ({ refresh: vi.fn() }))
vi.mock('@/composables/useInvestments', () => ({ useInvestments: () => investments }))

function project(id: number, sortOrder: number): Project {
  return { id, name: `#${id}`, description: null, sortOrder, createdAt: '', updatedAt: '' }
}

/** Fresh module-level state for every test. */
async function load() {
  vi.resetModules()
  const { useProjects } = await import('@/composables/useProjects')
  return useProjects()
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('useProjects', () => {
  it('loads once and keeps the projects in their order', async () => {
    vi.mocked(service.listProjects).mockResolvedValue([project(1, 2), project(2, 1)])
    const state = await load()

    await state.ensureLoaded()
    await state.ensureLoaded()

    expect(service.listProjects).toHaveBeenCalledTimes(1)
    expect(state.projects.value.map(({ id }) => id)).toEqual([2, 1])
    expect(state.isLoading.value).toBe(false)
    expect(state.error.value).toBeNull()
  })

  it('does not start a second load while one is running', async () => {
    let finish: (rows: Project[]) => void = () => {}
    vi.mocked(service.listProjects).mockReturnValue(new Promise((resolve) => (finish = resolve)))
    const state = await load()

    const first = state.refresh()
    await state.ensureLoaded()
    finish([])
    await first

    expect(service.listProjects).toHaveBeenCalledTimes(1)
  })

  it('keeps the error message when loading fails', async () => {
    vi.mocked(service.listProjects).mockRejectedValueOnce(new Error('db gone')).mockResolvedValue([])
    const state = await load()

    await state.ensureLoaded()
    expect(state.error.value).toBe('db gone')

    await state.ensureLoaded()
    expect(state.error.value).toBeNull()
  })

  it('reloads after every write and returns the id of a new project', async () => {
    vi.mocked(service.listProjects).mockResolvedValue([])
    vi.mocked(service.createProject).mockResolvedValue(5)
    const state = await load()
    const input = { name: 'House' }

    await expect(state.addProject(input)).resolves.toBe(5)
    await state.updateProject(5, input)

    expect(service.createProject).toHaveBeenCalledWith(input)
    expect(service.updateProject).toHaveBeenCalledWith(5, input)
    expect(service.listProjects).toHaveBeenCalledTimes(2)
  })

  it('reloads the investments too after deleting a project', async () => {
    vi.mocked(service.listProjects).mockResolvedValue([])
    const state = await load()

    await state.deleteProject(3)

    expect(service.deleteProject).toHaveBeenCalledWith(3)
    expect(service.listProjects).toHaveBeenCalledTimes(1)
    expect(investments.refresh).toHaveBeenCalledTimes(1)
  })

  it('moves a project, saving the new order only when it changed', async () => {
    vi.mocked(service.listProjects).mockResolvedValue([project(1, 1), project(2, 2), project(3, 3)])
    const state = await load()
    await state.ensureLoaded()

    await state.moveProject(1, 0)
    expect(service.reorderProjects).not.toHaveBeenCalled()

    await state.moveProject(3, 0)
    expect(service.reorderProjects).toHaveBeenCalledWith([3, 1, 2])
    expect(service.listProjects).toHaveBeenCalledTimes(2)
  })

  it('reloads and rethrows when saving the order fails', async () => {
    vi.mocked(service.listProjects).mockResolvedValue([project(1, 1), project(2, 2)])
    vi.mocked(service.reorderProjects).mockRejectedValue(new Error('locked'))
    const state = await load()
    await state.ensureLoaded()

    await expect(state.moveProject(2, 0)).rejects.toThrow('locked')
    expect(service.listProjects).toHaveBeenCalledTimes(2)
  })
})
