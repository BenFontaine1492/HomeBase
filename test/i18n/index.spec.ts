import { afterEach, describe, expect, it } from 'vitest'
import { formatPreferences, isLanguage, setFormatPreferences, systemLanguage, t, type MessageKey } from '@/i18n'
import { de } from '@/i18n/messages/de'
import { en } from '@/i18n/messages/en'

afterEach(() => {
  setFormatPreferences({ language: 'en', locale: undefined, currency: 'EUR' })
})

/** All dotted keys of a message tree. */
function keysOf(tree: object, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([name, value]: [string, unknown]) =>
    typeof value === 'string' ? [`${prefix}${name}`] : keysOf(value as object, `${prefix}${name}.`),
  )
}

describe('messages', () => {
  it('has the same keys in every language, none empty', () => {
    expect(keysOf(de)).toEqual(keysOf(en))
    expect(keysOf(en).every((key) => t(key as MessageKey).trim().length > 0)).toBe(true)
  })

  it('uses the same placeholders in every language', () => {
    // Without a count, plural texts come back whole, so both forms are compared together.
    const placeholders = (text: string): Set<string> => new Set(text.match(/\{\w+\}/g) ?? [])
    for (const key of keysOf(en) as MessageKey[]) {
      setFormatPreferences({ language: 'en' })
      const english = placeholders(t(key))
      setFormatPreferences({ language: 'de' })
      expect(placeholders(t(key)), key).toEqual(english)
    }
  })
})

describe('t', () => {
  it('returns the text of the current language', () => {
    expect(t('common.save')).toBe('Save')
    setFormatPreferences({ language: 'de' })
    expect(t('common.save')).toBe('Speichern')
  })

  it('fills in placeholders and keeps unknown ones', () => {
    expect(t('common.actionsFor', { name: 'Roof' })).toBe('Actions for Roof')
    expect(t('common.actionsFor')).toBe('Actions for {name}')
  })

  it('picks the plural form by count', () => {
    expect(t('common.objectCount', { count: 1 })).toBe('1 object')
    expect(t('common.objectCount', { count: 0 })).toBe('0 objects')
    expect(t('common.objectCount', { count: 3 })).toBe('3 objects')
    setFormatPreferences({ language: 'de' })
    expect(t('common.objectCount', { count: 1 })).toBe('1 Objekt')
  })

  it('returns a plural text whole without a numeric count', () => {
    expect(t('common.objectCount', { count: '2' })).toBe('2 object | 2 objects')
  })

  it('returns the key of an unknown text', () => {
    expect(t('no.such.key' as MessageKey)).toBe('no.such.key')
  })
})

describe('preferences', () => {
  it('starts with English, the system format and euros, and can be changed', () => {
    expect({ ...formatPreferences }).toEqual({ language: 'en', locale: undefined, currency: 'EUR' })
    setFormatPreferences({ currency: 'CHF' })
    expect(formatPreferences.currency).toBe('CHF')
  })

  it('knows its languages', () => {
    expect(isLanguage('de')).toBe(true)
    expect(isLanguage('fr')).toBe(false)
  })

  it('picks the first preferred system language it has', () => {
    expect(systemLanguage(['fr-FR', 'DE-at', 'en'])).toBe('de')
    expect(systemLanguage(['en-US'])).toBe('en')
    expect(systemLanguage(['fr'])).toBe('en')
    expect(systemLanguage([])).toBe('en')
  })
})
