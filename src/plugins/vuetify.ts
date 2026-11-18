import '@mdi/font/css/materialdesignicons.css'
import 'vuetify/styles'
import { createVuetify, type ThemeDefinition } from 'vuetify'
import { de, en } from 'vuetify/locale'

/**
 * HomeBase themes. App.vue picks one from the setting in Settings → General
 * (light / dark / as the system). Custom CSS uses the theme variables
 * (`rgb(var(--v-theme-…))`), so it follows the theme; dashboard charts read their
 * colours from the current theme too.
 */
const homeBaseLight: ThemeDefinition = {
  dark: false,
  colors: {
    primary: '#5B47E0',
    secondary: '#8E7DF7',
    background: '#F5F5FA',
    surface: '#FFFFFF',
    'surface-variant': '#EEEDF7',
    'on-surface-variant': '#4A4766',
    error: '#E5484D',
    warning: '#F59E0B',
    success: '#12B76A',
    info: '#3E8BF5',
    'priority-high': '#E5484D',
    'priority-medium': '#E08A00',
    'priority-low': '#12B76A',
  },
  variables: {
    'border-color': '#1D1B2F',
    'border-opacity': 0.08,
    'high-emphasis-opacity': 0.92,
    'medium-emphasis-opacity': 0.62,
  },
}

/** Same hues, lighter where they sit on dark surfaces, so text and charts stay readable. */
const homeBaseDark: ThemeDefinition = {
  dark: true,
  colors: {
    primary: '#9C8CFF',
    secondary: '#B7AAFF',
    background: '#121119',
    surface: '#1C1A26',
    'surface-variant': '#2A2738',
    'on-surface-variant': '#C9C5DD',
    error: '#FF6B70',
    warning: '#FBBF24',
    success: '#34D399',
    info: '#60A5FA',
    'priority-high': '#FF6B70',
    'priority-medium': '#FBBF24',
    'priority-low': '#34D399',
  },
  variables: {
    'border-color': '#FFFFFF',
    'border-opacity': 0.1,
    'high-emphasis-opacity': 0.92,
    'medium-emphasis-opacity': 0.68,
  },
}

export const vuetify = createVuetify({
  theme: {
    defaultTheme: 'homeBaseLight',
    themes: { homeBaseLight, homeBaseDark },
  },
  locale: { locale: 'en', fallback: 'en', messages: { en, de } },
  icons: { defaultSet: 'mdi' },
  defaults: {
    VCard: { rounded: 'xl', elevation: 0, border: true },
    VBtn: { rounded: 'lg', elevation: 0 },
    VChip: { rounded: 'lg' },
    VTextField: { variant: 'outlined', density: 'comfortable', rounded: 'lg', color: 'primary' },
    VTextarea: { variant: 'outlined', density: 'comfortable', rounded: 'lg', color: 'primary' },
    VSelect: { variant: 'outlined', density: 'comfortable', rounded: 'lg', color: 'primary' },
    VAlert: { rounded: 'lg', variant: 'tonal' },
  },
})
