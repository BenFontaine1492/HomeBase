import { describe, expect, it, vi } from 'vitest'

vi.mock('@/repositories/investment.repository', () => ({
  findAll: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}))

import * as repository from '@/repositories/investment.repository'
import { createInvestment, deleteInvestment, listInvestments, updateInvestment } from '@/services/investment.service'
import { InvestmentValues, type InvestmentInput } from '@/types/investment'

const validInput: InvestmentInput = { title: '  Heat pump ', description: '  Air source ', estimatedCostCents: 1_500_000, priority: 'high' }
const validValues = { title: 'Heat pump', description: 'Air source', estimatedCostCents: 1_500_000, priority: 'high' }

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
