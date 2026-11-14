# Planned Features

Rough implementation notes for features that don't exist yet. Every entry is a starting point to refine before implementing it, not a final design.

Effort: **S** = hours, **M** = a few days, **L** = a week or more.
---

## 1. Backup, export & import (M)

- One-click backup: a consistent copy of the SQLite database (e.g. `VACUUM INTO`), saved to a location the user picks.
- Restore from a backup, with a schema version check.
- CSV/JSON export of objects and investments.

---

## 2. Robustness & quality (M)

- Native error dialog when a migration fails at startup (`tauri-plugin-dialog`). Currently the app exits silently in release builds.
- Logging to a file (`tauri-plugin-log`) for support and debugging.
- Unit tests and CI are covered by item 3. End-to-end tests could come later.

---

## 3. Unit testing, 100% coverage, CI gate and release workflow (L)

**When:** start once items 1 and 2 are done.

**Goal:** all backend code is unit-tested with **100% coverage**, and a GitHub CI pipeline blocks merges into `main` unless coverage is 100%. A release workflow also builds the Windows installers on GitHub and publishes them as a GitHub Release.

**How we work on this item:** I already know unit testing and have set up branch protection before, so steps 1, 2 and 4 need no extra explanations. But I have never implemented a CI pipeline myself or built and released an app through workflows. For steps 3 and 5, guide me through everything **step by step, with simple explanations**:
- Before each step, explain in plain words what we are about to do and why. Explain new terms the first time they come up (e.g. workflow, job, runner, status check, tag, release, artifact).
- Take one small step at a time. Wait until I have done it and confirmed that it works before moving on.
- For anything I have to do myself (GitHub website settings, pushing a tag, running commands), give exact click paths or commands, and tell me what I should see if it worked.
- When something fails, explain what the error means before fixing it.

**Scope :** "backend" is taken to mean the code below the UI. That is the Rust side (`src-tauri/src`: `lib.rs`, `migrations.rs`) and the TypeScript data layer (`services/`, `composables/`, `utils/`). Vue components are out of scope unless we decide otherwise.

**Rough steps**
1. **TypeScript tests:** add Vitest with `@vitest/coverage-v8`. Mock `database.service.ts` (the only module that touches the Tauri SQL plugin) in service tests. Cover the services (`investment`, `household-category`, `household-object`: mapping, validation, error paths), the composables (shared state, reload after write, rethrow), `utils/`, and `database-error.ts`. Set coverage thresholds to 100% (lines, branches, functions, statements) in the Vitest config. New dev dependencies need your approval first (AGENTS.md rule).
2. **Rust tests:** `cargo test` for `migrations.rs` (versions are ordered and unique, the SQL applies to an in-memory SQLite database, and the seed/sample data is gone). Measure coverage with `cargo-llvm-cov` and enforce 100% with `--fail-under-lines 100`. `lib.rs` startup code that needs a running Tauri app may need refactoring into testable functions, or a documented exclusion.
3. **CI workflow:** `.github/workflows/ci.yml` on `pull_request` and `push` to `main`, on a Windows runner (the target platform; Linux if Tauri's Linux system packages aren't needed). Jobs: `npm ci`, `npm run typecheck`, Vitest with coverage, `cargo test` / `cargo llvm-cov`. Cache npm and Cargo.
4. **Branch protection (GitHub settings, manual):** protect `main`, require a pull request, and mark the CI job as a required status check. This is what actually stops direct pushes. A workflow alone cannot block a push.
5. **Release workflow:** `.github/workflows/release.yml`, triggered when a version tag is pushed (e.g. `v0.2.0`). It runs on a Windows runner and uses the official `tauri-apps/tauri-action` to build the NSIS/MSI installers and attach them to a **draft** GitHub Release. I review the draft and publish it by hand. Also decide where the version number lives (`package.json`, `tauri.conf.json`, `Cargo.toml`) and how to keep those in sync. Code signing and auto-updates stay in item 15.

**Open questions:** Is 100% meant to include Vue components? Are explicit coverage exclusions acceptable for untestable glue such as the Tauri bootstrap in `lib.rs` and `main.ts`? Should the rule apply to admins as well? Which runner OS? Should the release workflow require the CI checks to pass first?

---

## 4. Warranty tracking (M)

- Columns or a table for warranty end date, provider and conditions per object.
- "Expiring soon" indicators and filters, plus a dashboard widget (item 12).

