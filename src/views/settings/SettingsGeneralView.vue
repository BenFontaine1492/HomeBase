<script setup lang="ts">
import { computed, onMounted, reactive, useId } from 'vue'
import ListSection from '@/components/common/ListSection.vue'
import SettingsRow from '@/components/settings/SettingsRow.vue'
import { useAutoSave } from '@/composables/useAutoSave'
import { useNotifications } from '@/composables/useNotifications'
import { useSettings } from '@/composables/useSettings'
import { formatPreferences, LANGUAGES, t, type Language } from '@/i18n'
import {
  CURRENCIES,
  FORMAT_LOCALES,
  THEMES,
  type Currency,
  type FormatLocale,
  type ThemePreference,
} from '@/types/settings'

/** Settings → General: language, number and date format, currency, theme. Each change is saved at once. */

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
const { notify } = useNotifications()
const ids = { language: useId(), format: useId(), currency: useId() }

const form = reactive<FormState>({ language: SYSTEM, formatLocale: SYSTEM, currency: 'EUR', theme: 'system' })

function orNull<T>(choice: Choice<T>): T | null {
  return choice === SYSTEM ? null : choice
}

/** Saves the whole form, as it is when the save starts. */
const { error: saveError, save } = useAutoSave(
  () =>
    store.saveGeneralSettings({
      language: orNull(form.language),
      formatLocale: orNull(form.formatLocale),
      currency: form.currency,
      theme: form.theme,
    }),
  () => notify(t('common.saved')),
)

const languageOptions = computed(() => [
  { title: t('settings.general.systemLanguage'), value: SYSTEM },
  ...LANGUAGES.map((language) => ({ title: LANGUAGE_NAMES[language], value: language })),
])

/** "For example 1.234,56 and 18.11.2026": shown under each format's name. */
function formatExample(locale: string | undefined): string {
  const number = new Intl.NumberFormat(locale, { minimumFractionDigits: 2 }).format(1234.56)
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date())
  return t('settings.general.formatExample', { number, date })
}

/** The name in the UI language, with an example as the item's subtitle (see `item-props`). */
const formatOptions = computed(() => {
  const names = new Intl.DisplayNames([formatPreferences.language], { type: 'language' })
  return [
    { title: t('settings.general.systemFormat'), subtitle: formatExample(undefined), value: SYSTEM },
    ...FORMAT_LOCALES.map((locale) => ({
      title: names.of(locale) ?? locale,
      subtitle: formatExample(locale),
      value: locale,
    })),
  ]
})

/** "Euro (EUR)". */
const currencyOptions = computed(() => {
  const names = new Intl.DisplayNames([formatPreferences.language], { type: 'currency' })
  return CURRENCIES.map((code) => ({ title: `${names.of(code) ?? code} (${code})`, value: code }))
})

// The stored settings, once. Not on every reload: a save reloads them, and a reset
// then could undo a change made meanwhile.
onMounted(async () => {
  await store.ensureLoaded()
  const { language, formatLocale, currency, theme } = store.settings.value
  Object.assign(form, {
    language: language ?? SYSTEM,
    formatLocale: formatLocale ?? SYSTEM,
    currency,
    theme,
  } satisfies FormState)
})
</script>

<template>
  <div class="hb-sections">
    <v-alert v-if="store.error.value" type="error" density="compact">
      {{ t('settings.loadError', { error: store.error.value }) }}
    </v-alert>
    <v-alert v-if="saveError" type="error" density="compact">{{ saveError }}</v-alert>

    <ListSection :title="t('settings.general.languageTitle')" :subtitle="t('settings.general.languageText')">
      <SettingsRow :title="t('settings.general.language')" :label-for="ids.language">
        <v-select
          :id="ids.language"
          v-model="form.language"
          :items="languageOptions"
          hide-details
          class="settings-control"
          @update:model-value="save"
        />
      </SettingsRow>
      <SettingsRow :title="t('settings.general.format')" :label-for="ids.format">
        <v-select
          :id="ids.format"
          v-model="form.formatLocale"
          :items="formatOptions"
          item-props
          hide-details
          class="settings-control"
          @update:model-value="save"
        />
      </SettingsRow>
    </ListSection>

    <ListSection :title="t('settings.general.currencyTitle')" :subtitle="t('settings.general.currencyText')">
      <SettingsRow :title="t('settings.general.currency')" :label-for="ids.currency">
        <v-select
          :id="ids.currency"
          v-model="form.currency"
          :items="currencyOptions"
          hide-details
          class="settings-control"
          @update:model-value="save"
        />
      </SettingsRow>
    </ListSection>

    <ListSection :title="t('settings.general.themeTitle')" :subtitle="t('settings.general.themeText')">
      <SettingsRow :title="t('settings.general.theme')">
        <v-btn-toggle
          v-model="form.theme"
          mandatory
          v-bind="{ 'aria-label': t('settings.general.theme') }"
          @update:model-value="save"
        >
          <v-btn v-for="theme in THEMES" :key="theme" :value="theme" :prepend-icon="THEME_ICONS[theme]">
            {{ t(`settings.general.themes.${theme}`) }}
          </v-btn>
        </v-btn-toggle>
      </SettingsRow>
    </ListSection>
  </div>
</template>

<style scoped>
.settings-control {
  width: 280px;
  max-width: 100%;
}
</style>
