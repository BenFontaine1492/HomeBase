import { describe, expect, it, vi } from 'vitest'

vi.mock('@/repositories/income.repository', () => ({
  findAll: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}))

import * as repository from '@/repositories/income.repository'
import { MissingReferenceError } from '@/repositories/repository-errors'
import * as service from '@/services/income.service'
import { IncomeValues, type IncomeInput } from '@/types/income'

const input: IncomeInput = {
  receivedDate: '2026-01-31',
  amountCents: 52_10,
  description: 'Einspeisung',
  householdObjectId: 7,
}
const missing = new MissingReferenceError('FOREIGN KEY constraint failed')

describe('income', () => {
  it('lists, creates and updates entries from validated values', async () => {
    vi.mocked(repository.findAll).mockResolvedValue([])
    await expect(service.listIncome()).resolves.toEqual([])
    vi.mocked(repository.insert).mockResolvedValue(4)
    await expect(service.createIncome(input)).resolves.toBe(4)
    expect(vi.mocked(repository.insert).mock.calls[0]?.[0]).toBeInstanceOf(IncomeValues)
    vi.mocked(repository.update).mockResolvedValue(true)
    await service.updateIncome(4, input)
    expect(vi.mocked(repository.update).mock.calls[0]?.[0]).toBe(4)
  })

  it('rejects invalid input before writing', async () => {
    await expect(service.createIncome({ ...input, description: ' ' })).rejects.toThrow(
      'An income entry needs a description.',
    )
    expect(repository.insert).not.toHaveBeenCalled()
  })

  it('reports deleted entries and objects', async () => {
    vi.mocked(repository.update).mockResolvedValue(false)
    await expect(service.updateIncome(4, input)).rejects.toThrow('This income entry no longer exists.')
    vi.mocked(repository.insert).mockRejectedValue(missing)
    await expect(service.createIncome(input)).rejects.toThrow('The selected object no longer exists.')
    vi.mocked(repository.update).mockRejectedValue(missing)
    await expect(service.updateIncome(4, input)).rejects.toThrow('The selected object no longer exists.')
    vi.mocked(repository.remove).mockResolvedValue(true)
    await service.deleteIncome(4)
    vi.mocked(repository.remove).mockResolvedValue(false)
    await expect(service.deleteIncome(4)).rejects.toThrow('This income entry no longer exists.')
  })
})
