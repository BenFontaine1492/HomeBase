import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import type { Investment } from '@/types/investment'
import type { Project } from '@/types/project'
import type { AmountRule } from '@/types/project-roadmap'

// Hoisted so the same mocks are returned after vi.resetModules().
const stores = vi.hoisted(() => ({
  projects: { ensureLoaded: vi.fn() },
  investments: { ensureLoaded: vi.fn() },
  income: { ensureLoaded: vi.fn() },
  costs: { ensureLoaded: vi.fn() },
}))
const state = {
  projects: ref<Project[]>([]),
  investments: ref<Investment[]>([]),
  incomeRules: ref<AmountRule[]>([]),
  costRules: ref<AmountRule[]>([]),
}
vi.mock('@/composables/useProjects', () => ({
  useProjects: () => ({ ...stores.projects, projects: state.projects }),
}))
vi.mock('@/composables/useInvestments', () => ({
  useInvestments: () => ({ ...stores.investments, investments: state.investments }),
}))
vi.mock('@/composables/useRecurringIncome', () => ({
  useRecurringIncome: () => ({ ...stores.income, rules: state.incomeRules }),
}))
vi.mock('@/composables/useRecurringCosts', () => ({
  useRecurringCosts: () => ({ ...stores.costs, rules: state.costRules }),
}))

async function load() {
  vi.resetModules()
  const { useProjectRoadmap } = await import('@/composables/useProjectRoadmap')
  return useProjectRoadmap()
}

describe('useProjectRoadmap', () => {
  it('loads everything the roadmap is calculated from', async () => {
    const { ensureLoaded } = await load()
    await ensureLoaded()
    for (const store of Object.values(stores)) expect(store.ensureLoaded).toHaveBeenCalledTimes(1)
  })

  it('recalculates when the loaded data change', async () => {
    const { roadmap } = await load()
    vi.useFakeTimers({ now: new Date('2026-11-28T12:00:00') })
    expect(roadmap.value.projects).toEqual([])

    state.projects.value = [{ id: 1, name: 'House', description: null, sortOrder: 1, createdAt: '', updatedAt: '' }]
    state.incomeRules.value = [
      {
        id: 1,
        amountCents: 1000,
        intervalValue: 1,
        intervalUnit: 'month',
        startDate: '2026-12-01',
        endDate: null,
        nextDueDate: '2026-12-01',
        autopay: false,
      },
    ]
    state.investments.value = [
      {
        id: 1,
        projectId: 1,
        title: 'Walls',
        description: null,
        estimatedCostCents: 1500,
        priority: 'high',
        sortOrder: 1,
        status: 'planned',
        purchasedDate: null,
        targetDate: null,
        budgetCents: null,
        savedCents: null,
        createdAt: '',
        updatedAt: '',
      },
    ]

    expect(roadmap.value.projects[0]?.date).toBe('2027-01-01')
    expect(roadmap.value.hasRecurring).toBe(true)
    vi.useRealTimers()
  })
})
