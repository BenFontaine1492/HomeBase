# Planned Features

Rough implementation notes for features that don't exist yet. Every entry is a starting point to refine before implementing it, not a final design.

- **The number is the priority:** item 1 is next. When priorities change, reorder and renumber the items.
- **Refer to other items by name**, never by number (e.g. "depends on _Documents & attachments_"), so renumbering never breaks a reference.
- Completed items are deleted (see the feature workflow in AGENTS.md).
- Tasks that are triggered by an external event, not by priority, are listed at the end under _Triggered tasks_.

Effort: **S** = hours, **M** = a few days, **L** = a week or more.

---

## 1. Documents & attachments (M)

- Attach invoices, contracts, manuals, warranty certificates and photos to objects (later also to expenses, see _Finance management_, and maintenance records, see _Maintenance schedules & history_). Shown in a **Documents** tab on the object page (`HouseholdObjectView.vue`).
- Copy the files into an `attachments/` folder inside the app-data directory and store only metadata in SQLite.
- `tauri-plugin-dialog` (file picker) is already in place. Copying, deleting and opening files go through **small Rust commands**, as for backups. No unrestricted file system access. The Rust side gets its own module `src-tauri/src/attachments/` with the same `mod.rs` (service) + `repository.rs` (SQL) split as `data_transfer/`.
- Backups and exports currently contain only the database. Once attachments exist, backup/restore and export/import (Settings → Data) must include the `attachments/` folder too, e.g. as a ZIP (new crate `zip`, discuss first). This can be a separate step.

**Data model (decided):** one `attachments` table with a **real foreign key column per owner** ("exclusive arc"). It starts with `household_object_id` only. Later migrations add `expense_id`, `maintenance_record_id`, … (`ALTER TABLE ADD COLUMN`, each `ON DELETE CASCADE`). The `AttachmentValues` value object checks that exactly one owner column is set.

- Columns: `id`, owner FK column(s), `stored_name` (random unique file name + extension), `original_name`, `mime_type`, `size_bytes`, `document_type` (invoice / contract / manual / warranty / photo / other), `document_date` ('YYYY-MM-DD', optional), `notes`, `created_at`, `updated_at`.
- Example: `invoice-heatpump.pdf` → row with `household_object_id = 7`, `document_type = 'invoice'`, `document_date = '2025-10-01'`.
- Rejected: a generic `owner_type` + `owner_id` pair. SQLite can't enforce that link, so deleting an owner would leave orphaned rows.
- A cascade delete removes rows, not files. A Rust cleanup on startup deletes files in `attachments/` that have no row any more.

---

## 2. Maintenance schedules & history (L)

**Goal:** every household object can have a **last maintenance date** and a **required maintenance interval**. HomeBase calculates when each object needs maintenance next, and the dashboard (see _Dashboard_) shows which objects are due and how urgent they are.

**Data (decided):** no interim columns on `household_objects`. Go straight to two child tables of `household_objects` (see the child-table rule in AGENTS.md), so no later migration has to move data:

- `maintenance_tasks`: `household_object_id` (FK, `ON DELETE CASCADE`), `name`, `interval_value` (integer > 0), `interval_unit` (CHECK: day / week / month / year), `last_done_date` ('YYYY-MM-DD', optional), `notes`, `active`, timestamps.
  Example: one heat pump with "Service, every 1 year" and "Change filter, every 3 months".
- `maintenance_records` (history): `household_object_id` (FK, cascade), `task_id` (FK, `ON DELETE SET NULL`, optional), `date`, `cost_cents`, `provider`, `notes`, timestamps.
  "Mark as maintained" adds a record and updates the task's `last_done_date` in one transaction (one `transaction([...])` call in the repository).
- Receipts for a record attach through `attachments.maintenance_record_id` (see _Documents & attachments_).
- Shown in a **Maintenance** tab on the object page (`HouseholdObjectView.vue`).

**Calculation** (in a value object such as `MaintenanceSchedule` in `types/`, not stored)

