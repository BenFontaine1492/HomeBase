import { computed, type ComputedRef } from 'vue'
import { buildRoadmap, type Roadmap } from '@/types/project-roadmap'
import { todayIsoDate } from '@/utils/date'
import { useInvestments } from './useInvestments'
import { useProjects } from './useProjects'
import { useRecurringCosts } from './useRecurringCosts'
import { useRecurringIncome } from './useRecurringIncome'

/*
 * The savings roadmap of the Projects page, computed from the loaded projects,
 * investments and recurring rules: every change to them (an investment marked
 * purchased, a new recurring income, …) recalculates it from today.
 */

const roadmap = computed<Roadmap>(() =>
  buildRoadmap({
    projects: useProjects().projects.value,
    investments: useInvestments().investments.value,
    incomeRules: useRecurringIncome().rules.value,
    costRules: useRecurringCosts().rules.value,
    today: todayIsoDate(),
  }),
)

/** Loads everything the roadmap is calculated from. */
async function ensureLoaded(): Promise<void> {
  await Promise.all([
    useProjects().ensureLoaded(),
    useInvestments().ensureLoaded(),
    useRecurringIncome().ensureLoaded(),
    useRecurringCosts().ensureLoaded(),
  ])
}

export interface UseProjectRoadmap {
  roadmap: ComputedRef<Roadmap>
  ensureLoaded: () => Promise<void>
}

export function useProjectRoadmap(): UseProjectRoadmap {
  return { roadmap, ensureLoaded }
}
