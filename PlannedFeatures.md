# Planned Features

Rough implementation notes for features that don't exist yet. Every entry is a starting point to refine before implementing it, not a final design.

Effort: **S** = hours, **M** = a few days, **L** = a week or more.
---

## 2. Dashboard (L)

**When:** the first feature after item 1 (tests, CI and release workflow) is done.

**Goal:** the dashboard is the start page. It opens first when the app starts and shows the most important statuses of the household at a glance. It is **configurable**. By default it shows a sensible set of key figures and charts, and the user can add, remove, rearrange and configure these widgets.

**Rough steps**
1. **Route and navigation:** new `/dashboard` route as the default route (replaces `/investments` as the default) and the first item in `AppSidebar.vue`.
2. **Widget framework:** a registry of widget types in the frontend. Each type has an id, a title, a component, its data source (a composable) and optional settings (e.g. which category, which time range, chart type). Later features register their own widgets instead of changing the dashboard itself.
3. **First widgets (using data that exists today):** planned investments (total amount, count per priority), inventory (number of objects per category, total purchase value), recently added objects.
4. **Default layout:** a fixed default set of widgets for a new installation, plus a "Reset to default" action.
5. **Edit mode:** a toggle to add a widget from a list, remove it, reorder it (drag and drop) and choose its size (e.g. small / medium / large), and a settings dialog per widget.
6. **Persistence:** migration for a `dashboard_widgets` table (widget type, position, size, settings as JSON), following the usual service → composable layering.
7. **Later widgets**, added together with their features: expiring warranties (item 3), finance summary for the current year (item 5), upcoming maintenance (item 6), smart home status (item 13).

**New dependencies (discuss first):** a chart library that works fully offline (e.g. ECharts via `vue-echarts`, or Chart.js via `vue-chartjs`). A grid layout library only if simple reordering plus fixed sizes isn't enough.

**Open questions:** free-form grid (any position and size) or a simpler ordered list with fixed sizes? Which widgets belong in the default layout? One dashboard, or several (e.g. "Finances", "House")?

---

## 3. Warranty tracking (M)

- Columns or a table for warranty end date, provider and conditions per object.
- "Expiring soon" indicators and filters, plus a dashboard widget (item 2).

---

## 4. Documents & attachments (M)

- Attach invoices, manuals, warranty certificates and photos to objects or investments.
- Copy the files into an `attachments/` folder inside the app-data directory and store only metadata in SQLite.
- `tauri-plugin-dialog` (file picker) is already in place. Copying files needs either a **scoped** `tauri-plugin-fs` or a small Rust command, as for backups. No unrestricted file system access.
- Backups and exports currently contain only the database. Once attachments exist, backup/restore and export/import (Settings → Data) must include the `attachments/` folder too, e.g. as a ZIP.

---

## 5. Finance management: household expenses for the tax return (L)

Depends on item 4 (attachments).

**Goal:** the user records household expenses and attaches proof (invoices, receipts, screenshots, bank statements). At the end of the year, HomeBase creates a PDF summary of the expenses relevant for the tax return (Steuererklärung), with the receipts attached, ready to hand to the tax office or a tax advisor.

