# Planned Features

Rough implementation notes for features that don't exist yet. Every entry is a starting point to refine before implementing it, not a final design.

Effort: **S** = hours, **M** = a few days, **L** = a week or more.

---

## 1. Migrate to TypeScript 7.0.2 — *evaluation* (S–M)

**Current state:** pinned to TypeScript 6.0.3. TS 7 is the native (Go) compiler and no longer ships the JavaScript compiler API (`typescript/lib/tsc`) that `vue-tsc` is built on. With TS 7 installed, `vue-tsc` fails with `ERR_PACKAGE_PATH_NOT_EXPORTED`.

**Advantages**
- Much faster type checking and editor responsiveness.
- Stay on the supported major line; TS 6 will eventually stop receiving fixes.

**Complexity / blockers**
- Main blocker: `.vue` type checking depends on Volar/`vue-tsc` supporting the TS 7 API. Watch the `vue-tsc` / `@vue/language-tools` releases.
- `@vue/tsconfig` and the `tsconfig*.json` options may need adjusting for options that were removed or changed in TS 7.
- The app code is small and strictly typed, so code changes are expected to be minimal. The risk is in tooling, not in the code.

**Plan**
1. Check whether `vue-tsc` / Volar officially supports TS 7.
2. On a branch: `npm i -D typescript@7`, run `npm run typecheck` and `npm run build`, and fix the tsconfig.
3. Compare type-check time and the VS Code (Vue extension) experience.
4. Fallback if `vue-tsc` still lags: keep TS 6 for `vue-tsc`, and optionally try TS 7 in the editor only.

---

## 2. Smart home device integration (L)

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

## 3. Household inventory (L) — *core feature*

Replace the inventory placeholder with real data.

- Migration: `household_objects` (name, category, manufacturer, model, serial number, purchase date, purchase price in cents, installation date, location/room, notes).
- `household-object.service.ts` + `useHouseholdObjects()` + list/detail/form dialog, following the investments pattern.
- The category tiles on the inventory page show real counts.

## 4. Warranty tracking (M)

- Columns or a table for warranty end date, provider and conditions per object.
- "Expiring soon" indicators and filters, plus a dashboard widget.

## 5. Maintenance schedules & history (L)

- `maintenance_plans` (object, interval, next due date) and `maintenance_records` (date, cost, provider, notes).
- Calculate the next due date from the interval and the last record.
- Overdue / upcoming lists.

## 6. Reminders & notifications (M)

- Native notifications via `tauri-plugin-notification` for maintenance that is due and warranties that are expiring.
- Check on app start, and optionally on an interval while the app is open. Background reminders while the app is closed would need an autostart/tray approach (`tauri-plugin-autostart`), so evaluate that separately.

## 7. Documents & attachments (M)

- Attach invoices, manuals, warranty certificates and photos to objects or investments.
- Copy the files into an `attachments/` folder inside the app-data directory and store only metadata in SQLite.
- Requires a **scoped** `tauri-plugin-fs` / `tauri-plugin-dialog` (file picker). No unrestricted file system access.

## 8. Investment improvements (S–M)

- Drag-and-drop reordering (the handles already exist). Persist `sort_order` in a transaction.
- Status: planned → purchased. "Convert to inventory object" when an investment is bought.
- Optional target date, budget and savings progress.

## 9. Dashboard / overview page (M)

- Start page with key figures: total planned investments, upcoming maintenance, expiring warranties, and later smart home status.

## 10. Search & filtering (S–M)

- Global search across objects and investments. Filters by category, priority and status.

## 11. Settings (S)

- Currency (currently fixed to EUR in `src/utils/currency.ts`), locale/number format and theme.
- Store them in a `settings` key/value table.

## 12. Dark mode (S)

- Add a dark theme in `src/plugins/vuetify.ts`, with a toggle in Settings (light / dark / system).
- Check that the custom CSS uses theme variables, not hard-coded colours.

## 13. Backup, export & import (M)

- One-click backup: a consistent copy of the SQLite database (e.g. `VACUUM INTO`), saved to a location the user picks.
- Restore from a backup, with a schema version check.
- CSV/JSON export of objects and investments.

## 14. Localisation (M)

- German UI (plus English) using `vue-i18n`. Move all UI strings out of the components.

## 15. Robustness & quality (M)

- Native error dialog when a migration fails at startup (`tauri-plugin-dialog`). Currently the app exits silently in release builds.
- Logging to a file (`tauri-plugin-log`) for support and debugging.
- Automated tests: Vitest for services/utilities (mocked database layer), Rust tests for migrations, and maybe end-to-end tests later.

## 16. Distribution (M)

- Code signing for Windows installers (avoids SmartScreen warnings).
- Auto-updates via `tauri-plugin-updater`. This needs an update server and internet, so it must be optional.
- CI builds for Linux and macOS once those platforms are in scope.
