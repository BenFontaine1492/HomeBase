<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useSettings } from '@/composables/useSettings'
import { formatPreferences, LANGUAGES, t, type Language } from '@/i18n'
import {
  CURRENCIES,
  FORMAT_LOCALES,
  THEMES,
  type Currency,
  type FormatLocale,
  type GeneralSettingsInput,
  type ThemePreference,
} from '@/types/settings'
import { describeError } from '@/utils/error'

/** Settings → General: language, number and date format, currency, theme. */

/** v-select can't hold null as a value: 'system' stands for "as the system". */
const SYSTEM = 'system'
type Choice<T> = T | typeof SYSTEM

interface FormState {
  language: Choice<Language>
  formatLocale: Choice<FormatLocale>
  currency: Currency
  theme: ThemePreference
}

/** Language names are shown in their own language. */
const LANGUAGE_NAMES: Readonly<Record<Language, string>> = { en: 'English', de: 'Deutsch' }

const THEME_ICONS: Readonly<Record<ThemePreference, string>> = {
  system: 'mdi-theme-light-dark',
  light: 'mdi-white-balance-sunny',
  dark: 'mdi-weather-night',
}

const store = useSettings()

const form = reactive<FormState>({ language: SYSTEM, formatLocale: SYSTEM, currency: 'EUR', theme: 'system' })
const isSaving = ref(false)
const status = ref<{ type: 'success' | 'error'; text: string } | null>(null)

const languageOptions = computed(() => [
  { title: t('settings.general.systemLanguage'), value: SYSTEM },
  ...LANGUAGES.map((language) => ({ title: LANGUAGE_NAMES[language], value: language })),
])

/** "German (Germany) · 1.234,56 · 18.11.2026": the name in the UI language plus an example. */
function formatExample(locale: string | undefined): string {
  const number = new Intl.NumberFormat(locale, { minimumFractionDigits: 2 }).format(1234.56)
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date())
  return `${number} · ${date}`
}

const formatOptions = computed(() => {
  const names = new Intl.DisplayNames([formatPreferences.language], { type: 'language' })
  return [
    { title: `${t('settings.general.systemFormat')} · ${formatExample(undefined)}`, value: SYSTEM },
    ...FORMAT_LOCALES.map((locale) => ({
      title: `${names.of(locale) ?? locale} · ${formatExample(locale)}`,
      value: locale,
    })),
  ]
})

const currencyOptions = computed(() => {
  const names = new Intl.DisplayNames([formatPreferences.language], { type: 'currency' })
  return CURRENCIES.map((code) => ({ title: `${code} · ${names.of(code) ?? code}`, value: code }))
})

/** Shows the stored settings. */
function resetForm(): void {
  const { language, formatLocale, currency, theme } = store.settings.value
  Object.assign(form, {
    language: language ?? SYSTEM,
    formatLocale: formatLocale ?? SYSTEM,
    currency,
    theme,
  } satisfies FormState)
}

watch(store.settings, resetForm)

function orNull<T>(choice: Choice<T>): T | null {
  return choice === SYSTEM ? null : choice
}

async function save(): Promise<void> {
  if (isSaving.value) return
  isSaving.value = true
  status.value = null
  const input: GeneralSettingsInput = {
    language: orNull(form.language),
    formatLocale: orNull(form.formatLocale),
    currency: form.currency,
    theme: form.theme,
  }
  try {
    await store.saveGeneralSettings(input)
    status.value = { type: 'success', text: t('common.saved') }
  } catch (error) {
    console.error(error)
    status.value = { type: 'error', text: describeError(error) }
  } finally {
    isSaving.value = false
  }
}

onMounted(async () => {
  await store.ensureLoaded()
  resetForm()
})
</script>

<template>
  <v-card class="settings-card">
    <v-alert v-if="store.error.value" type="error" density="compact" class="mb-4">
      {{ t('settings.loadError', { error: store.error.value }) }}
    </v-alert>

    <div class="settings-card__title">{{ t('settings.general.languageTitle') }}</div>
    <p class="settings-card__text">{{ t('settings.general.languageText') }}</p>
    <v-select v-model="form.language" :items="languageOptions" :label="t('settings.general.language')" />
    <v-select v-model="form.formatLocale" :items="formatOptions" :label="t('settings.general.format')" />

    <div class="settings-card__title">{{ t('settings.general.currencyTitle') }}</div>
    <p class="settings-card__text">{{ t('settings.general.currencyText') }}</p>
    <v-select v-model="form.currency" :items="currencyOptions" :label="t('settings.general.currency')" />

    <div class="settings-card__title">{{ t('settings.general.themeTitle') }}</div>
    <p class="settings-card__text">{{ t('settings.general.themeText') }}</p>
    <v-btn-toggle
      v-model="form.theme"
      mandatory
      density="comfortable"
      variant="outlined"
      divided
      rounded="lg"
      color="primary"
      class="mb-6"
    >
      <v-btn v-for="theme in THEMES" :key="theme" :value="theme" :prepend-icon="THEME_ICONS[theme]">
        {{ t(`settings.general.themes.${theme}`) }}
      </v-btn>
    </v-btn-toggle>

    <v-alert v-if="status" :type="status.type" density="compact" class="mb-4">{{ status.text }}</v-alert>

    <div class="d-flex">
      <v-spacer />
      <v-btn color="primary" variant="flat" :loading="isSaving" v-bind="{ onClick: save }">
        {{ t('common.save') }}
      </v-btn>
    </div>
  </v-card>
</template>

<style scoped>
.settings-card {
  padding: 24px;
}

.settings-card__title {
  font-size: 1rem;
  font-weight: 600;
}

.settings-card__text {
  margin: 6px 0 16px;
  font-size: 0.875rem;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}
</style>
