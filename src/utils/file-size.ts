const UNITS = ['KB', 'MB', 'GB'] as const

const formatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 })

/** A file size for display: 512 → "512 B", 1536 → "1.5 KB", 3_400_000 → "3.2 MB". */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  let size = bytes / 1024
  let unit: (typeof UNITS)[number] = 'KB'
  for (const next of UNITS.slice(1)) {
    if (size < 1024) break
    size /= 1024
    unit = next
  }
  return `${formatter.format(size)} ${unit}`
}
