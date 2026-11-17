import { beforeEach, describe, expect, it, vi } from 'vitest'

const connection = vi.hoisted(() => ({ select: vi.fn(), execute: vi.fn() }))
const get = vi.hoisted(() => vi.fn())
const invoke = vi.hoisted(() => vi.fn())

vi.mock('@tauri-apps/plugin-sql', () => ({ default: { get } }))
vi.mock('@tauri-apps/api/core', () => ({ invoke }))
vi.mock('@/infrastructure/log', () => ({ logError: vi.fn() }))

import { logError } from '@/infrastructure/log'
import { DatabaseError } from '@/infrastructure/database-error'
import { DATABASE_URL, execute, select, transaction } from '@/infrastructure/database'

beforeEach(() => {
  get.mockReturnValue(connection)
})

describe('database', () => {
  it('runs selects with a copy of the parameters on one shared connection', async () => {
    connection.select.mockResolvedValue([{ id: 1 }])
    const params = [1, 'a'] as const

    await expect(select('SELECT $1, $2', params)).resolves.toEqual([{ id: 1 }])
    await select('SELECT 1')

    expect(connection.select).toHaveBeenNthCalledWith(1, 'SELECT $1, $2', [1, 'a'])
    expect(connection.select.mock.calls[0]?.[1]).not.toBe(params)
    expect(connection.select).toHaveBeenNthCalledWith(2, 'SELECT 1', [])
    // The handle is created once (module-level cache) for every call in this file.
    expect(get).toHaveBeenCalledTimes(1)
    expect(get).toHaveBeenCalledWith(DATABASE_URL)
  })

  it('runs writes and returns the query result', async () => {
    connection.execute.mockResolvedValue({ rowsAffected: 1, lastInsertId: 7 })
    await expect(execute('DELETE FROM t WHERE id = $1', [7])).resolves.toEqual({ rowsAffected: 1, lastInsertId: 7 })
    await execute('DELETE FROM t')
    expect(connection.execute).toHaveBeenLastCalledWith('DELETE FROM t', [])
  })

  it('wraps a failed select and logs the SQL without parameter values', async () => {
    connection.select.mockRejectedValue('no such table: t')
    const error = await select('SELECT *\n   FROM t\n  WHERE id = $1 ', [42]).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(DatabaseError)
    expect((error as DatabaseError).operation).toBe('select')
    expect(logError).toHaveBeenCalledWith('Database select failed: no such table: t [SQL: SELECT * FROM t WHERE id = $1]')
    expect(vi.mocked(logError).mock.calls[0]?.[0]).not.toContain('42')
  })

  it('wraps a failed execute', async () => {
    connection.execute.mockRejectedValue(new Error('locked'))
    await expect(execute('UPDATE t SET a = 1')).rejects.toMatchObject({
      name: 'DatabaseError',
      operation: 'execute',
      message: 'Database execute failed: locked',
    })
  })

  it('runs a transaction natively, sending each statement as [sql, params]', async () => {
    invoke.mockResolvedValue([{ rowsAffected: 1, lastInsertId: 3 }, { rowsAffected: 2, lastInsertId: 3 }])
    const params = ['a'] as const

    await expect(
      transaction([
        { sql: 'INSERT INTO t (a) VALUES ($1)', params },
        { sql: 'DELETE FROM u', params: [] },
      ]),
    ).resolves.toEqual([{ rowsAffected: 1, lastInsertId: 3 }, { rowsAffected: 2, lastInsertId: 3 }])

    expect(invoke).toHaveBeenCalledWith('execute_transaction', {
      statements: [
        ['INSERT INTO t (a) VALUES ($1)', ['a']],
        ['DELETE FROM u', []],
      ],
    })
    expect(invoke.mock.calls[0]?.[1].statements[0][1]).not.toBe(params)
  })

  it('wraps a failed transaction and logs all its SQL without parameter values', async () => {
    invoke.mockRejectedValue('UNIQUE constraint failed: t.a')
    const error = await transaction([
      { sql: 'INSERT INTO t (a)\n VALUES ($1)', params: ['secret'] },
      { sql: 'DELETE FROM u', params: [] },
    ]).catch((e: unknown) => e)

    expect(error).toMatchObject({ name: 'DatabaseError', operation: 'transaction' })
    expect(logError).toHaveBeenCalledWith(
      'Database transaction failed: UNIQUE constraint failed: t.a [SQL: INSERT INTO t (a) VALUES ($1); DELETE FROM u]',
    )
    expect(vi.mocked(logError).mock.calls[0]?.[0]).not.toContain('secret')
  })
})
