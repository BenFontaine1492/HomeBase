import { reactive, readonly } from 'vue'
import { de } from './messages/de'
import { en, type Messages } from './messages/en'

/*
 * UI texts and number/date/currency preferences (no library: a typed lookup).
 *
 * - Every text lives in messages/en.ts; messages/de.ts must have exactly the same
 *   keys (checked by tsc via the `Messages` type).
 * - `t('common.save')` returns the text in the current language. Keys are typed, so
 *   a typo or a missing text fails `npm run typecheck`.
 * - Placeholders: `{name}`. Plurals: 'one | other' forms, chosen by `params.count`.
 * - The preferences are reactive: templates and computed values that call `t()` or a
 *   formatter update when the language, locale or currency changes (Settings → General).
 */

export const LANGUAGES = ['en', 'de'] as const
export type Language = (typeof LANGUAGES)[number]

export function isLanguage(value: string): value is Language {
  return LANGUAGES.some((language) => language === value)
}

/** A nested message object: leaves are texts. */
interface MessageTree {
  readonly [name: string]: string | MessageTree
}

/** Dotted paths of all texts, e.g. 'common.save'. */
type Leaves<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${Prefix}${K}` : Leaves<T[K], `${Prefix}${K}.`>
}[keyof T & string]

export type MessageKey = Leaves<Messages>
export type MessageParams = Readonly<Record<string, string | number>>

function flatten(tree: MessageTree, prefix = '', into = new Map<string, string>()): Map<string, string> {
  for (const [name, value] of Object.entries(tree)) {
    if (typeof value === 'string') into.set(`${prefix}${name}`, value)
    else flatten(value, `${prefix}${name}.`, into)
  }
  return into
}

const TEXTS: Readonly<Record<Language, Map<string, string>>> = { en: flatten(en), de: flatten(de) }

export interface FormatPreferences {
  language: Language
  /** BCP 47 locale for numbers and dates, e.g. 'de-DE'; undefined = the system's. */
  locale: string | undefined
  /** ISO 4217 code, e.g. 'EUR'. */
  currency: string
}

/** Until the settings are loaded: English, the system's number format, euros. */
const preferences = reactive<FormatPreferences>({ language: 'en', locale: undefined, currency: 'EUR' })

/** The current preferences (reactive, read-only). Changed by `setFormatPreferences`. */
export const formatPreferences: Readonly<FormatPreferences> = readonly(preferences)

export function setFormatPreferences(changes: Partial<FormatPreferences>): void {
  Object.assign(preferences, changes)
}

/** The first of the system's preferred languages HomeBase has, else English. */
export function systemLanguage(preferred: readonly string[]): Language {
  for (const tag of preferred) {
    const base = tag.slice(0, 2).toLowerCase()
    if (isLanguage(base)) return base
  }
  return 'en'
}

/** 'one | other' → the form for `count`; text without forms is returned unchanged. */
function pluralForm(text: string, count: unknown): string {
  const separator = text.indexOf(' | ')
  if (separator < 0 || typeof count !== 'number') return text
  const isOne = new Intl.PluralRules(preferences.language).select(count) === 'one'
  return isOne ? text.slice(0, separator) : text.slice(separator + 3)
}

/** The text of `key` in the current language, with `{placeholders}` filled in. */
export function t(key: MessageKey, params: MessageParams = {}): string {
  // Every language has every key (checked by tsc); unknown keys can only come from a cast.
  const text = TEXTS[preferences.language].get(key) ?? key
  return pluralForm(text, params.count).replace(/\{(\w+)\}/g, (placeholder, name: string) => {
    const value = params[name]
    return value === undefined ? placeholder : String(value)
  })
}
