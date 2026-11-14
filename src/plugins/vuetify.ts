import '@mdi/font/css/materialdesignicons.css'
import 'vuetify/styles'
import { createVuetify, type ThemeDefinition } from 'vuetify'

/**
 * HomeBase light theme. A dark variant can be added later as a second entry in
 * `themes` and toggled via `useTheme()`.
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

export const vuetify = createVuetify({
  theme: {
    defaultTheme: 'homeBaseLight',
    themes: { homeBaseLight },
  },
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
