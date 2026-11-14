# Planned Features

Rough implementation notes for features that don't exist yet. Every entry is a starting point to refine before implementing it, not a final design.

Effort: **S** = hours, **M** = a few days, **L** = a week or more.

---

## 2. Unit testing, 100% coverage and CI gate (L)

**Goal:** all backend code is unit-tested with **100% coverage**, and a GitHub CI pipeline blocks merges into `main` unless coverage is 100%.

**Scope (to confirm):** "backend" is taken to mean the code below the UI. That is the Rust side (`src-tauri/src`: `lib.rs`, `migrations.rs`) and the TypeScript data layer (`services/`, `composables/`, `utils/`). Vue components are out of scope unless we decide otherwise.

**Rough steps**
1. **TypeScript tests:** add Vitest with `@vitest/coverage-v8`. Mock `database.service.ts` (the only module that touches the Tauri SQL plugin) in service tests. Cover `investment.service.ts` (mapping, validation, error paths), `useInvestments.ts` (shared state, reload after write, rethrow), `utils/currency.ts`, and `database-error.ts`. Set coverage thresholds to 100% (lines, branches, functions, statements) in the Vitest config. New dev dependencies need your approval first (AGENTS.md rule).
2. **Rust tests:** `cargo test` for `migrations.rs` (versions are ordered and unique, the SQL applies to an in-memory SQLite database, and the seed/sample data is gone). Measure coverage with `cargo-llvm-cov` and enforce 100% with `--fail-under-lines 100`. `lib.rs` startup code that needs a running Tauri app may need refactoring into testable functions, or a documented exclusion.
3. **CI workflow:** `.github/workflows/ci.yml` on `pull_request` and `push` to `main`, on a Windows runner (the target platform; Linux if Tauri's Linux system packages aren't needed). Jobs: `npm ci`, `npm run typecheck`, Vitest with coverage, `cargo test` / `cargo llvm-cov`. Cache npm and Cargo.
4. **Branch protection (GitHub settings, manual):** protect `main`, require a pull request, and mark the CI job as a required status check. This is what actually stops direct pushes. A workflow alone cannot block a push.

**Open questions:** Is 100% meant to include Vue components? Are explicit coverage exclusions acceptable for untestable glue such as the Tauri bootstrap in `lib.rs` and `main.ts`? Should the rule apply to admins as well? Which runner OS?

---

## 3. Move TypeScript toolchain from prerelease to stable (S)

TypeScript 7.1 beta and the `@vue/content-mapper` alpha are in use (type check is about 6x faster than TS 6 + `vue-tsc`: about 1 s vs 6 s). When stable releases ship:
- Replace the exact prerelease pins in `package.json` with the stable versions and remove `overrides.typescript`.
- Re-read the content-mapper docs for option or CLI changes and re-run `npm run typecheck` and `npm run build`.
- Check whether Vuetify (or the mapper) now accepts native attributes/events on `v-btn`; if so, revert the `v-bind="{ onClick: … }"` workarounds to plain `@click` and similar.
- Re-check Vue editor support for TS 7 and update the notes in `README.md` and `AGENTS.md`.

---

## 4. Smart home device integration (L)

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

## 5. Warranty tracking (M)

- Columns or a table for warranty end date, provider and conditions per object.
- "Expiring soon" indicators and filters, plus a dashboard widget.

## 6. Maintenance schedules & history (L)

**Goal:** every household object can have a **last maintenance date** and a **required maintenance interval**. HomeBase calculates when each object needs maintenance next, and the dashboard (item 10) shows which objects are due and how urgent they are.

**Data**
- First step (simple): nullable columns on `household_objects` (new migration): `last_maintenance_date` ('YYYY-MM-DD') and `maintenance_interval_months` (integer > 0). The object form and detail dialog get both fields.
- Later: `maintenance_records` (object, date, cost, provider, notes) as history. "Mark as maintained" adds a record and updates `last_maintenance_date`.
- If one object needs several different tasks (e.g. heat pump service yearly + filter change every 3 months), move the interval into a `maintenance_plans` table (object, task name, interval, last done).

**Calculation** (in the service/composable, not stored)
- Next due date = last maintenance date + interval. If there is no last maintenance date, fall back to the installation date, then the purchase date. If none of these exist, the status is "unknown".
- Urgency levels:
  - **Overdue** (error colour): the due date has passed. Sort by how many days overdue.
  - **Due soon** (warning colour): due within 30 days, or within 10% of the interval for short intervals.
  - **OK** (success colour): everything else.
  - **Not scheduled**: no interval set. Not shown on the dashboard.

