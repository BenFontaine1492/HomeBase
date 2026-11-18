import * as settingsRepository from '@/repositories/settings.repository'
import { SettingValue, settingsFrom, type AppSettings, type GeneralSettingsInput } from '@/types/settings'

/** The current settings (defaults for anything not stored). */
export async function loadSettings(): Promise<AppSettings> {
  return settingsFrom(await settingsRepository.findAll())
}

/** Sets the "due soon" window of maintenance tasks; null = the default rule. */
export async function setMaintenanceDueSoonDays(days: number | null): Promise<void> {
  await settingsRepository.write(SettingValue.maintenanceDueSoonDays(days))
}

/** Saves Settings → General (language, number format, currency, theme) together. */
export async function saveGeneralSettings(input: GeneralSettingsInput): Promise<void> {
  await settingsRepository.writeAll(SettingValue.general(input))
}
