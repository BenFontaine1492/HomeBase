import '@mdi/font/css/materialdesignicons.css'
import 'vuetify/styles'
import { createVuetify } from 'vuetify'
import { de, en } from 'vuetify/locale'
import { homeBaseDark, homeBaseLight } from './themes'

/*
 * App.vue picks the theme from the setting in Settings → General (light / dark / as the
 * system), and Vuetify's locale and the date fields' locale from the language and format
 * settings. Custom CSS uses the theme variables (`rgb(var(--v-theme-…))`), so it follows
 * the theme; dashboard charts read their colours from the current theme too.
 */

/** Text fields, selects and the like: outlined, 40 px high (the control height of the app). */
const FIELD_DEFAULTS = { variant: 'outlined', density: 'compact', color: 'primary' } as const

export const vuetify = createVuetify({
  theme: {
    defaultTheme: 'homeBaseLight',
    themes: { homeBaseLight, homeBaseDark },
  },
  locale: { locale: 'en', fallback: 'en', messages: { en, de } },
  icons: { defaultSet: 'mdi' },
  defaults: {
    // The outlined variant is the Windows "standard" button (styled in main.css);
    // `color="primary" variant="flat"` is the accent button, `variant="text"` the subtle one.
    VBtn: { variant: 'outlined' },
    VBtnToggle: { variant: 'outlined', density: 'comfortable', divided: true, color: 'primary' },
    VCard: { rounded: 'lg', elevation: 0, border: true },
    VTextField: FIELD_DEFAULTS,
    VTextarea: FIELD_DEFAULTS,
    VSelect: FIELD_DEFAULTS,
    VCombobox: FIELD_DEFAULTS,
    VAutocomplete: FIELD_DEFAULTS,
    VDateInput: FIELD_DEFAULTS,
    VCheckbox: { color: 'primary' },
    VRadio: { color: 'primary' },
    VSwitch: { color: 'primary', inset: true },
    VAlert: { variant: 'tonal' },
    VTabs: { sliderColor: 'primary' },
  },
})
