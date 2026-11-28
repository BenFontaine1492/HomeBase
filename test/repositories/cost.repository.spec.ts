import { describe, expect, it, vi } from 'vitest'

vi.mock('@/infrastructure/database', () => ({ select: vi.fn(), execute: vi.fn() }))

import { execute, select } from '@/infrastructure/database'
import * as repository from '@/repositories/cost.repository'
import { MissingReferenceError } from '@/repositories/repository-errors'
import { CostValues } from '@/types/cost'
import { CostDetailsValues } from '@/types/cost-details'

const values = CostValues.from({
  paidDate: '2026-03-02',
  amountCents: 500_00,
  category: 'Handwerkerleistungen',
  description: 'Painter',
  payee: 'Müller',
  paymentMethod: 'transfer',
  notes: null,
  householdObjectId: 7,
})
const params = ['2026-03-02', 500_00, 'Handwerkerleistungen', 'Painter', 'Müller', 'transfer', null, 7, null]

describe('findAll', () => {
  it('maps rows to costs, with the resolved object', async () => {
    vi.mocked(select).mockResolvedValue([
      {
        id: 1,
        paid_date: '2026-01-01',
        amount_cents: 100,
        category: 'Wartung',
        description: null,
        payee: 'p',
        payment_method: 'cash',
        notes: 'n',
        household_object_id: null,
        maintenance_record_id: 4,
        investment_id: null,
        recurring_cost_id: 6,
        object_id: 7,
        created_at: 'c',
        updated_at: 'u',
      },
    ])
    await expect(repository.findAll()).resolves.toEqual([
      {
        id: 1,
        paidDate: '2026-01-01',
        amountCents: 100,
        category: 'Wartung',
        description: null,
        payee: 'p',
        paymentMethod: 'cash',
        notes: 'n',
        householdObjectId: null,
        maintenanceRecordId: 4,
        investmentId: null,
        recurringCostId: 6,
        objectId: 7,
        createdAt: 'c',
        updatedAt: 'u',
      },
    ])
    expect(vi.mocked(select).mock.calls[0]?.[0]).toContain('LEFT JOIN maintenance_records')
  })
})

describe('writes', () => {
  it('inserts a cost and returns its id', async () => {
    vi.mocked(execute).mockResolvedValue({ rowsAffected: 1, lastInsertId: 5 })
    await expect(repository.insert(values)).resolves.toBe(5)
    expect(vi.mocked(execute).mock.calls[0]?.[1]).toEqual(params)
  })

  it('reports a missing reference as MissingReferenceError', async () => {
    vi.mocked(execute).mockRejectedValue(new Error('FOREIGN KEY constraint failed'))
    await expect(repository.insert(values)).rejects.toBeInstanceOf(MissingReferenceError)
    await expect(repository.update(5, values)).rejects.toBeInstanceOf(MissingReferenceError)
  })

  it('updates the details of a maintenance cost', async () => {
    const details = CostDetailsValues.from({ category: 'Wartung', notes: 'n' })
    vi.mocked(execute).mockResolvedValue({ rowsAffected: 1 })
    await expect(repository.updateDetails(5, details)).resolves.toBe(true)
    expect(vi.mocked(execute).mock.calls[0]?.[1]).toEqual(['Wartung', null, null, 'n', 5])
    vi.mocked(execute).mockResolvedValue({ rowsAffected: 0 })
    await expect(repository.updateDetails(5, details)).resolves.toBe(false)
  })

  it('updates and deletes, reporting whether the cost exists', async () => {
    vi.mocked(execute).mockResolvedValue({ rowsAffected: 1 })
    await expect(repository.update(5, values)).resolves.toBe(true)
    expect(vi.mocked(execute).mock.calls[0]?.[1]).toEqual([...params, 5])
    await expect(repository.remove(5)).resolves.toBe(true)
    vi.mocked(execute).mockResolvedValue({ rowsAffected: 0 })
    await expect(repository.update(5, values)).resolves.toBe(false)
    await expect(repository.remove(5)).resolves.toBe(false)
  })
})
