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

const input: CostInput = {
  paidDate: '2026-03-02',
  amountCents: 500_00,
  category: ' Handwerkerleistungen ',
  description: 'Painter',
}
const missing = new MissingReferenceError('FOREIGN KEY constraint failed')

describe('maintenance costs', () => {
  it('updates only the details', async () => {
    vi.mocked(repository.updateDetails).mockResolvedValue(true)
    await service.updateCostDetails(5, { ...input, description: '' })
    const values = vi.mocked(repository.updateDetails).mock.calls[0]?.[1]
    expect(values).toBeInstanceOf(CostDetailsValues)
    expect(values).toMatchObject({ description: null, category: 'Handwerkerleistungen' })
  })

  it('reports a deleted cost', async () => {
    vi.mocked(repository.updateDetails).mockResolvedValue(false)
    await expect(service.updateCostDetails(5, input)).rejects.toThrow('This cost no longer exists.')
  })
})

describe('costs', () => {
  it('lists the costs', async () => {
    vi.mocked(repository.findAll).mockResolvedValue([])
    await expect(service.listCosts()).resolves.toEqual([])
  })

  it('creates a cost from validated values', async () => {
    vi.mocked(repository.insert).mockResolvedValue(5)
    await expect(service.createCost(input)).resolves.toBe(5)
    const values = vi.mocked(repository.insert).mock.calls[0]?.[0]
    expect(values).toBeInstanceOf(CostValues)
    expect(values?.category).toBe('Handwerkerleistungen')
  })

  it('rejects invalid input before writing', async () => {
    await expect(service.createCost({ ...input, description: '' })).rejects.toThrow('A cost needs a description.')
    expect(repository.insert).not.toHaveBeenCalled()
  })

  it('reports a deleted reference', async () => {
    const message = 'The selected object or investment no longer exists.'
    vi.mocked(repository.insert).mockRejectedValue(missing)
    await expect(service.createCost(input)).rejects.toThrow(message)
    vi.mocked(repository.update).mockRejectedValue(missing)
    await expect(service.updateCost(5, input)).rejects.toThrow(message)
  })

  it('updates and deletes, or reports a deleted cost', async () => {
    vi.mocked(repository.update).mockResolvedValue(true)
    await service.updateCost(5, input)
    vi.mocked(repository.update).mockResolvedValue(false)
    await expect(service.updateCost(5, input)).rejects.toThrow('This cost no longer exists.')
    vi.mocked(repository.remove).mockResolvedValue(true)
    await service.deleteCost(5)
    vi.mocked(repository.remove).mockResolvedValue(false)
    await expect(service.deleteCost(5)).rejects.toThrow('This cost no longer exists.')
  })
})
