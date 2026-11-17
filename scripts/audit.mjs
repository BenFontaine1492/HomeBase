// `npm audit` with an allowlist (audit-allowlist.json), used by `make audit-fix` and CI.
//
// npm can't ignore an advisory, so one advisory without a fixed version would fail
// every run. Here each advisory at or above the level (default: high) fails, unless
// it is in the allowlist with a reason and an expiry date that hasn't passed.
// Expired entries fail too, so an accepted advisory is looked at again.
//
//   node scripts/audit.mjs [--audit-level=low|moderate|high|critical]

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const LEVELS = ['info', 'low', 'moderate', 'high', 'critical']
const levelArg = process.argv.find((arg) => arg.startsWith('--audit-level='))
const level = levelArg ? levelArg.split('=')[1] : 'high'
if (!LEVELS.includes(level)) {
  console.error(`Unknown audit level "${level}" (${LEVELS.join(', ')}).`)
  process.exit(2)
}

/** Raw `npm audit --json` report. npm exits with 1 when it finds anything, so read stdout either way. */
function auditReport() {
  try {
    return execFileSync('npm', ['audit', '--json'], { encoding: 'utf8', shell: true, maxBuffer: 64 * 1024 * 1024 })
  } catch (error) {
    if (typeof error.stdout === 'string' && error.stdout.trim().startsWith('{')) return error.stdout
    throw error
  }
}

/** Every advisory once (packages that are only affected through a dependency list a name instead). */
function advisories(report) {
  const byId = new Map()
  for (const vulnerability of Object.values(report.vulnerabilities ?? {})) {
    for (const via of vulnerability.via) {
      if (typeof via === 'object') byId.set(via.url.split('/').pop(), via)
    }
  }
  return [...byId.entries()].map(([id, via]) => ({ id, ...via }))
}

const allowlist = JSON.parse(readFileSync(new URL('../audit-allowlist.json', import.meta.url), 'utf8'))
const today = new Date().toISOString().slice(0, 10)
const relevant = advisories(JSON.parse(auditReport())).filter(
  (advisory) => LEVELS.indexOf(advisory.severity) >= LEVELS.indexOf(level),
)

let failed = false
for (const advisory of relevant) {
  const entry = allowlist.find((allowed) => allowed.id === advisory.id)
  const line = `${advisory.severity} ${advisory.id} ${advisory.name} ${advisory.range}: ${advisory.title}`
  if (!entry) {
    console.error(`FAIL     ${line}\n         ${advisory.url}`)
    failed = true
  } else if (entry.expires < today) {
    console.error(
      `EXPIRED  ${line}\n         allowlisted until ${entry.expires}: check for a fix, then renew or remove`,
    )
    failed = true
  } else {
    console.log(`allowed  ${line}\n         until ${entry.expires}: ${entry.reason}`)
  }
}
for (const entry of allowlist) {
  if (!relevant.some((advisory) => advisory.id === entry.id)) {
    console.log(`stale    ${entry.id} is no longer reported: remove it from audit-allowlist.json`)
  }
}

console.log(failed ? `\nAudit failed (level: ${level}).` : `\nAudit passed (level: ${level}).`)
process.exit(failed ? 1 : 0)