- Next due date = last maintenance date + interval. If there is no last maintenance date, fall back to the installation date, then the purchase date. If none of these exist, the status is "unknown".
- Urgency levels:
  - **Overdue** (error colour): the due date has passed. Sort by how many days overdue.
  - **Due soon** (warning colour): due within 30 days, or within 10% of the interval for short intervals.
  - **OK** (success colour): everything else.
  - **Not scheduled**: no interval set. Not shown on the dashboard.

**UI**

- A status chip on the object list item, on the object page and on the category tile (e.g. "2 overdue").
- Dashboard widget: overdue and due-soon objects sorted by urgency, each with its due date and a "Mark as maintained" action.

**Open questions:** Is the interval in months enough, or are days/weeks needed? Should the "due soon" window be configurable (see _Settings_)? Should costs from maintenance records feed into the investments overview?

---

## 3. Warranty tracking (M)

- Columns or a child table for warranty end date, provider and conditions per object. The warranty certificate itself is a document (see _Documents & attachments_).
- "Expiring soon" indicators and filters, plus a dashboard widget (see _Dashboard_).
- Waranty tracking should be a toggleable feature for objects the user decides he wants to track warranties for

---

## 4. Dashboard (L)

**When:** after _Maintenance schedules & history_ and _Warranty tracking_, so the default layout shows due maintenance and expiring warranties from the start, not only counts.

**Goal:** the dashboard is the start page. It opens first when the app starts and shows the most important statuses of the household at a glance. It is **configurable**. By default it shows a sensible set of key figures and charts, and the user can add, remove, rearrange and configure these widgets.

**Rough steps**

1. **Route and navigation:** new `/dashboard` route as the default route (replaces `/investments` as the default) and the first item in `AppSidebar.vue`.
2. **Widget framework:** a registry of widget types in the frontend. Each type has an id, a title, a component, its data source (a composable) and optional settings (e.g. which category, which time range, chart type). Later features register their own widgets instead of changing the dashboard itself.
3. **First widgets:** upcoming maintenance, expiring warranties, planned investments (total amount, count per priority), inventory (number of objects per category, total purchase value), recently added objects.
4. **Default layout:** a fixed default set of widgets for a new installation, plus a "Reset to default" action.
5. **Edit mode:** a toggle to add a widget from a list, remove it, reorder it (drag and drop) and choose its size (e.g. small / medium / large), and a settings dialog per widget.
6. **Persistence:** migration for a `dashboard_widgets` table (widget type, position, size, settings as JSON), following the usual layers (value object → repository → service → composable, see AGENTS.md).
7. **Later widgets**, added together with their features: finance summary for the current year (see _Finance management_), smart home status (see _Smart home device integration_).

**New dependencies (discuss first):** a chart library that works fully offline (e.g. ECharts via `vue-echarts`, or Chart.js via `vue-chartjs`). A grid layout library only if simple reordering plus fixed sizes isn't enough.

**Open questions:** free-form grid (any position and size) or a simpler ordered list with fixed sizes? Which widgets belong in the default layout? One dashboard, or several (e.g. "Finances", "House")?

---

## 5. Reminders & notifications (M)

Depends on _Maintenance schedules & history_ and _Warranty tracking_.

- Native notifications via `tauri-plugin-notification` for maintenance that is due and warranties that are expiring.
- Check on app start, and optionally on an interval while the app is open. Background reminders while the app is closed would need an autostart/tray approach (`tauri-plugin-autostart`), so evaluate that separately.

---

## 6. Settings (S)

- The Settings page exists (`/settings`, gear icon at the bottom of the sidebar) with one section, **Data** (backup, restore, export, import). New sections are added to the list in `SettingsView.vue` and as child routes of `/settings`.
- Add a **General** section: currency (currently fixed to EUR in `src/utils/currency.ts`), language and locale/number format (see _Localisation_) and theme (see _Dark mode_).
- Store them in a `settings` key/value table. Because export/import covers every user table, the settings are included automatically.

---

## 7. Localisation (M)

Depends on _Settings_ (language choice).

- German UI (plus English) using `vue-i18n` (new dependency, discuss first). Move all UI strings out of the components.
- Every new view adds strings that have to be moved later, so this gets more expensive the longer it waits.

---

## 8. Dark mode (S)

Depends on _Settings_.

