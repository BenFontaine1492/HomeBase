# Planned Features

Rough implementation notes for features that don't exist yet. Every entry is a starting point to refine before implementing it, not a final design.

- **The number is the priority:** item 1 is next. When priorities change, reorder and renumber the items.
- **Refer to other items by name**, never by number (e.g. "depends on _Settings_"), so renumbering never breaks a reference.
- Completed items are deleted (see the feature workflow in AGENTS.md).
- Tasks that are triggered by an external event, not by priority, are listed at the end under _Triggered tasks_.

Effort: **S** = hours, **M** = a few days, **L** = a week or more.

---

## 1. Dashboard (L)

**Maintenance data is ready:** `useMaintenance()` has `scheduleOf(task, object)` (status, due date, days until due), `summaryOf(objects)` (most urgent status + counts) and `costOf(objectId)`; `compareByUrgency` (`types/maintenance-schedule.ts`) sorts schedules. The "due soon" window comes from Settings → Maintenance. Maintenance costs come from `maintenance_records` and are deliberately **not** part of the Investments overview; show them in their own widget (e.g. per year / per object). The widget's "Mark as done" action opens `MaintenanceRecordFormDialog` with the task preselected.

**Goal:** the dashboard is the start page. It opens first when the app starts and shows the most important statuses of the household at a glance. It is **configurable**. By default it shows a sensible set of key figures and charts, and the user can add, remove, rearrange and configure these widgets.

**Rough steps**

1. **Route and navigation:** new `/dashboard` route as the default route (replaces `/investments` as the default) and the first item in `AppSidebar.vue`.
2. **Widget framework:** a registry of widget types in the frontend. Each type has an id, a title, a component, its data source (a composable) and optional settings (e.g. which category, which time range, chart type). Later features register their own widgets instead of changing the dashboard itself.
3. **First widgets:** upcoming maintenance, maintenance costs, planned investments (total amount, count per priority), inventory (number of objects per category, total purchase value), recently added objects.
4. **Default layout:** a fixed default set of widgets for a new installation, plus a "Reset to default" action.
5. **Edit mode:** a toggle to add a widget from a list, remove it, reorder it (drag and drop) and choose its size (e.g. small / medium / large), and a settings dialog per widget.
6. **Persistence:** migration for a `dashboard_widgets` table (widget type, position, size, settings as JSON), following the usual layers (value object → repository → service → composable, see AGENTS.md).
7. **Later widgets**, added together with their features: finance summary for the current year (see _Finance management_), smart home status (see _Smart home device integration_).

**New dependencies (discuss first):** a chart library that works fully offline (e.g. ECharts via `vue-echarts`, or Chart.js via `vue-chartjs`). A grid layout library only if simple reordering plus fixed sizes isn't enough.

**Open questions:** free-form grid (any position and size) or a simpler ordered list with fixed sizes? Which widgets belong in the default layout? One dashboard, or several (e.g. "Finances", "House")?

---

## 2. Reminders & notifications (M)

Maintenance due dates already exist (`scheduleOf` in `types/maintenance-schedule.ts`).

- Native notifications via `tauri-plugin-notification` for maintenance that is overdue or due soon.
- No warranty reminders (decided): warranty tracking was dropped, because a warranty certificate stored as a document of type `warranty` is enough.
- Check on app start, and optionally on an interval while the app is open. Background reminders while the app is closed would need an autostart/tray approach (`tauri-plugin-autostart`), so evaluate that separately.

---

## 3. Settings (S)

- The Settings page exists (`/settings`, gear icon at the bottom of the sidebar) with the sections **Data** (backup, restore, export, import) and **Maintenance** (the "due soon" window). New sections are added to the list in `SettingsView.vue` and as child routes of `/settings`.
- Add a **General** section: currency (currently fixed to EUR in `src/utils/currency.ts`), language and locale/number format (see _Localisation_) and theme (see _Dark mode_).
- The `settings` key/value table exists (migration 0006, `types/settings.ts`, `useSettings()`). A new setting needs no migration: add a key to `SETTING_KEYS`, a field to `AppSettings` (+ default), its parsing in `settingsFrom()` and a `SettingValue` factory. Export/import includes the table automatically.

---

## 4. Localisation (M)

Depends on _Settings_ (language choice).

