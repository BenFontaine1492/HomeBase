import { readonly, ref, type Ref } from 'vue'
import { setFormatPreferences } from '@/i18n'
import {
  loadSettings,
  saveGeneralSettings as storeGeneralSettings,
  setMaintenanceDueSoonDays as saveMaintenanceDueSoonDays,
} from '@/services/settings.service'
import { DEFAULT_SETTINGS, formatPreferencesOf, type AppSettings, type GeneralSettingsInput } from '@/types/settings'
import { describeError } from '@/utils/error'

// Module-level state: shared by every component that calls useSettings().
// Starts with the defaults, so everything works before the settings are loaded.
const settings = ref<AppSettings>({ ...DEFAULT_SETTINGS })
const isLoading = ref(false)
const error = ref<string | null>(null)
let hasLoaded = false

/** Language, number format and currency of the UI follow the settings. */
function applyFormatPreferences(): void {
  setFormatPreferences(formatPreferencesOf(settings.value, navigator.languages))
}

async function refresh(): Promise<void> {
  isLoading.value = true
  error.value = null
  try {
    settings.value = await loadSettings()
    hasLoaded = true
  } catch (cause) {
    console.error(cause)
    error.value = describeError(cause)
  } finally {
    isLoading.value = false
    applyFormatPreferences()
  }
}

async function ensureLoaded(): Promise<void> {
  if (!hasLoaded && !isLoading.value) await refresh()
}

/** null = the default rule. Rethrows so the form can show the error. */
async function setMaintenanceDueSoonDays(days: number | null): Promise<void> {
  await saveMaintenanceDueSoonDays(days)
  await refresh()
}

/** Language, number format, currency and theme. Rethrows so the form can show the error. */
async function saveGeneralSettings(input: GeneralSettingsInput): Promise<void> {
  await storeGeneralSettings(input)
  await refresh()
}

export interface UseSettings {
  settings: Readonly<Ref<Readonly<AppSettings>>>
  isLoading: Readonly<Ref<boolean>>
  error: Readonly<Ref<string | null>>
  refresh: () => Promise<void>
  ensureLoaded: () => Promise<void>
  setMaintenanceDueSoonDays: (days: number | null) => Promise<void>
  saveGeneralSettings: (input: GeneralSettingsInput) => Promise<void>
}

export function useSettings(): UseSettings {
  return {
    settings: readonly(settings),
    isLoading: readonly(isLoading),
    error: readonly(error),
    refresh,
    ensureLoaded,
    setMaintenanceDueSoonDays,
    saveGeneralSettings,
  }
}