---

## 5. Documents & attachments (M)

- Attach invoices, manuals, warranty certificates and photos to objects or investments.
- Copy the files into an `attachments/` folder inside the app-data directory and store only metadata in SQLite.
- Requires a **scoped** `tauri-plugin-fs` / `tauri-plugin-dialog` (file picker). No unrestricted file system access.

---

## 6. Maintenance schedules & history (L)

- `maintenance_plans` (object, interval, next due date) and `maintenance_records` (date, cost, provider, notes).
- Calculate the next due date from the interval and the last record.
- Overdue / upcoming lists.

---

## 7. Reminders & notifications (M)

Depends on items 4 and 6.

- Native notifications via `tauri-plugin-notification` for maintenance that is due and warranties that are expiring.
- Check on app start, and optionally on an interval while the app is open. Background reminders while the app is closed would need an autostart/tray approach (`tauri-plugin-autostart`), so evaluate that separately.

---

## 8. Settings (S)

- Currency (currently fixed to EUR in `src/utils/currency.ts`), locale/number format and theme.
- Store them in a `settings` key/value table.

---

## 9. Dark mode (S)

Depends on item 8.

- Add a dark theme in `src/plugins/vuetify.ts`, with a toggle in Settings (light / dark / system).
- Check that the custom CSS uses theme variables, not hard-coded colours.

---

## 10. Search & filtering (S–M)

- Global search across objects and investments. Filters by category, priority and status.

---

## 11. Investment improvements (S–M)

- Drag-and-drop reordering (the handles already exist). Persist `sort_order` in a transaction.
- Status: planned → purchased. "Convert to inventory object" when an investment is bought.
- Optional target date, budget and savings progress.

---

## 12. Dashboard / overview page (M)

Most useful once items 4 and 6 exist.

- Start page with key figures: total planned investments, upcoming maintenance, expiring warranties, and later smart home status.

---

## 13. Localisation (M)

- German UI (plus English) using `vue-i18n`. Move all UI strings out of the components.

---

## 14. Smart home device integration (L)

**Goal:** show the status of smart home devices and control them from HomeBase. Where possible, link devices to inventory objects (e.g. the heat pump's live data, the PV system's output).

**Approach (local-first, no cloud requirement)**
- Integrate through a **hub** rather than individual vendor APIs. The first target is **Home Assistant**, through its local REST + WebSocket API with a long-lived access token. Later options: MQTT, Matter.
- Network access goes through the official `tauri-plugin-http`, with URL scopes limited to the configured hub address. Alternatively, a small Rust command if WebSocket/MQTT needs it.
- Store the access token in the OS credential store (e.g. the keyring crate or the Stronghold plugin), **never** in SQLite as plain text.

**Rough steps**
1. Settings page: hub URL + token, plus a "Test connection" button.
2. `smart-home.service.ts`, using the same layering as the other services. It returns typed devices/entities.
3. Devices view: list, status, simple actions (switch, set temperature).
4. Migration: `smart_home_links` table (device id ↔ household object id).
5. Optional: record readings (energy, temperature) for history charts.

**Open questions:** works only on the local network (fine for offline-first)? Polling vs. WebSocket subscriptions? Which device types first?

---

## 15. Distribution (M)

- Builds on the basic release workflow from item 3.
- Code signing for Windows installers (avoids SmartScreen warnings).
- Auto-updates via `tauri-plugin-updater`. This needs an update server and internet, so it must be optional.
- CI builds for Linux and macOS once those platforms are in scope.

---

## 16. Move TypeScript toolchain from prerelease to stable (S)

*Triggered by an external event: do this as soon as stable releases ship, whatever its position in the list.*

TypeScript 7.1 beta and the `@vue/content-mapper` alpha are in use (type check is about 6x faster than TS 6 + `vue-tsc`: about 1 s vs 6 s). When stable releases ship:
- Replace the exact prerelease pins in `package.json` with the stable versions and remove `overrides.typescript`.
- Re-read the content-mapper docs for option or CLI changes and re-run `npm run typecheck` and `npm run build`.
- Check whether Vuetify (or the mapper) now accepts native attributes/events on `v-btn`; if so, revert the `v-bind="{ onClick: … }"` workarounds to plain `@click` and similar.
- Re-check Vue editor support for TS 7 and update the notes in `README.md` and `AGENTS.md`.
