import { execute, select } from '@/infrastructure/database'
import type { SettingValue, StoredSetting } from '@/types/settings'

/** Every stored setting (keys without a row use their default). */
export function findAll(): Promise<StoredSetting[]> {
  return select<StoredSetting>('SELECT key, value FROM settings ORDER BY key')
}

/** Stores a setting, or removes it (back to the default) when its value is null. */
export async function write(setting: SettingValue): Promise<void> {
  if (setting.value === null) {
    await execute('DELETE FROM settings WHERE key = $1', [setting.key])
    return
  }
  await execute(
    `INSERT INTO settings (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')`,
    [setting.key, setting.value],
  )
}
