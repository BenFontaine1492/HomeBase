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
5. **Release workflow:** `.github/workflows/release.yml`, triggered when a version tag is pushed (e.g. `v0.2.0`). It runs on a Windows runner and uses the official `tauri-apps/tauri-action` to build the NSIS/MSI installers and attach them to a **draft** GitHub Release. I review the draft and publish it by hand. Also decide where the version number lives (`package.json`, `tauri.conf.json`, `Cargo.toml`) and how to keep those in sync. Code signing and auto-updates stay in item 16.

**Open questions:** Is 100% meant to include Vue components? Are explicit coverage exclusions acceptable for untestable glue such as the Tauri bootstrap in `lib.rs` and `main.ts`? Should the rule apply to admins as well? Which runner OS? Should the release workflow require the CI checks to pass first?

---

## 4. Dashboard (L)

**When:** the first feature after item 3 (tests, CI and release workflow) is done.

**Goal:** the dashboard is the start page. It opens first when the app starts and shows the most important statuses of the household at a glance. It is **configurable**. By default it shows a sensible set of key figures and charts, and the user can add, remove, rearrange and configure these widgets.

**Rough steps**
1. **Route and navigation:** new `/dashboard` route as the default route (replaces `/investments` as the default) and the first item in `AppSidebar.vue`.
2. **Widget framework:** a registry of widget types in the frontend. Each type has an id, a title, a component, its data source (a composable) and optional settings (e.g. which category, which time range, chart type). Later features register their own widgets instead of changing the dashboard itself.
3. **First widgets (using data that exists today):** planned investments (total amount, count per priority), inventory (number of objects per category, total purchase value), recently added objects.
4. **Default layout:** a fixed default set of widgets for a new installation, plus a "Reset to default" action.
5. **Edit mode:** a toggle to add a widget from a list, remove it, reorder it (drag and drop) and choose its size (e.g. small / medium / large), and a settings dialog per widget.
6. **Persistence:** migration for a `dashboard_widgets` table (widget type, position, size, settings as JSON), following the usual service → composable layering.
7. **Later widgets**, added together with their features: expiring warranties (item 5), finance summary for the current year (item 7), upcoming maintenance (item 8), smart home status (item 15).

**New dependencies (discuss first):** a chart library that works fully offline (e.g. ECharts via `vue-echarts`, or Chart.js via `vue-chartjs`). A grid layout library only if simple reordering plus fixed sizes isn't enough.

**Open questions:** free-form grid (any position and size) or a simpler ordered list with fixed sizes? Which widgets belong in the default layout? One dashboard, or several (e.g. "Finances", "House")?

---

## 5. Warranty tracking (M)

- Columns or a table for warranty end date, provider and conditions per object.
- "Expiring soon" indicators and filters, plus a dashboard widget (item 4).

---

## 6. Documents & attachments (M)

- Attach invoices, manuals, warranty certificates and photos to objects or investments.
- Copy the files into an `attachments/` folder inside the app-data directory and store only metadata in SQLite.
- Requires a **scoped** `tauri-plugin-fs` / `tauri-plugin-dialog` (file picker). No unrestricted file system access.

---

## 7. Finance management: household expenses for the tax return (L)

Depends on item 6 (attachments).

**Goal:** the user records household expenses and attaches proof (invoices, receipts, screenshots, bank statements). At the end of the year, HomeBase creates a PDF summary of the expenses relevant for the tax return (Steuererklärung), with the receipts attached, ready to hand to the tax office or a tax advisor.

