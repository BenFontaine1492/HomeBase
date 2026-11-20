<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch, watchEffect } from 'vue'
import { useRoute } from 'vue-router'
import { useLocale, useTheme } from 'vuetify'
import AppSidebar from '@/components/layout/AppSidebar.vue'
import { useNotifications } from '@/composables/useNotifications'
import { useSettings } from '@/composables/useSettings'
import { formatPreferences, LANGUAGES } from '@/i18n'
import { vuetify } from '@/plugins/vuetify'
import { pageTitle } from '@/router'

const { settings, ensureLoaded } = useSettings()
const { queue: notifications } = useNotifications()
const theme = useTheme()
const vuetifyLocale = useLocale()
const route = useRoute()

/** The operating system's light/dark setting, for the theme 'system'. */
const darkQuery = window.matchMedia('(prefers-color-scheme: dark)')
const systemPrefersDark = ref(darkQuery.matches)

function onSystemThemeChange(event: MediaQueryListEvent): void {
  systemPrefersDark.value = event.matches
}

watchEffect(() => {
  const preference = settings.value.theme
  const dark = preference === 'dark' || (preference === 'system' && systemPrefersDark.value)
  void theme.change(dark ? 'homeBaseDark' : 'homeBaseLight')
})

// Vuetify's own texts (e.g. "No data available") follow the app language.
watchEffect(() => {
  vuetifyLocale.current.value = formatPreferences.language
})

// Date fields type and show dates in the number and date format (Settings → General), not in the
// format of the app language: Vuetify maps its locale to the date locale. New date fields use it.
watchEffect(() => {
  const dateLocale = formatPreferences.locale ?? new Intl.DateTimeFormat().resolvedOptions().locale
  for (const language of LANGUAGES) vuetify.date.options.locale[language] = dateLocale
})

// The window title follows the page and the language.
watch(
  () => [route.fullPath, formatPreferences.language],
  () => {
    document.title = pageTitle(route)
  },
  { immediate: true },
)

onMounted(() => {
  darkQuery.addEventListener('change', onSystemThemeChange)
  void ensureLoaded()
})

onBeforeUnmount(() => {
  darkQuery.removeEventListener('change', onSystemThemeChange)
})
</script>

<template>
  <v-app>
    <AppSidebar />
    <v-main>
      <div class="app-layer">
        <div class="page-container">
          <router-view />
        </div>
      </div>
    </v-main>
    <!-- Confirmations after an action (useNotifications), bottom right like Windows notifications. -->
    <v-snackbar-queue
      v-model="notifications"
      location="bottom end"
      color="surface"
      prepend-icon="mdi-check-circle-outline"
      :timeout="4000"
    />
  </v-app>
</template>
