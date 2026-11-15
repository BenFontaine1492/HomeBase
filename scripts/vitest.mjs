// Starts the Vitest CLI (used by the npm `test` scripts instead of `vitest` directly).
//
// Windows: when the terminal's working directory has a lowercase drive letter
// (`e:\…`, as VS Code opens it), `vitest` is loaded from `e:/…` while the test
// files resolve `import 'vitest'` to `E:/…`. Node treats them as two modules,
// and every test file fails with "Vitest failed to find the runner" or
// "Cannot read properties of undefined (reading 'config')". Loading the CLI via
// an upper-case drive letter keeps both paths identical. No-op elsewhere.
import { fileURLToPath, pathToFileURL } from 'node:url'

const cli = fileURLToPath(new URL('../node_modules/vitest/vitest.mjs', import.meta.url))
await import(pathToFileURL(cli.replace(/^[a-z]:/, (drive) => drive.toUpperCase())).href)
