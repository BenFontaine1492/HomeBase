/** Trims text and turns empty strings into null. */
export function normaliseText(value: string | null | undefined): string | null {
  return value?.trim() || null
}

/** Text safe to put into HTML (e.g. a chart tooltip): `& < > " '` escaped. */
export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}
