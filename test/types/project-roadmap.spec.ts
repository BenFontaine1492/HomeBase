import { describe, expect, it } from 'vitest'
import type { Investment } from '@/types/investment'
import type { Project } from '@/types/project'
import {
  averageMonthlyNetCents,
  balanceSteps,
  buildRoadmap,
  fundingDates,
  neededCents,
  overviewChart,
  projectChart,
  projectedFlows,
  roadmapNotice,
  type AmountRule,
  type RoadmapInput,
} from '@/types/project-roadmap'

const today = '2026-11-28'

function rule(changes: Partial<AmountRule>): AmountRule {
  return {
    id: 1,
    amountCents: 100,
    intervalValue: 1,
    intervalUnit: 'month',
    startDate: '2026-01-01',
    endDate: null,
    nextDueDate: '2026-12-01',
    autopay: false,
    ...changes,
  }
}

/** The example of the feature: 3,000 € salary on the 25th, 2,000 € costs on the 1st = 1,000 € net a month. */
const salary = rule({ id: 1, amountCents: 300_000, startDate: '2026-01-25', nextDueDate: '2026-12-25' })
const costs = rule({ id: 2, amountCents: 200_000, startDate: '2026-01-01', nextDueDate: '2026-12-01' })

function project(id: number, name: string, sortOrder: number): Project {
  return { id, name, description: null, sortOrder, createdAt: '', updatedAt: '' }
}

function investment(id: number, projectId: number, estimatedCostCents: number, changes: Partial<Investment> = {}) {
  const planned: Investment = {
    id,
    projectId,
    title: `#${id}`,
    description: null,
    estimatedCostCents,
    priority: 'medium',
    sortOrder: id,
    status: 'planned',
    purchasedDate: null,
    targetDate: null,
    budgetCents: null,
    savedCents: null,
    createdAt: '',
    updatedAt: '',
  }
  return { ...planned, ...changes }
}

const house = project(1, 'House', 1)
const car = project(2, 'Car', 2)
const example: RoadmapInput = {
  // Out of order on purpose: the sort order counts.
  projects: [car, house],
  investments: [
    investment(1, 1, 250_000),
    investment(2, 1, 600_000),
    investment(3, 1, 150_000),
    investment(4, 2, 80_000),
    investment(5, 2, 120_000),
    investment(6, 2, 999_999, { status: 'purchased', purchasedDate: '2026-01-01' }),
  ],
  incomeRules: [salary],
  costRules: [costs],
  today,
}

describe('projectedFlows', () => {
  it('nets the payments per day, oldest first, up to the end', () => {
    const flows = projectedFlows([salary], [costs], today, '2027-01-31')
    expect(flows).toEqual([
      { date: '2026-12-01', amountCents: -200_000 },
      { date: '2026-12-25', amountCents: 300_000 },
      { date: '2027-01-01', amountCents: -200_000 },
      { date: '2027-01-25', amountCents: 300_000 },
    ])
  })

  it('adds payments of the same day and counts overdue ones today', () => {
    const overdue = rule({ amountCents: 50, nextDueDate: '2026-10-01' })
    const sameDay = rule({ id: 3, amountCents: 20, startDate: '2026-01-28', nextDueDate: '2026-11-28' })
    expect(projectedFlows([overdue], [sameDay], today, '2026-12-01')).toEqual([
      { date: today, amountCents: 50 + 50 - 20 },
      { date: '2026-12-01', amountCents: 50 },
    ])
  })

  it('stops at the end date of a rule', () => {
    const ending = rule({ endDate: '2027-01-15' })
    expect(projectedFlows([ending], [], today, '2027-12-31').map(({ date }) => date)).toEqual([
      '2026-12-01',
      '2027-01-01',
    ])
  })
})

