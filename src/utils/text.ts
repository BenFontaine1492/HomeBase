/** Trims text and turns empty strings into null. */
export function normaliseText(value: string | null | undefined): string | null {
  return value?.trim() || null
}
