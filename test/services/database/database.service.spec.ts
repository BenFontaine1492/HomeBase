import { beforeEach, describe, expect, it, vi } from 'vitest'

const connection = vi.hoisted(() => ({ select: vi.fn(), execute: vi.fn() }))
const get = vi.hoisted(() => vi.fn())

vi.mock('@tauri-apps/plugin-sql', () => ({ default: { get } }))
vi.mock('@/services/log.service', () => ({ logError: vi.fn() }))

import { logError } from '@/services/log.service'
import { DatabaseError } from '@/services/database/database-error'
import { DATABASE_URL, execute, select } from '@/services/database/database.service'

beforeEach(() => {
  get.mockReturnValue(connection)
})

describe('database.service', () => {
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
})
