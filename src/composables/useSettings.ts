import { readonly, ref, type Ref } from 'vue'
import { loadSettings, setMaintenanceDueSoonDays as saveMaintenanceDueSoonDays } from '@/services/settings.service'
import { DEFAULT_SETTINGS, type AppSettings } from '@/types/settings'
import { describeError } from '@/utils/error'

// Module-level state: shared by every component that calls useSettings().
// Starts with the defaults, so everything works before the settings are loaded.
const settings = ref<AppSettings>({ ...DEFAULT_SETTINGS })
const isLoading = ref(false)
const error = ref<string | null>(null)
let hasLoaded = false

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

export interface UseSettings {
  settings: Readonly<Ref<Readonly<AppSettings>>>
  isLoading: Readonly<Ref<boolean>>
  error: Readonly<Ref<string | null>>
  refresh: () => Promise<void>
  ensureLoaded: () => Promise<void>
  setMaintenanceDueSoonDays: (days: number | null) => Promise<void>
}

export function useSettings(): UseSettings {
  return {
    settings: readonly(settings),
    isLoading: readonly(isLoading),
    error: readonly(error),
    refresh,
    ensureLoaded,
    setMaintenanceDueSoonDays,
  }
}
