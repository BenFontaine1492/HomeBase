import { describe, expect, it, vi } from 'vitest'

vi.mock('@/repositories/cost.repository', () => ({
  findAll: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  updateDetails: vi.fn(),
  remove: vi.fn(),
}))

import * as repository from '@/repositories/cost.repository'
import { MissingReferenceError } from '@/repositories/repository-errors'
import * as service from '@/services/cost.service'
import { CostValues, type CostInput } from '@/types/cost'
import { CostDetailsValues } from '@/types/cost-details'
import type { TaxCategory } from '@/types/tax-category'

const craft: TaxCategory = { id: 2, name: 'Craft', recordsLabourCost: true, sortOrder: 0, createdAt: '', updatedAt: '' }
const input: CostInput = {
  paidDate: '2026-03-02',
  amountCents: 500_00,
  labourCents: 300_00,
  costType: 'repair',
  description: 'Painter',
  taxCategoryId: 2,
}
const missing = new MissingReferenceError('FOREIGN KEY constraint failed')

describe('maintenance costs', () => {
  it('updates only the details, checking the labour share against the amount', async () => {
    vi.mocked(repository.updateDetails).mockResolvedValue(true)
    await service.updateCostDetails(5, { ...input, description: '' }, craft, 400_00)
    const values = vi.mocked(repository.updateDetails).mock.calls[0]?.[1]
    expect(values).toBeInstanceOf(CostDetailsValues)
    expect(values).toMatchObject({ description: null, labourCents: 300_00 })
    await expect(service.updateCostDetails(5, input, craft, 200_00)).rejects.toThrow(
      'The labour cost must be a non-negative amount of at most the total.',
    )
  })

  it('reports a deleted cost or reference', async () => {
    vi.mocked(repository.updateDetails).mockResolvedValue(false)
    await expect(service.updateCostDetails(5, input, craft, 500_00)).rejects.toThrow('This cost no longer exists.')
    vi.mocked(repository.updateDetails).mockRejectedValue(missing)
    await expect(service.updateCostDetails(5, input, craft, 500_00)).rejects.toThrow(
      'The selected tax category, object or investment no longer exists.',
    )
  })
})

describe('costs', () => {
  it('lists the costs', async () => {
    vi.mocked(repository.findAll).mockResolvedValue([])
    await expect(service.listCosts()).resolves.toEqual([])
  })

  it('creates a cost from validated values, keeping the labour share of the category', async () => {
    vi.mocked(repository.insert).mockResolvedValue(5)
    await expect(service.createCost(input, craft)).resolves.toBe(5)
    const values = vi.mocked(repository.insert).mock.calls[0]?.[0]
    expect(values).toBeInstanceOf(CostValues)
    expect(values?.labourCents).toBe(300_00)
  })

  it('rejects invalid input before writing', async () => {
    await expect(service.createCost({ ...input, description: '' }, craft)).rejects.toThrow(
      'A cost needs a description.',
    )
    expect(repository.insert).not.toHaveBeenCalled()
  })

  it('reports a deleted reference', async () => {
    const message = 'The selected tax category, object or investment no longer exists.'
    vi.mocked(repository.insert).mockRejectedValue(missing)
    await expect(service.createCost(input, craft)).rejects.toThrow(message)
    vi.mocked(repository.update).mockRejectedValue(missing)
    await expect(service.updateCost(5, input, craft)).rejects.toThrow(message)
  })

  it('updates and deletes, or reports a deleted cost', async () => {
    vi.mocked(repository.update).mockResolvedValue(true)
    await service.updateCost(5, input, craft)
    vi.mocked(repository.update).mockResolvedValue(false)
    await expect(service.updateCost(5, input, craft)).rejects.toThrow('This cost no longer exists.')
    vi.mocked(repository.remove).mockResolvedValue(true)
    await service.deleteCost(5)
    vi.mocked(repository.remove).mockResolvedValue(false)
    await expect(service.deleteCost(5)).rejects.toThrow('This cost no longer exists.')
  })
})