- German UI (plus English) using `vue-i18n` (new dependency, discuss first). Move all UI strings out of the components.
- Every new view adds strings that have to be moved later, so this gets more expensive the longer it waits.

---

## 5. Dark mode (S)

Depends on _Settings_.

- Add a dark theme in `src/plugins/vuetify.ts`, with a toggle in Settings (light / dark / system).
- Check that the custom CSS uses theme variables, not hard-coded colours.

---

## 6. Search & filtering (S–M)

- Global search across objects and investments. Filters by category, priority and status.
- Open question: include object attributes (e.g. find all objects with "Refrigerant = R290")? One row per attribute makes this plain SQL.

---

## 7. Investment improvements (S–M)

- Drag-and-drop reordering (the handles already exist). Persist `sort_order` in a transaction.
- Status: planned → purchased. "Convert to inventory object" when an investment is bought.
- Optional target date, budget and savings progress.

---

## 8. Finance management: household expenses for the tax return (L)

Documents exist: expenses become a new attachment owner (`expense_id`, see the recipe in migration 0005 and `OWNER_COLUMNS` in `attachment.repository.ts`).

**Goal:** the user records household expenses and attaches proof (invoices, receipts, screenshots, bank statements). At the end of the year, HomeBase creates a PDF summary of the expenses relevant for the tax return (Steuererklärung), with the receipts attached, ready to hand to the tax office or a tax advisor.

**Rough steps**

