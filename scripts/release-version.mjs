// Version helper for the release workflow (.github/workflows/release.yml).
//
// The version is NOT kept in the files: package.json, Cargo.toml and their lock files
// contain the placeholder 0.0.0. The real version is the latest git tag (v1.2.3), and a
// pull request label (major / minor / patch) decides the next one. Only on the build
// machine is the new version written into the files, just before the installers are built.
//
// Usage:
//   node scripts/release-version.mjs next <major|minor|patch>   prints the next version, e.g. 0.2.0
//   node scripts/release-version.mjs apply <version>            writes the version into the four files
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const VERSION_PATTERN = /^\d+\.\d+\.\d+$/

function fail(message) {
  console.error(`release-version: ${message}`)
  process.exit(1)
}

/** Highest vX.Y.Z tag in the repository, or 0.0.0 before the first release. */
function latestVersion() {
  const tags = execFileSync('git', ['tag', '--list', 'v*', '--sort=-v:refname'], { cwd: root, encoding: 'utf8' })
    .split('\n')
    .map((tag) => tag.trim())
    .filter((tag) => VERSION_PATTERN.test(tag.slice(1)))
  return tags.length > 0 ? tags[0].slice(1) : '0.0.0'
}

function nextVersion(current, part) {
  const [major, minor, patch] = current.split('.').map(Number)
  switch (part) {
    case 'major':
      return `${major + 1}.0.0`
    case 'minor':
      return `${major}.${minor + 1}.0`
    case 'patch':
      return `${major}.${minor}.${patch + 1}`
    default:
      return fail(`unknown part "${part}" (expected major, minor or patch)`)
  }
}

/** Replaces `pattern` in a text file; fails loudly if it doesn't occur (a format change). */
function replaceInFile(file, pattern, replacement) {
  const path = `${root}${file}`
  const text = readFileSync(path, 'utf8')
  if (!pattern.test(text)) fail(`version entry not found in ${file}`)
  writeFileSync(path, text.replace(pattern, replacement))
}

function applyVersion(version) {
  if (!VERSION_PATTERN.test(version)) fail(`"${version}" is not a version like 1.2.3`)

  const packageJson = JSON.parse(readFileSync(`${root}package.json`, 'utf8'))
  packageJson.version = version
  writeFileSync(`${root}package.json`, `${JSON.stringify(packageJson, null, 2)}\n`)

  const packageLock = JSON.parse(readFileSync(`${root}package-lock.json`, 'utf8'))
  packageLock.version = version
  packageLock.packages[''].version = version
  writeFileSync(`${root}package-lock.json`, `${JSON.stringify(packageLock, null, 2)}\n`)

  // The first `version = "…"` in Cargo.toml is the one in [package].
  replaceInFile('src-tauri/Cargo.toml', /^version = "[^"]*"/m, `version = "${version}"`)
  replaceInFile('src-tauri/Cargo.lock', /(name = "homebase"\r?\nversion = ")[^"]*"/, `$1${version}"`)

  console.log(`Version ${version} written to package.json, package-lock.json, Cargo.toml, Cargo.lock`)
}

const [command, argument] = process.argv.slice(2)
if (command === 'next') {
  console.log(nextVersion(latestVersion(), argument))
} else if (command === 'apply') {
  applyVersion(argument ?? '')
} else {
  fail('usage: node scripts/release-version.mjs next <major|minor|patch> | apply <version>')
}