**UI**
- A status chip on the object list item, in the detail dialog and on the category tile (e.g. "2 overdue").
- Dashboard widget: overdue and due-soon objects sorted by urgency, each with its due date and a "Mark as maintained" action.

**Open questions:** Is the interval in months enough, or are days/weeks needed? Should the "due soon" window be configurable in Settings (item 12)? Should costs from maintenance records feed into the investments overview?

## 7. Reminders & notifications (M)

- Native notifications via `tauri-plugin-notification` for maintenance that is due and warranties that are expiring.
- Check on app start, and optionally on an interval while the app is open. Background reminders while the app is closed would need an autostart/tray approach (`tauri-plugin-autostart`), so evaluate that separately.

## 8. Documents & attachments (M)

- Attach invoices, manuals, warranty certificates and photos to objects or investments.
- Copy the files into an `attachments/` folder inside the app-data directory and store only metadata in SQLite.
- Requires a **scoped** `tauri-plugin-fs` / `tauri-plugin-dialog` (file picker). No unrestricted file system access.

## 9. Investment improvements (S–M)

- Drag-and-drop reordering (the handles already exist). Persist `sort_order` in a transaction.
- Status: planned → purchased. "Convert to inventory object" when an investment is bought.
- Optional target date, budget and savings progress.

## 10. Dashboard / overview page (M)

- Start page with key figures: total planned investments, upcoming maintenance, expiring warranties, and later smart home status.

## 11. Search & filtering (S–M)

- Global search across objects and investments. Filters by category, priority and status.

## 12. Settings (S)

- Currency (currently fixed to EUR in `src/utils/currency.ts`), locale/number format and theme.
- Store them in a `settings` key/value table.

## 13. Dark mode (S)

- Add a dark theme in `src/plugins/vuetify.ts`, with a toggle in Settings (light / dark / system).
- Check that the custom CSS uses theme variables, not hard-coded colours.

## 14. Backup, export & import (M)

- One-click backup: a consistent copy of the SQLite database (e.g. `VACUUM INTO`), saved to a location the user picks.
- Restore from a backup, with a schema version check.
- CSV/JSON export of objects and investments.

## 15. Localisation (M)

- German UI (plus English) using `vue-i18n`. Move all UI strings out of the components.

## 16. Robustness & quality (M)

- Native error dialog when a migration fails at startup (`tauri-plugin-dialog`). Currently the app exits silently in release builds.
- Logging to a file (`tauri-plugin-log`) for support and debugging.
- Unit tests and CI are covered by item 2. End-to-end tests could come later.

## 17. Distribution (M)

- Code signing for Windows installers (avoids SmartScreen warnings).
- Auto-updates via `tauri-plugin-updater`. This needs an update server and internet, so it must be optional.
- CI builds for Linux and macOS once those platforms are in scope.

## 18. Dynamic object properties (L)

**Goal:** users can add their own properties to household objects (e.g. "Filter type", "Refrigerant", "Power (kW)"), and later attach documents and other items to them, instead of being limited to the fixed columns of `household_objects`.

**Why it is deferred:** objects currently have a fixed set of columns that map 1:1 onto `HouseholdObject`, the form dialog and the detail dialog. Dynamic properties need a different data model and a refactor of the object service, composable and components, so the current fixed fields stay as they are for now.

**Possible approach (to discuss)**
- `object_property_definitions` (id, category_id or global, name, type: text / number / date / boolean / select, unit, options, sort_order) and `object_property_values` (object_id, definition_id, value). This is an EAV model: typed values are stored as text and validated by the definition's type.
- Alternative: a JSON column on `household_objects` (simpler to store, harder to query and validate; SQLite's `json_extract` helps for filtering).
- Property definitions per category, so e.g. every "Heating" object gets the same extra fields.
- The form and detail dialogs render fields from the definitions instead of a hard-coded list.
- Attachments (item 8) and maintenance plans (item 6) attach to objects in the same way, so design the object detail page with sections/tabs for properties, documents and maintenance.
- Migration path: the existing fixed columns either stay as built-in properties or are migrated into the new tables in one new migration.

**Open questions:** per-category or global definitions? Which property types are needed? Should search/filter (item 11) work on custom properties?
