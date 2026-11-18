import { execute, select, transaction, type SqlStatement } from '@/infrastructure/database'
import type { SettingValue, StoredSetting } from '@/types/settings'

/** Every stored setting (keys without a row use their default). */
export function findAll(): Promise<StoredSetting[]> {
  return select<StoredSetting>('SELECT key, value FROM settings ORDER BY key')
}

/** The statement that stores a setting, or removes it (back to the default) when its value is null. */
function writeStatement(setting: SettingValue): SqlStatement {
  if (setting.value === null) return { sql: 'DELETE FROM settings WHERE key = $1', params: [setting.key] }
  return {
    sql: `INSERT INTO settings (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')`,
    params: [setting.key, setting.value],
  }
}

/** Stores a setting, or removes it (back to the default) when its value is null. */
export async function write(setting: SettingValue): Promise<void> {
  const { sql, params } = writeStatement(setting)
  await execute(sql, params)
}

/** Writes several settings in one transaction: all of them, or none. */
export async function writeAll(settings: readonly SettingValue[]): Promise<void> {
  await transaction(settings.map(writeStatement))
}
