import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, posix, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/*
 * Enforces the controller–service–repository layers (see AGENTS.md):
 *
 *   view → controller (composable) → service → repository → infrastructure
 *
 * plus `types/` and `utils/`, which every layer may use. Interim until a linter
 * takes over these rules (PlannedFeatures.md, "Linter & formatter").
 */

type Layer =
  | 'app'
  | 'view'
  | 'controller'
  | 'service'
  | 'repository'
  | 'infrastructure'
  | 'types'
  | 'utils'

/** Which layers each layer may import from (besides itself). */
const ALLOWED: Readonly<Record<Layer, readonly Layer[]>> = {
  // main.ts, App.vue, router, plugins: wiring, may use anything.
  app: ['app', 'view', 'controller', 'service', 'repository', 'infrastructure', 'types', 'utils'],
  view: ['view', 'controller', 'types', 'utils'],
  controller: ['controller', 'service', 'types', 'utils'],
  service: ['service', 'repository', 'types', 'utils'],
  repository: ['repository', 'infrastructure', 'types', 'utils'],
  infrastructure: ['infrastructure', 'types', 'utils'],
  // Value objects (e.g. InvestmentValues) validate with the helpers in utils/.
  types: ['types', 'utils'],
  utils: ['utils', 'types'],
}

/** Native packages that only certain layers may use. */
const PACKAGE_OWNERS: Readonly<Record<string, readonly Layer[]>> = {
  '@tauri-apps/plugin-sql': ['infrastructure'],
  '@tauri-apps/plugin-log': ['infrastructure'],
  '@tauri-apps/api/core': ['infrastructure', 'repository'],
  '@tauri-apps/plugin-dialog': ['service'],
}

/** Layers that must not contain SQL. */
const NO_SQL: readonly Layer[] = ['view', 'controller', 'service', 'types', 'utils']
const SQL = /\b(SELECT\s.+\sFROM|INSERT\s+INTO|DELETE\s+FROM|UPDATE\s+\w+\s+SET)\b/

const FOLDER_LAYERS: readonly [string, Layer][] = [
  ['components/', 'view'],
  ['views/', 'view'],
  ['composables/', 'controller'],
  ['services/', 'service'],
  ['repositories/', 'repository'],
  ['infrastructure/', 'infrastructure'],
  ['types/', 'types'],
  ['utils/', 'utils'],
]

/** Layer of a file, from its path relative to `src/` (forward slashes). */
function layerOf(path: string): Layer {
  return FOLDER_LAYERS.find(([folder]) => path.startsWith(folder))?.[1] ?? 'app'
}

const IMPORT = /(?:\bfrom\s+|\bimport\s*\(\s*|^\s*import\s+)['"]([^'"]+)['"]/gm

/** Import specifiers of a source file (static, dynamic and side-effect imports). */
function importsOf(source: string): string[] {
  return [...source.matchAll(IMPORT)].map((match) => match[1]!)
}

/** Path relative to `src/` of an internal import, or null for a package. */
function internalTarget(fromPath: string, specifier: string): string | null {
  if (specifier.startsWith('@/')) return specifier.slice(2)
  if (specifier.startsWith('.')) return posix.normalize(posix.join(posix.dirname(fromPath), specifier))
  return null
}

/** All rule violations in `files` (path relative to `src/` → source text). */
function violations(files: Readonly<Record<string, string>>): string[] {
  const found: string[] = []
  for (const [path, source] of Object.entries(files)) {
    const layer = layerOf(path)
    for (const specifier of importsOf(source)) {
      const target = internalTarget(path, specifier)
      if (target !== null) {
        const targetLayer = layerOf(target)
        if (!ALLOWED[layer].includes(targetLayer)) {
          found.push(`${path}: ${layer} layer must not import from ${targetLayer} layer (${specifier})`)
        }
        continue
      }
      const owners = Object.entries(PACKAGE_OWNERS).find(([name]) => specifier === name)?.[1]
      if (owners && !owners.includes(layer)) {
        found.push(`${path}: only ${owners.join(' / ')} may use ${specifier}`)
      }
    }
    if (NO_SQL.includes(layer) && SQL.test(source)) {
      found.push(`${path}: SQL belongs in a repository`)
    }
  }
  return found
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
  it('keeps every file in src/ within its layer', () => {
    const files = Object.fromEntries(
      sourceFiles(SRC).map((path) => [relative(SRC, path).split('\\').join('/'), readFileSync(path, 'utf8')]),
    )
    expect(Object.keys(files).length).toBeGreaterThan(50)
    expect(violations(files)).toEqual([])
  })

  it('assigns files to layers by folder', () => {
    expect(layerOf('components/inventory/CategoryTile.vue')).toBe('view')
    expect(layerOf('views/InventoryView.vue')).toBe('view')
    expect(layerOf('composables/useInvestments.ts')).toBe('controller')
    expect(layerOf('services/investment.service.ts')).toBe('service')
    expect(layerOf('repositories/investment.repository.ts')).toBe('repository')
    expect(layerOf('infrastructure/database.ts')).toBe('infrastructure')
    expect(layerOf('main.ts')).toBe('app')
    expect(layerOf('router/index.ts')).toBe('app')
  })

  it('reports imports that skip or reverse a layer', () => {
    expect(
      violations({
        'components/A.vue': "import { findAll } from '@/repositories/investment.repository'",
        'composables/useA.ts': "const m = await import('../repositories/a.repository')",
        'repositories/a.repository.ts': "import { listInvestments } from '@/services/investment.service'",
        'services/a.service.ts': "import { select } from '@/infrastructure/database'",
      }),
    ).toEqual([
      'components/A.vue: view layer must not import from repository layer (@/repositories/investment.repository)',
      'composables/useA.ts: controller layer must not import from repository layer (../repositories/a.repository)',
      'repositories/a.repository.ts: repository layer must not import from service layer (@/services/investment.service)',
      'services/a.service.ts: service layer must not import from infrastructure layer (@/infrastructure/database)',
    ])
  })

  it('reports native packages used outside their layer, and SQL outside repositories', () => {
    expect(
      violations({
        'services/a.service.ts': "import Database from '@tauri-apps/plugin-sql'\nconst q = 'DELETE FROM investments'",
        'composables/useA.ts': "import { invoke } from '@tauri-apps/api/core'",
        'repositories/a.repository.ts': "import { invoke } from '@tauri-apps/api/core'\nconst q = 'DELETE FROM a'",
        'components/B.vue': "import { ref } from 'vue'\nimport './side-effect.css'",
      }),
    ).toEqual([
      'services/a.service.ts: only infrastructure may use @tauri-apps/plugin-sql',
      'services/a.service.ts: SQL belongs in a repository',
      'composables/useA.ts: only infrastructure / repository may use @tauri-apps/api/core',
    ])
  })
})
