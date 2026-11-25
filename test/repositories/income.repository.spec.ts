import { describe, expect, it, vi } from 'vitest'

vi.mock('@/infrastructure/database', () => ({ select: vi.fn(), execute: vi.fn() }))

import { execute, select } from '@/infrastructure/database'
import * as repository from '@/repositories/income.repository'
import { MissingReferenceError } from '@/repositories/repository-errors'
import { IncomeValues } from '@/types/income'

const values = IncomeValues.from({
  receivedDate: '2026-01-31',
  amountCents: 52_10,
  description: 'Einspeisung',
  payer: 'Netzbetreiber',
  paymentMethod: 'transfer',
  category: 'Photovoltaik',
  householdObjectId: 7,
})
const params = ['2026-01-31', 52_10, 'Einspeisung', 'Netzbetreiber', 'transfer', 'Photovoltaik', null, 7]

describe('findAll', () => {
  it('maps rows to income entries, newest first', async () => {
    vi.mocked(select).mockResolvedValue([
      {
        id: 1,
        received_date: '2026-01-31',
        amount_cents: 100,
        description: 'Miete',
        payer: 'p',
        payment_method: 'cash',
        category: 'c',
        notes: 'n',
        household_object_id: 7,
        recurring_income_id: 3,
        created_at: 'c',
        updated_at: 'u',
      },
    ])
    await expect(repository.findAll()).resolves.toEqual([
      {
        id: 1,
        receivedDate: '2026-01-31',
        amountCents: 100,
        description: 'Miete',
        payer: 'p',
        paymentMethod: 'cash',
        category: 'c',
        notes: 'n',
        householdObjectId: 7,
        recurringIncomeId: 3,
        createdAt: 'c',
        updatedAt: 'u',
      },
    ])
    expect(vi.mocked(select).mock.calls[0]?.[0]).toContain('ORDER BY received_date DESC')
  })
})

describe('writes', () => {
  it('inserts an entry and returns its id', async () => {
    vi.mocked(execute).mockResolvedValue({ rowsAffected: 1, lastInsertId: 5 })
    await expect(repository.insert(values)).resolves.toBe(5)
    expect(vi.mocked(execute).mock.calls[0]?.[1]).toEqual(params)
  })

  it('reports a missing object as MissingReferenceError', async () => {
    vi.mocked(execute).mockRejectedValue(new Error('FOREIGN KEY constraint failed'))
    await expect(repository.insert(values)).rejects.toBeInstanceOf(MissingReferenceError)
    await expect(repository.update(5, values)).rejects.toBeInstanceOf(MissingReferenceError)
  })

  it('updates and deletes, reporting whether the entry exists', async () => {
    vi.mocked(execute).mockResolvedValue({ rowsAffected: 1 })
    await expect(repository.update(5, values)).resolves.toBe(true)
    expect(vi.mocked(execute).mock.calls[0]?.[1]).toEqual([...params, 5])
    await expect(repository.remove(5)).resolves.toBe(true)
    vi.mocked(execute).mockResolvedValue({ rowsAffected: 0 })
    await expect(repository.update(5, values)).resolves.toBe(false)
    await expect(repository.remove(5)).resolves.toBe(false)
  })
})
