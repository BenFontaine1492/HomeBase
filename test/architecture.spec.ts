import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/*
 * SQL belongs in repositories/ (and the database client in infrastructure/), see AGENTS.md.
 *
 * The other layer rules (allowed imports per folder, native packages per layer) are
 * enforced by Oxlint's no-restricted-imports in .oxlintrc.json. This check stays a test
 * because no lint rule can match SQL in string literals cleanly.
 */

/** Folders (relative to `src/`) that must not contain SQL. */
const NO_SQL_FOLDERS: readonly string[] = ['components/', 'views/', 'composables/', 'services/', 'types/', 'utils/']
const SQL = /\b(SELECT\s.+\sFROM|INSERT\s+INTO|DELETE\s+FROM|UPDATE\s+\w+\s+SET)\b/

/** Files (path relative to `src/` → source text) that contain SQL outside a repository. */
function violations(files: Readonly<Record<string, string>>): string[] {
  return Object.entries(files)
    .filter(([path, source]) => NO_SQL_FOLDERS.some((folder) => path.startsWith(folder)) && SQL.test(source))
    .map(([path]) => `${path}: SQL belongs in a repository`)
}

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '../src')

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    return /\.(ts|vue)$/.test(entry.name) ? [path] : []
  })
}

describe('architecture', () => {
  it('keeps SQL out of every layer but repositories', () => {
    const files = Object.fromEntries(
      sourceFiles(SRC).map((path) => [relative(SRC, path).split('\\').join('/'), readFileSync(path, 'utf8')]),
    )
    expect(Object.keys(files).length).toBeGreaterThan(50)
    expect(violations(files)).toEqual([])
  })

  it('reports SQL outside repositories', () => {
    expect(
      violations({
        'services/a.service.ts': "const q = 'DELETE FROM investments'",
        'components/A.vue': "const q = 'SELECT id FROM a'",
        'repositories/a.repository.ts': "const q = 'DELETE FROM a'",
        'infrastructure/database.ts': "const q = 'INSERT INTO a'",
        'composables/useA.ts': "const label = 'Select a category'",
      }),
    ).toEqual(['services/a.service.ts: SQL belongs in a repository', 'components/A.vue: SQL belongs in a repository'])
  })
})
