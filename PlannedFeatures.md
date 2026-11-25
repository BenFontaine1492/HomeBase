# Planned Features

Rough implementation notes for features that don't exist yet. Every entry is a starting point to refine before implementing it, not a final design.

- **The number is the priority:** item 1 is next. When priorities change, reorder and renumber the items.
- **Refer to other items by name**, never by number (e.g. "depends on _Settings_"), so renumbering never breaks a reference.
- Completed items are deleted (see the feature workflow in AGENTS.md).
- Tasks that are triggered by an external event, not by priority, are listed at the end under _Triggered tasks_.

Effort: **S** = hours, **M** = a few days, **L** = a week or more.

---

## 1. Export by category: choose what to include (M)

Refactoring of the export for a tax advisor. Since costs and income each have one free-text category (migration 0014), the export should not care whether an entry is a cost or income, nor about any type: it exports categories. Today the dialog (`TaxExportDialog.vue`) only has the checkboxes "Costs" and "Income", and every category of the year is included.

- **UX:** after picking the year, the dialog lists the categories of that year, each with its count and sum, grouped under "Costs" and "Income" (e.g. "Handwerkerleistungen, 3 entries, 1.250,00 €"). All are ticked by default; the user unticks what to leave out (e.g. "Miete" or "Gehalt" when the advisor doesn't need them). "Select all / none" per group. The summary below updates as categories are ticked. Entries without a category are a group of their own ("No category"), off by default? Decide with the user.
- **Remember the choice:** optionally store the excluded categories as a setting (key/value, see "Setting" in AGENTS.md), so next year's export starts with the same selection. Compare by `categoryKey` (case-insensitive).
- **Plan:** `TaxExportSelection` gets the selected category keys per kind instead of `includeCosts` / `includeIncome` (a kind with nothing selected leaves out its sheet, as today). `exportedCosts` and `exportedIncome` in `types/tax-export.ts` then share one function over "entries with a date, category and amount"; the sheets (`types/tax-export-sheets.ts`) are already the same for both (`entrySheet`).
- **Native side:** no change; it only carries out the plan.
- Builds on nothing; do it before _Better layout of the tax export workbook_, which then lays out the chosen categories.
- Tests: the selection in `test/types/tax-export.spec.ts` (excluded categories, case-insensitive keys, a kind without any selected category), the summary in `useTaxExport.spec.ts`.

---

## 2. Better layout of the tax export workbook (S–M)

The workbook of the export for a tax advisor (`Ausgaben <year>.xlsx`, `Einnahmen <year>.xlsx` or `Einnahmen und Ausgaben <year>.xlsx`, after what is exported) works, but looks poor: plain grid, fixed column widths, no visual grouping. It is the first thing the tax advisor sees, so it should read like a tidy statement.

- Where: the cells and column widths come from `buildTaxExport` (`src/types/tax-export.ts`), the formats from `src-tauri/src/tax_export/workbook.rs` (`Formats`: title, header, text, amount, date). The plan stays generic (sheets, columns, rows, footer); new looks become new cell or column kinds in the plan, so the native side keeps no texts of its own.
- First step: export a sample year, then agree on the look with the user (mockups of the sheets side by side) before changing code.
- Ideas to decide on:
  - An Excel table (`rust_xlsxwriter::Table`): header style, banded rows and filter buttons in one step; or a header fill colour + thin row borders.
  - Column widths that fit the content (`Worksheet::autofit`, with a maximum for description and notes, wrapped text there).
  - A clear title block (title, tax year, created on, "Erstellt mit HomeBase", currency), set apart from the table.
  - Group rows per category: a category heading row, its entries, a subtotal row; the grand total at the end (`SUBTOTAL` formulas, so filtering keeps the sums right, or fixed numbers, as now).
  - Number and date formats: amounts right-aligned with the currency; dates as in Settings → General.
  - The receipt column: the link text as the file name, links styled as links; "kein Beleg" in a muted colour so missing receipts stand out.
  - Totals sheet: one row per category (count, sum), the totals highlighted.
  - Printing: landscape, fit to one page wide, the header row repeated on each page, page numbers in the footer, the title in the header.
- The layout must work for the costs sheet, the income sheet and the totals sheet. With both exported, the totals sheet has a part per kind, each starting with a heading row in plain text ("Ausgaben", "Einnahmen"), and two total rows in the footer ("Summe Ausgaben", "Summe Einnahmen"); a heading cell kind would set those parts apart.
- Tests: the cell kinds and their parsing in `tax_export/tests.rs`, the plan in `test/types/tax-export.spec.ts`.

---

## 3. Distribution (M)

- Builds on the release workflow (`.github/workflows/release.yml`), which builds Windows and Linux installers.
- Code signing for Windows installers (avoids SmartScreen warnings).
- Auto-updates via `tauri-plugin-updater`. This needs an update server and internet, so it must be optional.
- macOS builds: see _macOS builds_.

---

## 4. macOS builds (S–M)

Builds on the release workflow (`.github/workflows/release.yml`), which builds Windows and Linux installers only.

- Add `macos-latest` to the release workflow's matrix with `args: --target universal-apple-darwin` (one `.dmg` for Intel and Apple Silicon Macs). This needs both Rust targets installed in that job (`aarch64-apple-darwin`, `x86_64-apple-darwin`).
- Signing: without it, macOS blocks the app ("unidentified developer" / "damaged"). At minimum, use ad-hoc signing (`bundle.macOS.signingIdentity: "-"`) so users can allow the app in System Settings → Privacy & Security. Proper signing + notarization needs an Apple Developer account ($99/year), with the certificate and credentials stored as GitHub secrets. This ties in with code signing (see _Distribution_).
- Check the macOS paths in the docs (database: `~/Library/Application Support/com.homebase.desktop/`, logs: `~/Library/Logs/com.homebase.desktop`).
- Test the built app on a real Mac before publishing a release that includes it.
- Optional: add `macos-latest` to the CI test matrix too.

---

## 5. Smart home device integration (L)

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
6. Dashboard widget: smart home status (a new widget type, see "Adding a dashboard widget" in AGENTS.md).

**Open questions:** works only on the local network (fine for offline-first)? Polling vs. WebSocket subscriptions? Which device types first?

---

## 6. Backups include documents (M)

Documents (the `attachments` table, migration 0005) are files in `attachments/` next to the database. Backups (Settings → Data) still contain only the database, and JSON/CSV exports only the data, so a backup is not complete yet.

- **Backup as ZIP:** `homebase.db` (via `VACUUM INTO`, as today) plus the `attachments/` folder in one `.zip`. New crate `zip` with minimal features (deflate through the `flate2` that is already compiled; no bzip2/zstd/lzma). Restoring old `.db` backups must keep working.
- **Restore:** validate the database in the ZIP as today (`inspect_backup`), then swap the database **and** the `attachments/` folder, keeping the previous folder next to `homebase.before-restore.db`. Roll back both on failure.
- **Export / import:** decide whether the JSON export becomes a ZIP with the files too, or stays data-only (and says so).
- **Then remove the interim safety net:** today `restore_backup` / `import_json` call `attachments::set_aside_orphans`, which moves files the new data doesn't use into `attachments.before-restore` / `attachments.before-import`, so the startup cleanup can't delete them. Remove it, and the notes in `RestoreBackupDialog.vue`, `ImportDataDialog.vue` and `BackupRestoreCard.vue`, once backups carry the files.
- Later, for documents: a "Save a copy…" action, and previews/thumbnails of images and PDFs (needs an asset protocol scope or a Rust command that returns the bytes; the CSP stays offline-only). This includes the receipts of costs (`AttachmentList` with a `cost` owner).

---

## 7. Faster CI pipelines (S–M)

Research first, then change the workflows. On Linux, `.github/workflows/ci.yml` (`rust unit-test (ubuntu-24.04)`) spends 5–15 min just installing the system libraries Tauri needs (`apt-get install libwebkit2gtk-4.1-dev …`). That job is set as optional (not a required check) on GitHub, so merges don't wait for it. `release.yml` still runs it before building.

- **Already tried, made the Linux job fail:** caching the packages with `awalsh128/cache-apt-pkgs-action`, a shorter package list (`libwebkit2gtk-4.1-dev libxdo-dev libssl-dev`, `--no-install-recommends`), and turning off the `man-db` index rebuild. These were reverted. Find out why it failed before trying any of them again.
- **Ideas to research:** a prebuilt container image with the libraries (`container:` on the job, built once and stored in GHCR); a faster apt mirror or a `.deb` cache we write ourselves; `sccache`, or a better `Swatinem/rust-cache` setup (cache hit rate, `cache-on-failure`); fewer or lighter jobs (e.g. Linux Rust tests only in `release.yml`, `npx vite build` shared through an artifact); `cargo-nextest`.
- Measure every step's time before and after (from the job logs), and keep the 100% coverage gates and the release checks working as they do now.

## 8. Track savings progress

As a user i want to be able to plan the progress of savings and generate a roadmap from the future investments tab based on the incomes provided in the finances tab 

## 9. Separate Investments into Projects

As a user i want to be able to track separate projects eg. renovating a house, restoring an oldtimer car etc. 
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
