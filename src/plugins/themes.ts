import type { ThemeDefinition } from 'vuetify'

/*
 * HomeBase themes, styled after Windows 11: the sidebar on a grey window background, the
 * pages on a lighter layer, white cards, HomeBase purple as the accent. Kept apart from
 * plugins/vuetify.ts (no CSS imports), so test/plugins/themes.spec.ts can check the contrast.
 *
 * Own colour names: `layer` (the page area next to the sidebar), `control` (standard
 * buttons, see main.css) and `<status>-container` (the background of a status colour, used
 * by status badges and alerts). Every text colour reaches 4.5:1 on the surfaces it is used
 * on, the status colours also on their own container.
 */

export const homeBaseLight: ThemeDefinition = {
  dark: false,
  colors: {
    primary: '#5B47E0',
    'on-primary': '#FFFFFF',
    secondary: '#8E7DF7',
    background: '#F3F3F3',
    layer: '#F9F9F9',
    surface: '#FFFFFF',
    'surface-variant': '#F3F3F3',
    'on-surface-variant': '#616161',
    control: '#FBFBFB',
    'on-control': '#1A1A1A',
    error: '#C42B1C',
    'error-container': '#FDE7E9',
    warning: '#9D5D00',
    'warning-container': '#FFF4CE',
    success: '#0F7B0F',
    'success-container': '#DFF6DD',
    info: '#175CD3',
    'info-container': '#E8F0FC',
  },
  variables: {
    'border-color': '#000000',
    'border-opacity': 0.1,
    'high-emphasis-opacity': 0.9,
    'medium-emphasis-opacity': 0.62,
  },
}

/** Windows' dark greys; the accent and status colours are lighter, so they stay readable on them. */
export const homeBaseDark: ThemeDefinition = {
  dark: true,
  colors: {
    primary: '#9C8CFF',
    'on-primary': '#000000',
    secondary: '#B7AAFF',
    background: '#202020',
    layer: '#272727',
    surface: '#2D2D2D',
    'surface-variant': '#383838',
    'on-surface-variant': '#C5C5C5',
    control: '#373737',
    'on-control': '#FFFFFF',
    error: '#FF99A4',
    'error-container': '#442726',
    warning: '#FCE100',
    'warning-container': '#433519',
    success: '#6CCB5F',
    'success-container': '#393D1B',
    info: '#60A5FA',
    'info-container': '#1F2F4A',
  },
  variables: {
    'border-color': '#FFFFFF',
    'border-opacity': 0.08,
    'high-emphasis-opacity': 1,
    'medium-emphasis-opacity': 0.77,
  },
}