describe('neededCents', () => {
  it('subtracts the amount saved, never below 0', () => {
    expect(neededCents({ estimatedCostCents: 500, savedCents: null })).toBe(500)
    expect(neededCents({ estimatedCostCents: 500, savedCents: 200 })).toBe(300)
    expect(neededCents({ estimatedCostCents: 500, savedCents: 900 })).toBe(0)
  })
})

describe('fundingDates', () => {
  const flows = [
    { date: '2026-12-01', amountCents: -100 },
    { date: '2026-12-25', amountCents: 300 },
    { date: '2027-01-25', amountCents: 300 },
  ]

  it('dates each amount by the first day the balance covers it and all before it', () => {
    expect(fundingDates(flows, [150, 300], today)).toEqual(['2026-12-25', '2027-01-25'])
  })

  it('dates amounts of 0 today and amounts beyond the flows null', () => {
    expect(fundingDates(flows, [0, 500, 0, 1], today)).toEqual([today, '2027-01-25', '2027-01-25', null])
    expect(fundingDates([], [1], today)).toEqual([null])
  })
})

describe('balanceSteps', () => {
  it('starts at 0 today and adds each day; a payment today changes the first point', () => {
    expect(balanceSteps([{ date: '2026-12-01', amountCents: 5 }], today)).toEqual([
      { date: today, balanceCents: 0 },
      { date: '2026-12-01', balanceCents: 5 },
    ])
    expect(balanceSteps([{ date: today, amountCents: 7 }], today)).toEqual([{ date: today, balanceCents: 7 }])
  })
})

describe('averageMonthlyNetCents', () => {
  it('averages the net of the next 12 months', () => {
    const flows = [
      { date: '2027-01-01', amountCents: 1200 },
      { date: '2027-11-27', amountCents: 1200 },
      { date: '2027-11-28', amountCents: 999_999 },
    ]
    expect(averageMonthlyNetCents(flows, today)).toBe(200)
  })
})

describe('buildRoadmap', () => {
  const roadmap = buildRoadmap(example)

  it('funds the projects in their order, their investments in priority order', () => {
    const [first, second] = roadmap.projects
    expect(first?.project.name).toBe('House')
    expect(first?.investments.map(({ date }) => date)).toEqual(['2027-02-25', '2027-08-25', '2027-09-25'])
    expect(first).toMatchObject({ startDate: today, date: '2027-09-25', totalCents: 1_000_000, neededCents: 1_000_000 })
    expect(second?.investments.map(({ date }) => date)).toEqual(['2027-10-25', '2027-11-25'])
    expect(second).toMatchObject({ startDate: '2027-09-25', date: '2027-11-25', neededCents: 200_000 })
    expect(roadmap.date).toBe('2027-11-25')
  })

  it('dates each project as if it were the only one', () => {
    const [first, second] = roadmap.projects
    expect(first?.aloneDate).toBe('2027-09-25')
    expect(second?.investments.map(({ aloneDate }) => aloneDate)).toEqual(['2026-12-25', '2027-01-25'])
    expect(second?.aloneDate).toBe('2027-01-25')
  })

  it('leaves out purchased investments and subtracts saved amounts', () => {
    const saved = buildRoadmap({ ...example, investments: [investment(1, 2, 150_000, { savedCents: 50_000 })] })
    expect(saved.projects[1]?.investments.map(({ neededCents: cents, date }) => [cents, date])).toEqual([
      [100_000, '2026-12-25'],
    ])
    expect(saved.projects[1]?.totalCents).toBe(150_000)
  })

  it('reports the monthly net, whether anything recurs, and the balance', () => {
    expect(roadmap.monthlyNetCents).toBe(100_000)
    expect(roadmap.hasRecurring).toBe(true)
    expect(roadmap.balance.slice(0, 3)).toEqual([
      { date: today, balanceCents: 0 },
      { date: '2026-12-01', balanceCents: -200_000 },
      { date: '2026-12-25', balanceCents: 100_000 },
    ])
  })

  it('has no dates without recurring payments, and none for a project without investments', () => {
    const empty = buildRoadmap({ ...example, incomeRules: [], costRules: [] })
    expect(empty.hasRecurring).toBe(false)
    expect(empty.projects.map(({ date, aloneDate }) => [date, aloneDate])).toEqual([
      [null, null],
      [null, null],
    ])
    expect(empty.projects[1]?.startDate).toBeNull()
    const nothing = buildRoadmap({ ...example, investments: [] })
    expect(nothing.projects.map(({ startDate, date }) => [startDate, date])).toEqual([
      [today, null],
      [today, null],
    ])
    expect(nothing.date).toBeNull()
  })

  it('stops looking after 30 years', () => {
    const slow = rule({ amountCents: 1, intervalUnit: 'year', startDate: '2026-12-01' })
    const roadmapOfSlow = buildRoadmap({
      ...example,
      incomeRules: [slow],
      costRules: [],
      investments: [investment(1, 1, 31)],
    })
    expect(roadmapOfSlow.projects[0]?.date).toBeNull()
    const justInTime = buildRoadmap({
      ...example,
      incomeRules: [slow],
      costRules: [],
      investments: [investment(1, 1, 30)],
    })
    expect(justInTime.projects[0]?.date).toBe('2055-12-01')
  })
})