**Rough steps**
1. **Data model:** migration for an `expenses` table: date paid, amount in cents, description, payee/provider, tax category, payment method, notes, optional link to a household object or investment. The tax year follows from the payment date.
2. **Tax categories:** a predefined but editable list, e.g. household-related services and tradesman services (*haushaltsnahe Dienstleistungen / Handwerkerleistungen*, §35a EStG), home office, insurance, donations, other. For §35a, store the **labour cost share** separately, because only that part is deductible, and note whether the payment was a bank transfer (cash payments don't count).
3. **Receipts:** attach one or more files to each expense, using the attachments storage from item 6. Show a preview of images and PDFs.
4. **Expenses view:** list with filters (year, category), totals per category and year, create/edit/delete dialogs.
5. **PDF export:** pick a tax year (and optionally categories). Build a summary with totals per category, a table of all expenses, and the receipts as an appendix. Save it to a location the user picks.
6. **Dashboard widget:** expenses of the current year per category (item 4).
7. Optional: when an investment is marked as purchased (item 13), offer to create the matching expense.

**New dependencies (discuss first):** PDF generation. Options: a frontend library (e.g. `pdfmake` or `jsPDF`), or a Rust crate (e.g. `printpdf`, plus `lopdf` to append PDF receipts). Appending existing PDF receipts is the hard part, so it decides which option we pick.

**Open questions:** which tax categories are actually needed? Should the PDF follow the structure of the tax forms (e.g. the lines of *Anlage Haushaltsnahe Aufwendungen*)? Expenses only, or income too (e.g. rental income, PV feed-in)? HomeBase only collects and summarises. It doesn't give tax advice.

---

## 8. Maintenance schedules & history (L)

- `maintenance_plans` (object, interval, next due date) and `maintenance_records` (date, cost, provider, notes).
- Calculate the next due date from the interval and the last record.
- Overdue / upcoming lists.

---

## 9. Reminders & notifications (M)

Depends on items 5 and 8.

- Native notifications via `tauri-plugin-notification` for maintenance that is due and warranties that are expiring.
- Check on app start, and optionally on an interval while the app is open. Background reminders while the app is closed would need an autostart/tray approach (`tauri-plugin-autostart`), so evaluate that separately.

---

## 10. Settings (S)

- Currency (currently fixed to EUR in `src/utils/currency.ts`), locale/number format and theme.
- Store them in a `settings` key/value table.

---

## 11. Dark mode (S)

Depends on item 10.

- Add a dark theme in `src/plugins/vuetify.ts`, with a toggle in Settings (light / dark / system).
- Check that the custom CSS uses theme variables, not hard-coded colours.

---

## 12. Search & filtering (S–M)

- Global search across objects and investments. Filters by category, priority and status.

---

## 13. Investment improvements (S–M)

- Drag-and-drop reordering (the handles already exist). Persist `sort_order` in a transaction.
- Status: planned → purchased. "Convert to inventory object" when an investment is bought.
- Optional target date, budget and savings progress.

---

## 14. Localisation (M)

- German UI (plus English) using `vue-i18n`. Move all UI strings out of the components.

---

## 15. Smart home device integration (L)

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

## 16. Distribution (M)

- Builds on the basic release workflow from item 3.
- Code signing for Windows installers (avoids SmartScreen warnings).
- Auto-updates via `tauri-plugin-updater`. This needs an update server and internet, so it must be optional.
- CI builds for Linux and macOS once those platforms are in scope.

---

## 17. Move TypeScript toolchain from prerelease to stable (S)

*Triggered by an external event: do this as soon as stable releases ship, whatever its position in the list.*

TypeScript 7.1 beta and the `@vue/content-mapper` alpha are in use (type check is about 6x faster than TS 6 + `vue-tsc`: about 1 s vs 6 s). When stable releases ship:
- Replace the exact prerelease pins in `package.json` with the stable versions and remove `overrides.typescript`.
- Re-read the content-mapper docs for option or CLI changes and re-run `npm run typecheck` and `npm run build`.
- Check whether Vuetify (or the mapper) now accepts native attributes/events on `v-btn`; if so, revert the `v-bind="{ onClick: … }"` workarounds to plain `@click` and similar.
- Re-check Vue editor support for TS 7 and update the notes in `README.md` and `AGENTS.md`.
