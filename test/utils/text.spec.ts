import { describe, expect, it } from 'vitest'
import { escapeHtml, normaliseText } from '@/utils/text'

describe('normaliseText', () => {
  it('trims text and turns empty values into null', () => {
    expect(normaliseText(' Basement ')).toBe('Basement')
    expect(normaliseText('   ')).toBeNull()
    expect(normaliseText(null)).toBeNull()
    expect(normaliseText(undefined)).toBeNull()
  })
})

describe('escapeHtml', () => {
  it('escapes the characters that HTML would read as markup', () => {
    expect(escapeHtml(`<b>Tom & Jerry's "car"</b>`)).toBe('&lt;b&gt;Tom &amp; Jerry&#39;s &quot;car&quot;&lt;/b&gt;')
    expect(escapeHtml('Roof')).toBe('Roof')
  })
})
