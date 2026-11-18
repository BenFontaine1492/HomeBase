# Planned Features

Rough implementation notes for features that don't exist yet. Every entry is a starting point to refine before implementing it, not a final design.

- **The number is the priority:** item 1 is next. When priorities change, reorder and renumber the items.
- **Refer to other items by name**, never by number (e.g. "depends on _Settings_"), so renumbering never breaks a reference.
- Completed items are deleted (see the feature workflow in AGENTS.md).
- Tasks that are triggered by an external event, not by priority, are listed at the end under _Triggered tasks_.

Effort: **S** = hours, **M** = a few days, **L** = a week or more.

---

## 1. Finance management: household expenses for the tax return (L)

Documents exist: costs become a new attachment owner (`cost_id`, see the recipe in migration 0005 and `OWNER_COLUMNS` in `attachment.repository.ts`).

**Goal:** the user records household expenses and attaches proof (invoices, receipts, screenshots, bank statements). At the end of the year, HomeBase creates a PDF summary of the expenses relevant for the tax return (Steuererklärung), with the receipts attached, ready to hand to the tax office or a tax advisor.

**Direction (decided):** every cost of the household goes into **one general costs table**, not one table per feature. Maintenance costs become costs of type `maintenance`, and recurring costs (insurance, energy, subscriptions, …) are **rules** that lead to cost rows. The tax-return PDF, the Costs view and the dashboard cost widget all read the same rows. The data model is still to be discussed (see _Data model: open questions_ below).

**Rough steps**

1. **Data model:** migration for a general `costs` table (working name; replaces the `expenses` table of earlier notes): date paid, amount in cents, **cost type** (e.g. maintenance, repair, purchase, insurance, energy, subscription, tax, other), description, payee/provider, tax category, payment method, notes, optional link to a household object, a maintenance record or an investment. The tax year follows from the payment date. Plus a table for **recurring cost rules** (amount, interval, start/end date, type, object), reusing the interval logic of maintenance tasks (`Interval`, `addInterval` in `types/maintenance-schedule.ts`).
2. **Move maintenance costs:** a new migration copies `maintenance_records.cost_cents` into cost rows of type `maintenance` linked to their record, then removes the column (never edit migration 0004). The "Mark as done" dialog keeps its cost field and writes the cost row in the same transaction. The dashboard's _Maintenance costs_ widget becomes a general _Costs_ widget with a cost-type filter (stored widget settings stay readable: `widgetSettingsFrom` falls back to defaults).
3. **Tax categories:** a predefined but editable list, e.g. household-related services and tradesman services (_haushaltsnahe Dienstleistungen / Handwerkerleistungen_, §35a EStG), home office, insurance, donations, other. For §35a, store the **labour cost share** separately, because only that part is deductible, and note whether the payment was a bank transfer (cash payments don't count).
4. **Receipts:** attach one or more files to each cost, using the attachments storage (`AttachmentList` with a `{ kind: 'cost', id }` owner; see _Data model: decisions_). Show a preview of images and PDFs (see _Backups include documents_ for previews).
5. **Costs view:** list with filters (year, cost type, tax category), totals per category and year, create/edit/delete dialogs.
6. **PDF export:** pick a tax year (and optionally categories). Build a summary with totals per category, a table of all expenses, and the receipts as an appendix. Save it to a location the user picks.
7. **Dashboard widget:** expenses of the current year per category. A new widget type is an entry in `WIDGET_TYPES` (`types/dashboard.ts`, with the settings it offers) plus its component in `components/dashboard/widget-registry.ts`; the dashboard itself doesn't change.
8. Optional: when an investment is marked as purchased (Investments page, "Mark as purchased…", which already offers to add it to the inventory), offer to create the matching expense.

**New dependencies (discuss first):** PDF generation. Options: a frontend library (e.g. `pdfmake` or `jsPDF`), or a Rust crate (e.g. `printpdf`, plus `lopdf` to append PDF receipts). Appending existing PDF receipts is the hard part, so it decides which option we pick.

**Data model: decisions**

- **Cost type and tax category are separate fields.** The type says what the money was for (maintenance, insurance, …), the tax category how it counts for the tax return (§35a, none, …); a maintenance cost can be a §35a tradesman service or not. Cost type = fixed list (`CHECK … IN`), tax category = optional, user-editable list (own table).
- **Recurring rules suggest, the user confirms** (default): a due payment shows as e.g. "Insurance €40 due, paid?"; confirming creates the cost row, with the amount correctable (price changes, one-off extras). Like "Mark as done" for maintenance. A rule can be set to **autopay** (e.g. rent or anything debited automatically from the bank account): its rows are created automatically when due (checked at app start, catching up on missed dates) and can still be edited or deleted. The rule needs a column for this and for the date up to which rows were created.
- **Receipts:** costs get their own receipts, like the maintenance history does (a new attachment owner `cost`). Receipts of maintenance stay on the maintenance record; for a cost linked to a maintenance record, the tax PDF also includes that record's receipts.
- **Links:** a cost is linked to at most one object, maintenance record or investment (or none). An invoice covering several objects is entered as one cost per object.

**Data model: still open**

- **Income** (PV feed-in, rental income): the same table with a direction, or a separate table later? Proposal: separate, later.

**Other open questions:** which tax categories are actually needed? Should the PDF follow the structure of the tax forms (e.g. the lines of _Anlage Haushaltsnahe Aufwendungen_)? HomeBase only collects and summarises. It doesn't give tax advice.

---

## 2. Distribution (M)

- Builds on the release workflow (`.github/workflows/release.yml`), which builds Windows and Linux installers.
- Code signing for Windows installers (avoids SmartScreen warnings).
- Auto-updates via `tauri-plugin-updater`. This needs an update server and internet, so it must be optional.
- macOS builds: see _macOS builds_.

---

## 3. macOS builds (S–M)

Builds on the release workflow (`.github/workflows/release.yml`), which builds Windows and Linux installers only.

- Add `macos-latest` to the release workflow's matrix with `args: --target universal-apple-darwin` (one `.dmg` for Intel and Apple Silicon Macs). This needs both Rust targets installed in that job (`aarch64-apple-darwin`, `x86_64-apple-darwin`).
- Signing: without it, macOS blocks the app ("unidentified developer" / "damaged"). At minimum, use ad-hoc signing (`bundle.macOS.signingIdentity: "-"`) so users can allow the app in System Settings → Privacy & Security. Proper signing + notarization needs an Apple Developer account ($99/year), with the certificate and credentials stored as GitHub secrets. This ties in with code signing (see _Distribution_).
- Check the macOS paths in the docs (database: `~/Library/Application Support/com.homebase.desktop/`, logs: `~/Library/Logs/com.homebase.desktop`).
- Test the built app on a real Mac before publishing a release that includes it.
- Optional: add `macos-latest` to the CI test matrix too.

---

## 4. Smart home device integration (L)

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
6. Dashboard widget: smart home status (a new widget type, see _Finance management_, step "Dashboard widget", for how).

**Open questions:** works only on the local network (fine for offline-first)? Polling vs. WebSocket subscriptions? Which device types first?

---

## 5. Backups include documents (M)

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
