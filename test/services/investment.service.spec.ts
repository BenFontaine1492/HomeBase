import { describe, expect, it, vi } from 'vitest'

vi.mock('@/repositories/investment.repository', () => ({
  findAll: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  reorder: vi.fn(),
  remove: vi.fn(),
}))

import * as repository from '@/repositories/investment.repository'
import { MissingReferenceError } from '@/repositories/repository-errors'
import {
  createInvestment,
  deleteInvestment,
  listInvestments,
  markPlanned,
  markPurchased,
  reorderInvestments,
  updateInvestment,
} from '@/services/investment.service'
import { InvestmentOrder, InvestmentValues, type Investment, type InvestmentInput } from '@/types/investment'

const validInput: InvestmentInput = {
  projectId: 2,
  title: '  Heat pump ',
  description: '  Air source ',
  estimatedCostCents: 1_500_000,
  priority: 'high',
}
const validValues = {
  projectId: 2,
  title: 'Heat pump',
  description: 'Air source',
  estimatedCostCents: 1_500_000,
  priority: 'high',
  status: 'planned',
  purchasedDate: null,
  targetDate: null,
  budgetCents: null,
  savedCents: null,
}

const stored: Investment = {
  id: 3,
  projectId: 2,
  title: 'Heat pump',
  description: 'Air source',
  estimatedCostCents: 1_500_000,
  priority: 'high',
  sortOrder: 1,
  status: 'planned',
  purchasedDate: null,
  targetDate: '2027-01-01',
  budgetCents: null,
  savedCents: 10,
  createdAt: '',
  updatedAt: '',
}

describe('listInvestments', () => {
  it('returns the investments from the repository', async () => {
    vi.mocked(repository.findAll).mockResolvedValue([])
    await expect(listInvestments()).resolves.toEqual([])
  })
})

describe('createInvestment', () => {
  it('stores trimmed values and returns the new id', async () => {
    vi.mocked(repository.insert).mockResolvedValue(9)
    await expect(createInvestment(validInput)).resolves.toBe(9)
    expect(repository.insert).toHaveBeenCalledWith(validValues)
  })

  it('passes a validated value object to the repository', async () => {
    vi.mocked(repository.insert).mockResolvedValue(1)
    await createInvestment(validInput)
    expect(vi.mocked(repository.insert).mock.calls[0]?.[0]).toBeInstanceOf(InvestmentValues)
  })

  it('rejects invalid input without touching the database', async () => {
    await expect(createInvestment({ ...validInput, title: ' ' })).rejects.toThrow('An investment needs a title.')
    await expect(updateInvestment(1, { ...validInput, title: ' ' })).rejects.toThrow('An investment needs a title.')
    expect(repository.insert).not.toHaveBeenCalled()
    expect(repository.update).not.toHaveBeenCalled()
  })
})

describe('updateInvestment', () => {
  it('updates the investment by id', async () => {
    vi.mocked(repository.update).mockResolvedValue(true)
    await updateInvestment(4, validInput)
    expect(repository.update).toHaveBeenCalledWith(4, validValues)
  })

  it('fails when the investment no longer exists', async () => {
    vi.mocked(repository.update).mockResolvedValue(false)
    await expect(updateInvestment(4, validInput)).rejects.toThrow('This investment no longer exists.')
  })

  it('says so when the project was deleted meanwhile', async () => {
    vi.mocked(repository.insert).mockRejectedValue(new MissingReferenceError(new Error('FOREIGN KEY')))
    vi.mocked(repository.update).mockRejectedValue(new MissingReferenceError(new Error('FOREIGN KEY')))
    await expect(createInvestment(validInput)).rejects.toThrow('The selected project no longer exists.')
    await expect(updateInvestment(4, validInput)).rejects.toThrow('The selected project no longer exists.')
  })
})

describe('markPurchased / markPlanned', () => {
  it('changes only the status and the purchase date', async () => {
    vi.mocked(repository.update).mockResolvedValue(true)
    await markPurchased(stored, '2026-11-18')
    expect(repository.update).toHaveBeenLastCalledWith(3, {
      ...validValues,
      status: 'purchased',
      purchasedDate: '2026-11-18',
      targetDate: '2027-01-01',
      savedCents: 10,
    })

    await markPlanned({ ...stored, status: 'purchased', purchasedDate: '2026-11-18' })
    expect(repository.update).toHaveBeenLastCalledWith(3, { ...validValues, targetDate: '2027-01-01', savedCents: 10 })
  })
})

describe('reorderInvestments', () => {
  it('passes the validated order to the repository', async () => {
    await reorderInvestments([2, 1])
    const order = vi.mocked(repository.reorder).mock.calls[0]?.[0]
    expect(order).toBeInstanceOf(InvestmentOrder)
    expect(order?.ids).toEqual([2, 1])
  })

  it('rejects an invalid order', async () => {
    await expect(reorderInvestments([1, 1])).rejects.toThrow('Invalid order of the investments.')
    expect(repository.reorder).not.toHaveBeenCalled()
  })
})

describe('deleteInvestment', () => {
  it('deletes the investment by id', async () => {
    vi.mocked(repository.remove).mockResolvedValue(true)
    await deleteInvestment(2)
    expect(repository.remove).toHaveBeenCalledWith(2)
  })

  it('fails when the investment no longer exists', async () => {
    vi.mocked(repository.remove).mockResolvedValue(false)
    await expect(deleteInvestment(2)).rejects.toThrow('This investment no longer exists.')
  })
})