- Add a dark theme in `src/plugins/vuetify.ts`, with a toggle in Settings (light / dark / system).
- Check that the custom CSS uses theme variables, not hard-coded colours.

---

## 9. Search & filtering (S–M)

- Global search across objects and investments. Filters by category, priority and status.
- Open question: include object attributes (e.g. find all objects with "Refrigerant = R290")? One row per attribute makes this plain SQL.

---

## 10. Investment improvements (S–M)

- Drag-and-drop reordering (the handles already exist). Persist `sort_order` in a transaction.
- Status: planned → purchased. "Convert to inventory object" when an investment is bought.
- Optional target date, budget and savings progress.

---

## 11. Finance management: household expenses for the tax return (L)

Depends on _Documents & attachments_.

**Goal:** the user records household expenses and attaches proof (invoices, receipts, screenshots, bank statements). At the end of the year, HomeBase creates a PDF summary of the expenses relevant for the tax return (Steuererklärung), with the receipts attached, ready to hand to the tax office or a tax advisor.

**Rough steps**

1. **Data model:** migration for an `expenses` table: date paid, amount in cents, description, payee/provider, tax category, payment method, notes, optional link to a household object or investment. The tax year follows from the payment date.
2. **Tax categories:** a predefined but editable list, e.g. household-related services and tradesman services (_haushaltsnahe Dienstleistungen / Handwerkerleistungen_, §35a EStG), home office, insurance, donations, other. For §35a, store the **labour cost share** separately, because only that part is deductible, and note whether the payment was a bank transfer (cash payments don't count).
3. **Receipts:** attach one or more files to each expense, using the attachments storage (see _Documents & attachments_). Show a preview of images and PDFs.
4. **Expenses view:** list with filters (year, category), totals per category and year, create/edit/delete dialogs.
5. **PDF export:** pick a tax year (and optionally categories). Build a summary with totals per category, a table of all expenses, and the receipts as an appendix. Save it to a location the user picks.
6. **Dashboard widget:** expenses of the current year per category (see _Dashboard_).
7. Optional: when an investment is marked as purchased (see _Investment improvements_), offer to create the matching expense.

**New dependencies (discuss first):** PDF generation. Options: a frontend library (e.g. `pdfmake` or `jsPDF`), or a Rust crate (e.g. `printpdf`, plus `lopdf` to append PDF receipts). Appending existing PDF receipts is the hard part, so it decides which option we pick.

**Open questions:** which tax categories are actually needed? Should the PDF follow the structure of the tax forms (e.g. the lines of _Anlage Haushaltsnahe Aufwendungen_)? Expenses only, or income too (e.g. rental income, PV feed-in)? HomeBase only collects and summarises. It doesn't give tax advice.

---

## 12. Distribution (M)

- Builds on the release workflow (`.github/workflows/release.yml`), which builds Windows and Linux installers.
- Code signing for Windows installers (avoids SmartScreen warnings).
- Auto-updates via `tauri-plugin-updater`. This needs an update server and internet, so it must be optional.
- macOS builds: see _macOS builds_.

---

## 13. macOS builds (S–M)

Builds on the release workflow (`.github/workflows/release.yml`), which builds Windows and Linux installers only.

- Add `macos-latest` to the release workflow's matrix with `args: --target universal-apple-darwin` (one `.dmg` for Intel and Apple Silicon Macs). This needs both Rust targets installed in that job (`aarch64-apple-darwin`, `x86_64-apple-darwin`).
- Signing: without it, macOS blocks the app ("unidentified developer" / "damaged"). At minimum, use ad-hoc signing (`bundle.macOS.signingIdentity: "-"`) so users can allow the app in System Settings → Privacy & Security. Proper signing + notarization needs an Apple Developer account ($99/year), with the certificate and credentials stored as GitHub secrets. This ties in with code signing (see _Distribution_).
- Check the macOS paths in the docs (database: `~/Library/Application Support/com.homebase.desktop/`, logs: `~/Library/Logs/com.homebase.desktop`).
- Test the built app on a real Mac before publishing a release that includes it.
- Optional: add `macos-latest` to the CI test matrix too.

---

## 14. Smart home device integration (L)

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
