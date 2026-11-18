<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch, watchEffect } from 'vue'
import { useRoute } from 'vue-router'
import { useLocale, useTheme } from 'vuetify'
import AppSidebar from '@/components/layout/AppSidebar.vue'
import { useSettings } from '@/composables/useSettings'
import { formatPreferences } from '@/i18n'
import { pageTitle } from '@/router'

const { settings, ensureLoaded } = useSettings()
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
      <div class="page-container">
        <router-view />
      </div>
    </v-main>
  </v-app>
</template>