describe('overviewChart', () => {
  it('draws a stretch per reachable project and its purchases', () => {
    const chart = overviewChart(buildRoadmap(example), today)
    expect(chart.curve.map(({ title, start, end, colorIndex }) => [title, start, end, colorIndex])).toEqual([
      ['House', today, '2027-09-25', 0],
      ['Car', '2027-09-25', '2027-11-25', 1],
    ])
    expect(chart.curve[1]?.target).toEqual({ kind: 'project', projectId: 2 })
    expect(chart.bars).toBe(chart.curve)
    expect(chart.purchases.map(({ date }) => date)).toEqual([
      '2027-02-25',
      '2027-08-25',
      '2027-09-25',
      '2027-10-25',
      '2027-11-25',
    ])
    expect(chart.purchases[3]).toMatchObject({
      target: { kind: 'investment', projectId: 2, investmentId: 4 },
      title: '#4',
      projectName: 'Car',
      colorIndex: 1,
      neededCents: 80_000,
    })
    expect(chart.today).toBe(today)
  })

  it('leaves out what is not reachable', () => {
    const chart = overviewChart(buildRoadmap({ ...example, incomeRules: [] }), today)
    expect([chart.curve, chart.purchases]).toEqual([[], []])
  })
})

describe('projectChart', () => {
  it('draws one project on its own, a bar per purchase after the one before it', () => {
    const chart = projectChart(buildRoadmap(example), 2, today)
    expect(chart?.curve).toEqual([
      {
        target: { kind: 'project', projectId: 2 },
        title: 'Car',
        colorIndex: 1,
        start: today,
        end: '2027-01-25',
        neededCents: 200_000,
      },
    ])
    expect(chart?.purchases.map(({ date }) => date)).toEqual(['2026-12-25', '2027-01-25'])
    expect(chart?.bars.map(({ title, start, end }) => [title, start, end])).toEqual([
      ['#4', today, '2026-12-25'],
      ['#5', '2026-12-25', '2027-01-25'],
    ])
  })

  it('has no curve when the project is not reachable, and no chart for an unknown project', () => {
    const unreachable = buildRoadmap({ ...example, incomeRules: [] })
    expect(projectChart(unreachable, 1, today)?.curve).toEqual([])
    expect(projectChart(unreachable, 99, today)).toBeNull()
  })
})

describe('roadmapNotice', () => {
  it('says what keeps the roadmap from showing every date', () => {
    expect(roadmapNotice([], true)).toBe('nothing-planned')
    expect(roadmapNotice(['2027-01-01'], false)).toBeNull()
    expect(roadmapNotice(['2027-01-01', null], true)).toBe('not-reachable')
    expect(roadmapNotice([null], false)).toBe('no-recurring')
  })
})
