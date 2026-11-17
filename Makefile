# Local development shortcuts (Windows / PowerShell).
#   make startup  -> start the app (npm run tauri dev)
#   make stop     -> stop the app and its Vite dev server
#   make test     -> format check, lint, type-check, then all unit tests (TypeScript, Rust) with the 100% coverage gate
#   make linting  -> format all files (Oxfmt) and lint with --fix (Oxlint); prints what is left to fix by hand
#   make audit-fix -> npm audit fix: applies compatible security fixes, reports what remains
#   make teardown -> stop everything the app and its tooling started (see below)

SHELL := powershell.exe
.SHELLFLAGS := -NoProfile -NonInteractive -Command

# Port of the Vite dev server (see devUrl in src-tauri/tauri.conf.json)
DEV_PORT := 1420
# Vite's HMR port when developing on a remote device (vite.config.ts)
HMR_PORT := 1421

# Node processes started from this project: Vite, Vitest (+ its workers), the Tauri CLI.
# Deliberately narrow: VS Code's TypeScript/Vue language servers also run from
# node_modules (tsc.exe, `node server.js`) and must keep running.
NODE_TOOLS := node_modules.(vite|vitest|@tauri-apps)|scripts.vitest\.mjs

.PHONY: startup stop teardown test linting audit-fix

startup:
	npm run tauri dev

stop:
	Stop-Process -Name homebase -Force -ErrorAction SilentlyContinue; Get-NetTCPConnection -LocalPort $(DEV_PORT) -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $$_.OwningProcess -Force -ErrorAction SilentlyContinue }; exit 0

# Everything `stop` does, plus: the HMR port, leftover Vite/Vitest/Tauri CLI node
# processes, and Rust build tools. Note: cargo, rustc, cargo-llvm-cov and rustup are
# stopped machine-wide, so this also cancels Rust builds of other projects.
teardown: stop
	Get-NetTCPConnection -LocalPort $(HMR_PORT) -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $$_.OwningProcess -Force -ErrorAction SilentlyContinue }; exit 0
	Get-CimInstance Win32_Process | Where-Object { $$_.Name -eq 'node.exe' -and $$_.CommandLine -match '$(NODE_TOOLS)' } | ForEach-Object { Write-Output ('Stopping node ' + $$_.ProcessId + ': ' + $$_.CommandLine); Stop-Process -Id $$_.ProcessId -Force -ErrorAction SilentlyContinue }; exit 0
	Get-Process -Name cargo, rustc, cargo-llvm-cov, rustup -ErrorAction SilentlyContinue | ForEach-Object { Write-Output ('Stopping ' + $$_.Name + ' ' + $$_.Id); Stop-Process -Id $$_.Id -Force -ErrorAction SilentlyContinue }; exit 0
	Write-Output 'Teardown complete.'

# Format check, lint (check only, no writes; run `make linting` to fix), type-check, TypeScript tests +
# coverage gate, Rust tests + coverage gate. Stops at the first failure; the exit code is passed on,
# so make reports failures.
test:
	npm run format:check; if ($$LASTEXITCODE -ne 0) { exit $$LASTEXITCODE }; npm run lint; if ($$LASTEXITCODE -ne 0) { exit $$LASTEXITCODE }; npm run typecheck; if ($$LASTEXITCODE -ne 0) { exit $$LASTEXITCODE }; npm run test:coverage; if ($$LASTEXITCODE -ne 0) { exit $$LASTEXITCODE }; npm run coverage:rust; exit $$LASTEXITCODE

# Formats every file, then lints with --fix. Fails (and lists them) if problems remain that
# --fix can't solve.
linting:
	npm run format; if ($$LASTEXITCODE -ne 0) { exit $$LASTEXITCODE }; npm run lint:fix; exit $$LASTEXITCODE

# Applies the semver-compatible fixes and prints the report of what remains (exit code not 0 if
# anything is still open). Never --force: it can install breaking major versions over the exact pins.
audit-fix:
	npm audit fix; exit $$LASTEXITCODE
