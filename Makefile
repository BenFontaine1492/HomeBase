# Local development shortcuts (Windows / PowerShell).
#   make startup  -> start the app (npm run tauri dev)
#   make stop     -> stop the app and its Vite dev server
#   make test     -> run unit tests (npm test)

SHELL := powershell.exe
.SHELLFLAGS := -NoProfile -NonInteractive -Command

# Port of the Vite dev server (see devUrl in src-tauri/tauri.conf.json)
DEV_PORT := 1420

.PHONY: startup stop test

startup:
	npm run tauri dev

stop:
	Stop-Process -Name homebase -Force -ErrorAction SilentlyContinue; Get-NetTCPConnection -LocalPort $(DEV_PORT) -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $$_.OwningProcess -Force -ErrorAction SilentlyContinue }; exit 0

test:
	npm test