**Rough steps**
1. **Data model:** migration for an `expenses` table: date paid, amount in cents, description, payee/provider, tax category, payment method, notes, optional link to a household object or investment. The tax year follows from the payment date.
2. **Tax categories:** a predefined but editable list, e.g. household-related services and tradesman services (*haushaltsnahe Dienstleistungen / Handwerkerleistungen*, §35a EStG), home office, insurance, donations, other. For §35a, store the **labour cost share** separately, because only that part is deductible, and note whether the payment was a bank transfer (cash payments don't count).
3. **Receipts:** attach one or more files to each expense, using the attachments storage from item 4. Show a preview of images and PDFs.
4. **Expenses view:** list with filters (year, category), totals per category and year, create/edit/delete dialogs.
5. **PDF export:** pick a tax year (and optionally categories). Build a summary with totals per category, a table of all expenses, and the receipts as an appendix. Save it to a location the user picks.
6. **Dashboard widget:** expenses of the current year per category (item 2).
7. Optional: when an investment is marked as purchased (item 11), offer to create the matching expense.

**New dependencies (discuss first):** PDF generation. Options: a frontend library (e.g. `pdfmake` or `jsPDF`), or a Rust crate (e.g. `printpdf`, plus `lopdf` to append PDF receipts). Appending existing PDF receipts is the hard part, so it decides which option we pick.

**Open questions:** which tax categories are actually needed? Should the PDF follow the structure of the tax forms (e.g. the lines of *Anlage Haushaltsnahe Aufwendungen*)? Expenses only, or income too (e.g. rental income, PV feed-in)? HomeBase only collects and summarises. It doesn't give tax advice.

---

## 6. Maintenance schedules & history (L)

**Goal:** every household object can have a **last maintenance date** and a **required maintenance interval**. HomeBase calculates when each object needs maintenance next, and the dashboard (item 2) shows which objects are due and how urgent they are.

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

**Open questions:** Is the interval in months enough, or are days/weeks needed? Should the "due soon" window be configurable in Settings (item 8)? Should costs from maintenance records feed into the investments overview?

---

## 7. Reminders & notifications (M)

Depends on items 3 and 6.

- Native notifications via `tauri-plugin-notification` for maintenance that is due and warranties that are expiring.
- Check on app start, and optionally on an interval while the app is open. Background reminders while the app is closed would need an autostart/tray approach (`tauri-plugin-autostart`), so evaluate that separately.

---

## 8. Settings (S)

- The Settings page exists (`/settings`, gear icon at the bottom of the sidebar) with one section, **Data** (backup, restore, export, import). New sections are added to the list in `SettingsView.vue` and as child routes of `/settings`.
- Add a **General** section: currency (currently fixed to EUR in `src/utils/currency.ts`), locale/number format and theme.
- Store them in a `settings` key/value table. Because export/import covers every user table, the settings are included automatically.

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

## 12. Localisation (M)

- German UI (plus English) using `vue-i18n`. Move all UI strings out of the components.

---

## 13. Smart home device integration (L)

**Goal:** show the status of smart home devices and control them from HomeBase. Where possible, link devices to inventory objects (e.g. the heat pump's live data, the PV system's output).

**Approach (local-first, no cloud requirement)**
- Integrate through a **hub** rather than individual vendor APIs. The first target is **Home Assistant**, through its local REST + WebSocket API with a long-lived access token. Later options: MQTT, Matter.
- Network access goes through the official `tauri-plugin-http`, with URL scopes limited to the configured hub address. Alternatively, a small Rust command if WebSocket/MQTT needs it.
- Store the access token in the OS credential store (e.g. the keyring crate or the Stronghold plugin), **never** in SQLite as plain text.

**Rough steps**
1. Settings section (`/settings/smart-home`): hub URL + token, plus a "Test connection" button. The token is not in SQLite, so it is not part of backups or exports.
2. `smart-home.service.ts`, using the same layering as the other services. It returns typed devices/entities.
3. Devices view: list, status, simple actions (switch, set temperature).
4. Migration: `smart_home_links` table (device id ↔ household object id).
5. Optional: record readings (energy, temperature) for history charts.

**Open questions:** works only on the local network (fine for offline-first)? Polling vs. WebSocket subscriptions? Which device types first?

---

## 14. Distribution (M)

- Builds on the basic release workflow from item 1.
- Code signing for Windows installers (avoids SmartScreen warnings).
- Auto-updates via `tauri-plugin-updater`. This needs an update server and internet, so it must be optional.
- Linux builds are part of item 1, and macOS builds are item 17.

---

## 15. Move TypeScript toolchain from prerelease to stable (S)

*Triggered by an external event: do this as soon as stable releases ship, whatever its position in the list.*

TypeScript 7.1 beta and the `@vue/content-mapper` alpha are in use (type check is about 6x faster than TS 6 + `vue-tsc`: about 1 s vs 6 s). When stable releases ship:
- Replace the exact prerelease pins in `package.json` with the stable versions and remove `overrides.typescript`.
- Re-read the content-mapper docs for option or CLI changes and re-run `npm run typecheck` and `npm run build`.
- Check whether Vuetify (or the mapper) now accepts native attributes/events on `v-btn`; if so, revert the `v-bind="{ onClick: … }"` workarounds to plain `@click` and similar.
- Re-check Vue editor support for TS 7 and update the notes in `README.md` and `AGENTS.md`.

---

## 16. Dynamic object properties (L)

**Goal:** users can add their own properties to household objects (e.g. "Filter type", "Refrigerant", "Power (kW)"), and later attach documents and other items to them, instead of being limited to the fixed columns of `household_objects`.

**Why it is deferred:** objects currently have a fixed set of columns that map 1:1 onto `HouseholdObject`, the form dialog and the detail dialog. Dynamic properties need a different data model and a refactor of the object service, composable and components, so the current fixed fields stay as they are for now.

**Possible approach (to discuss)**
- `object_property_definitions` (id, category_id or global, name, type: text / number / date / boolean / select, unit, options, sort_order) and `object_property_values` (object_id, definition_id, value). This is an EAV model: typed values are stored as text and validated by the definition's type.
- Alternative: a JSON column on `household_objects` (simpler to store, harder to query and validate; SQLite's `json_extract` helps for filtering).
- Property definitions per category, so e.g. every "Heating" object gets the same extra fields.
- The form and detail dialogs render fields from the definitions instead of a hard-coded list.
- Attachments (item 4) and maintenance plans (item 6) attach to objects in the same way, so design the object detail page with sections/tabs for properties, documents and maintenance.
- Migration path: the existing fixed columns either stay as built-in properties or are migrated into the new tables in one new migration.

**Open questions:** per-category or global definitions? Which property types are needed? Should search/filter (item 10) work on custom properties?

---

## 17. macOS builds (S–M)

Builds on the release workflow from item 1, which builds Windows and Linux installers only.

- Add `macos-latest` to the release workflow's matrix with `args: --target universal-apple-darwin` (one `.dmg` for Intel and Apple Silicon Macs). This needs both Rust targets installed in that job (`aarch64-apple-darwin`, `x86_64-apple-darwin`).
- Signing: without it, macOS blocks the app ("unidentified developer" / "damaged"). At minimum, use ad-hoc signing (`bundle.macOS.signingIdentity: "-"`) so users can allow the app in System Settings → Privacy & Security. Proper signing + notarization needs an Apple Developer account ($99/year), with the certificate and credentials stored as GitHub secrets. This ties in with item 14 (code signing).
- Check the macOS paths in the docs (database: `~/Library/Application Support/com.homebase.desktop/`, logs: `~/Library/Logs/com.homebase.desktop`).
- Test the built app on a real Mac before publishing a release that includes it.
- Optional: add `macos-latest` to the CI test matrix too.