1. **Data model:** migration for an `expenses` table: date paid, amount in cents, description, payee/provider, tax category, payment method, notes, optional link to a household object or investment. The tax year follows from the payment date.
2. **Tax categories:** a predefined but editable list, e.g. household-related services and tradesman services (_haushaltsnahe Dienstleistungen / Handwerkerleistungen_, §35a EStG), home office, insurance, donations, other. For §35a, store the **labour cost share** separately, because only that part is deductible, and note whether the payment was a bank transfer (cash payments don't count).
3. **Receipts:** attach one or more files to each expense, using the attachments storage (`AttachmentList` with an `{ kind: 'expense', id }` owner). Show a preview of images and PDFs (see _Backups include documents_ for previews).
4. **Expenses view:** list with filters (year, category), totals per category and year, create/edit/delete dialogs.
5. **PDF export:** pick a tax year (and optionally categories). Build a summary with totals per category, a table of all expenses, and the receipts as an appendix. Save it to a location the user picks.
6. **Dashboard widget:** expenses of the current year per category (see _Dashboard_).
7. Optional: when an investment is marked as purchased (see _Investment improvements_), offer to create the matching expense.

**New dependencies (discuss first):** PDF generation. Options: a frontend library (e.g. `pdfmake` or `jsPDF`), or a Rust crate (e.g. `printpdf`, plus `lopdf` to append PDF receipts). Appending existing PDF receipts is the hard part, so it decides which option we pick.

**Open questions:** which tax categories are actually needed? Should the PDF follow the structure of the tax forms (e.g. the lines of _Anlage Haushaltsnahe Aufwendungen_)? Expenses only, or income too (e.g. rental income, PV feed-in)? HomeBase only collects and summarises. It doesn't give tax advice.

---

## 9. Distribution (M)

- Builds on the release workflow (`.github/workflows/release.yml`), which builds Windows and Linux installers.
- Code signing for Windows installers (avoids SmartScreen warnings).
- Auto-updates via `tauri-plugin-updater`. This needs an update server and internet, so it must be optional.
- macOS builds: see _macOS builds_.

---

## 10. macOS builds (S–M)

Builds on the release workflow (`.github/workflows/release.yml`), which builds Windows and Linux installers only.

- Add `macos-latest` to the release workflow's matrix with `args: --target universal-apple-darwin` (one `.dmg` for Intel and Apple Silicon Macs). This needs both Rust targets installed in that job (`aarch64-apple-darwin`, `x86_64-apple-darwin`).
- Signing: without it, macOS blocks the app ("unidentified developer" / "damaged"). At minimum, use ad-hoc signing (`bundle.macOS.signingIdentity: "-"`) so users can allow the app in System Settings → Privacy & Security. Proper signing + notarization needs an Apple Developer account ($99/year), with the certificate and credentials stored as GitHub secrets. This ties in with code signing (see _Distribution_).
- Check the macOS paths in the docs (database: `~/Library/Application Support/com.homebase.desktop/`, logs: `~/Library/Logs/com.homebase.desktop`).
- Test the built app on a real Mac before publishing a release that includes it.
- Optional: add `macos-latest` to the CI test matrix too.

---

## 11. Smart home device integration (L)

**Goal:** show the status of smart home devices and control them from HomeBase. Where possible, link devices to inventory objects (e.g. the heat pump's live data, the PV system's output).

**Approach (local-first, no cloud requirement)**

- Integrate through a **hub** rather than individual vendor APIs. The first target is **Home Assistant**, through its local REST + WebSocket API with a long-lived access token. Later options: MQTT, Matter.
- Network access goes through the official `tauri-plugin-http`, with URL scopes limited to the configured hub address. Alternatively, a small Rust command if WebSocket/MQTT needs it.
- Store the access token in the OS credential store (e.g. the keyring crate or the Stronghold plugin), **never** in SQLite as plain text.

**Rough steps**

1. Settings section (`/settings/smart-home`): hub URL + token, plus a "Test connection" button. The token is not in SQLite, so it is not part of backups or exports.
2. `smart-home.service.ts` + a repository for the hub calls, using the same layers as the other features. It returns typed devices/entities.
3. Devices view: list, status, simple actions (switch, set temperature).
4. Migration: `smart_home_links` table (device id ↔ household object id).
5. Optional: record readings (energy, temperature) for history charts.

**Open questions:** works only on the local network (fine for offline-first)? Polling vs. WebSocket subscriptions? Which device types first?

---

## 12. Backups include documents (M)

Documents (the `attachments` table, migration 0005) are files in `attachments/` next to the database. Backups (Settings → Data) still contain only the database, and JSON/CSV exports only the data, so a backup is not complete yet.

- **Backup as ZIP:** `homebase.db` (via `VACUUM INTO`, as today) plus the `attachments/` folder in one `.zip`. New crate `zip` with minimal features (deflate through the `flate2` that is already compiled; no bzip2/zstd/lzma). Restoring old `.db` backups must keep working.
- **Restore:** validate the database in the ZIP as today (`inspect_backup`), then swap the database **and** the `attachments/` folder, keeping the previous folder next to `homebase.before-restore.db`. Roll back both on failure.
- **Export / import:** decide whether the JSON export becomes a ZIP with the files too, or stays data-only (and says so).
- **Then remove the interim safety net:** today `restore_backup` / `import_json` call `attachments::set_aside_orphans`, which moves files the new data doesn't use into `attachments.before-restore` / `attachments.before-import`, so the startup cleanup can't delete them. Remove it, and the notes in `RestoreBackupDialog.vue`, `ImportDataDialog.vue` and `BackupRestoreCard.vue`, once backups carry the files.
- Later, for documents: a "Save a copy…" action, and previews/thumbnails of images and PDFs (needs an asset protocol scope or a Rust command that returns the bytes; the CSP stays offline-only).

---

# Triggered tasks

Done as soon as their trigger happens, whatever the priorities above.

## Move TypeScript toolchain from prerelease to stable (S)

**Trigger:** stable releases of TypeScript 7.1 and `@vue/content-mapper` ship.

TypeScript 7.1 beta and the `@vue/content-mapper` alpha are in use (type check is about 6x faster than TS 6 + `vue-tsc`: about 1 s vs 6 s). When stable releases ship:

- Replace the exact prerelease pins in `package.json` with the stable versions and remove `overrides.typescript`.
- Re-read the content-mapper docs for option or CLI changes and re-run `npm run typecheck` and `npm run build`.
- Check whether Vuetify (or the mapper) now accepts native attributes/events on `v-btn`; if so, revert the `v-bind="{ onClick: … }"` workarounds to plain `@click` and similar.
- Re-check Vue editor support for TS 7 and update the notes in `README.md` and `AGENTS.md`.
- Re-check `oxlint-tsgolint` against the stable TS 7.1 (`npm run lint`).
- **Vue template linting:** Oxlint checks only the `<script>` of `.vue` files, so template rules (e.g. `vue/max-template-depth`, attribute order) are missing, and its type-aware rules don't see `<script>` blocks in `.vue` files. Check whether Oxlint has native Vue template support by now, or whether typescript-eslint supports TS 7, so that ESLint + eslint-plugin-vue could cover the templates (`@oxlint/migrate` translates the config).
