# AGENTS.md

Quick orientation for coding agents. Read this first, then open only the files you need.

## What this is

HomeBase is an offline Windows-first desktop app for household management: Tauri 2 + Vue 3 + Vuetify 4 + SQLite. Implemented so far: an Investments page (list/add/edit/delete), a household Inventory (user-defined categories + objects, each with an object page: details + user-defined attributes, documents, maintenance tasks + history) and Settings → Data (backup/restore, JSON/CSV export, JSON import) / Maintenance ("due soon" window). The roadmap is in `PlannedFeatures.md`, and setup details are in `README.md`.

## Working conventions

- **The user runs build/dev commands themselves.** Ask them to run the relevant command and paste the output, instead of running it yourself.
  **Prefer the `make` targets** (Windows/PowerShell): `make startup` (app with HMR) · `make stop` · `make teardown` (stop app, dev server, leftover Vite/Vitest/Tauri CLI and Rust build processes) · `make test` (format check + lint + type-check + TS and Rust tests with the 100% coverage gate; the single command to verify changes) · `make linting` (format all files with Oxfmt, then `oxlint --fix`; lists what is left to fix by hand) · `make audit-fix` (`npm audit fix` (never `--force`), checks that `node_modules` still matches the lock file, then `scripts/audit.mjs`).
  Use the npm scripts only for steps without a target:
  `npm run typecheck` · `npm run build` (frontend) · `npm run tauri dev` (app with HMR) · `npm run tauri build` (installers → `src-tauri/target/release/bundle/{nsis,msi}/`) · `npm install` ·
  `npm run test:coverage` (Vitest) · `npm run coverage:rust` (cargo llvm-cov) · `npm run lint` / `lint:fix` · `npm run format` / `format:check`
- **Backend code needs tests, and coverage is gated at 100%** (TS: lines/branches/functions/statements; Rust: lines). Add or update the `*.spec.ts` in `test/` (mirrors `src/`, e.g. `src/services/x.ts` → `test/services/x.spec.ts`) for every changed file in `services/`, `composables/`, `utils/`, `types/`, and Rust tests for changes in `src-tauri/src`. Avoid unreachable branches (e.g. `?? ''` on values that are never undefined): V8 counts them as uncovered.
- **Feature workflow:** read the task in `PlannedFeatures.md` → implement it → **delete the completed task** from `PlannedFeatures.md` (move any decisions other entries still need into those entries or into AGENTS.md, and fix references to it) → update `README.md` (and this file) if they are no longer accurate. Partly done tasks stay, with only the open parts. In `PlannedFeatures.md` the number is the priority (item 1 is next); refer to other items by name, never by number.
- Don't commit. The user commits after testing.
- Do not add Pinia, Express, REST APIs, Docker or other servers. Discuss any new dependency before adding it.

## Skip these (large / generated)

`node_modules/`, `dist/`, `src-tauri/target/`, `src-tauri/gen/`, `src-tauri/icons/` (generated from `icons/app-icon.svg`), `package-lock.json`, `src-tauri/Cargo.lock`.

## Map

```text
src/
  main.ts, App.vue              bootstrap + shell (sidebar + <router-view>)
  router/index.ts               routes: /investments (default), /inventory (?view=list),
                                /inventory/category/:categoryId ('none' = uncategorized),
                                /inventory/object/:objectId (object page, ?tab=documents|maintenance),
                                /settings → /settings/data, /settings/maintenance — hash history
  plugins/vuetify.ts            theme colours (incl. priority-high/medium/low) + component defaults
  assets/styles/main.css        global overrides (font, button case, margin reset)
  types/investment.ts           Investment, InvestmentInput, InvestmentPriority, InvestmentValues (value object)
  types/household-category.ts   HouseholdCategory(+Input), HouseholdCategoryValues, CATEGORY_ICONS, UNCATEGORIZED_LABEL
  types/household-object.ts     HouseholdObject(+Input), HouseholdObjectValues (incl. its attributes);
                                categoryId null = "No category assigned"; matchObjectNames (exact / near
                                duplicate-name rule, used for the warning in the object form)
  types/household-object-attribute.ts  user-defined attributes: value types text/number/date/boolean,
                                values as canonical text ('12.5', 'YYYY-MM-DD', '1'/'0'); +Draft (form row);
                                HouseholdObjectAttributeValues (from, listFrom, normaliseNumber)
  types/attachment.ts           Attachment, AttachmentOwner (union: object | maintenance-record; exactly one),
                                DOCUMENT_TYPES, AttachmentDetailsValues (editable fields, checked before copying),
                                AttachmentValues (owner + details + stored file), mimeTypeFor, guessDocumentType
  types/maintenance-task.ts     MaintenanceTask(+Input, Values): interval_value + interval_unit (day/week/month/year);
                                INTERVAL_PRESETS (form: yearly/monthly/weekly/custom days), intervalOf/presetOf/intervalLabel
  types/maintenance-record.ts   MaintenanceRecord(+Input, Values): history entry (date, cost, provider, optional task)
  types/maintenance-schedule.ts pure calculation (today is a parameter): scheduleOf (status overdue/due-soon/ok/
                                unknown/paused, due date), effectiveLastDone, dueSoonWindowDays, summarise, compareByUrgency
  types/settings.ts             AppSettings + DEFAULT_SETTINGS, SETTING_KEYS, settingsFrom (bad values → default),
                                SettingValue (value object; value null = back to default)
  types/data-transfer.ts        BackupInfo, ExportInfo, tableLabel()
  infrastructure/database.ts    database client: select(), execute() (plugin-sql),
                                transaction(statements) (Rust execute_transaction: all or nothing)
  infrastructure/database-error.ts  DatabaseError
  infrastructure/log.ts         logError() → native log file (@tauri-apps/plugin-log); used by main.ts
                                global handlers, database.ts and repositories/native-command.ts
  repositories/                 SQL + row mapping only (input: *Values value objects; "not found" = false)
    repository-errors.ts        MissingReferenceError (FOREIGN KEY), DuplicateValueError (UNIQUE),
                                rethrowConstraintError, insertedId
    investment.repository.ts    findAll / insert / update / remove
    household-category.repository.ts  same; remove(id, { deleteObjects }) is one transaction
    household-object.repository.ts    insert/update save the object + its attributes in one transaction
    household-object-attribute.repository.ts  findAll, replaceStatements (delete + insert, for that transaction)
    native-command.ts           callCommand(): invoke() a Rust command, log + turn its string error into an Error
    data-transfer.repository.ts the Rust data_transfer commands
    attachment.repository.ts    rows of documents; OWNER_COLUMNS maps owner kind → column (the one place for new owners)
    attachment-file.repository.ts  Rust commands: storeAttachmentFile(source), openAttachment(id)
    maintenance-task.repository.ts, maintenance-record.repository.ts  findAll / insert(objectId, values) / update / remove
    settings.repository.ts      findAll, write(SettingValue) (UPSERT, or DELETE for null)
  services/                     orchestration: build the value object (*Values.from), call repositories,
                                turn results / typed errors into user-facing messages; never SQL
    investment.service.ts, household-category.service.ts, household-object.service.ts,
    household-object-attribute.service.ts (list only), data-transfer.service.ts (file dialogs),
    attachment.service.ts (file picker; add = check details → copy file → insert row), maintenance.service.ts,
    settings.service.ts, service-errors.ts (rethrowWithMessage: typed repository error → message)
  composables/useInvestments.ts    module-level shared state + add/update/delete (reload after write)
  composables/useHouseholdObjects.ts      objects + all attributes (attributesOf, attributeNames), findObject,
                                          findNameMatches (same/similar names), per-category counts (countFor, uncategorizedCount)
  composables/useHouseholdCategories.ts   categories; deleteCategory also reloads objects + their child rows
  composables/useAttachments.ts           all documents; attachmentsOf(owner), pickFile, add/update/delete/open
  composables/useMaintenance.ts           all tasks + records; scheduleOf(task, object), summaryOf(objects), costOf,
                                          tasksOf/recordsOf/findTask; writes reload (deleteRecord also documents)
  composables/useSettings.ts              settings (defaults until loaded), setMaintenanceDueSoonDays
  composables/reloadObjectChildren.ts     reloads every child-table list (maintenance, documents) after cascades
  composables/useDataTransfer.ts          backup/restore/export/import (stateless); restore/import reload all lists
  components/layout/            AppSidebar (Settings pinned at the bottom)
  components/common/            PageHeader, EmptyState, ConfirmDeleteDialog (title + action prop, slot = text)
  components/investments/       SummaryCard, PriorityList, ListItem, PriorityChip,
                                InvestmentFormDialog (create+edit), DeleteInvestmentDialog
  components/inventory/         CategoryTile, CategoryActionsMenu (⋮ edit/delete), CategoryFormDialog,
                                DeleteCategoryDialog,
                                HouseholdObjectPanel (list + create/edit/delete dialogs, exposes openCreateDialog;
                                click opens the object page), HouseholdObjectListItem,
                                HouseholdObjectFormDialog (+ HouseholdObjectAttributesEditor), DeleteHouseholdObjectDialog
                                (lists what is deleted with it), HouseholdObjectDetails (Overview tab)
  components/attachments/       AttachmentList (owner prop: Documents tab, receipts), AttachmentListItem, AttachmentFormDialog
  components/maintenance/       MaintenancePanel (Maintenance tab), MaintenanceTaskListItem, MaintenanceTaskFormDialog,
                                MaintenanceRecordListItem, MaintenanceRecordFormDialog ("Mark as done"), ReceiptsDialog,
                                MaintenanceStatusChip (object page, list items, category tiles)
  components/settings/          BackupRestoreCard, ExportImportCard, RestoreBackupDialog,
                                ImportDataDialog, DataFileSummary, SettingsActionRow
  views/                        InvestmentsView, InventoryView (tiles/list toggle), InventoryCategoryView,
                                HouseholdObjectView (tabs: Overview, Documents, Maintenance),
                                SettingsView (section nav + child <router-view>), settings/SettingsDataView,
                                settings/SettingsMaintenanceView
  utils/currency.ts             formatCents, parseAmountToCents, centsToAmountInput (EUR)
  utils/date.ts                 formatDate (YYYY-MM-DD → locale), isValidIsoDate, todayIsoDate, daysBetween,
                                addToIsoDate (months keep the month end)
  utils/file-size.ts            formatFileSize
  utils/error.ts                describeError (any thrown value → text)
  utils/text.ts                 normaliseText (trim, '' → null)
  utils/attribute-value.ts      formatAttributeValue (display text)
  test/**/*.spec.ts             Vitest unit tests, mirroring src/ (imports via @/; vitest.config.ts: node env, 100% thresholds)
  test/architecture.spec.ts     no SQL outside repositories (the import rules are in .oxlintrc.json)
.oxlintrc.json                  Oxlint: categories, complexity limits, type-aware rules (tsgolint), layer rules
                                (no-restricted-imports per folder in overrides)
.oxfmtrc.json                   Oxfmt (Prettier-compatible): 120 cols, no semicolons, single quotes, LF
src-tauri/
  src/lib.rs                    module list (layers) + DATABASE_URL
  src/app.rs                    run(): registers plugins (log first, dialog, sql + migrations) + commands;
                                startup failure (e.g. migration) → log + native rfd message box, exit(1)   [no coverage]
  src/commands.rs               controllers: #[tauri::command] wrappers, resolve config dir + DbInstances,
                                call data_transfer / attachments / db; open_attachment opens via crate `open`;
                                remove_orphan_attachments (spawned at startup by app.rs) [no coverage]
  src/error.rs                  CommandResult, error_text
  src/db.rs                     shared DB access: live_pool, bind_json, execute_transaction (several statements in
                                one transaction; the plugin's pool can't do BEGIN/COMMIT across frontend calls)
  src/startup.rs                startup error dialog text (tested)
  src/data_transfer/            backup (VACUUM INTO), restore (validate, close pool, swap files, reopen + migrate in place),
                                JSON export/import (all user tables, generic), CSV export. Takes plain paths + &DbInstances.
    mod.rs                      service: checks (backup, export format), moving files, messages, orchestration
    repository.rs               all SQL: vacuum_into, read_snapshot, DatabaseFile (read-only backup checks),
                                open_and_migrate, replace_all_data
    paths.rs                    file names (live, staged, before-restore/import), with_suffix, path_to_str
    tests.rs                    real SQLite files in a temp dir (TestDir), tauri::async_runtime::block_on
  src/attachments/              document files in <app config dir>/attachments/:
    mod.rs                      store_file (copy under a unique name), attachment_path (by id; checks the stored
                                name), remove_orphans (startup, files without a row, min age 1 h),
                                set_aside_orphans (after restore/import, see Gotchas)
    repository.rs               stored_name_of, all_stored_names
    tests.rs                    temp dir + in-memory database
  src/test_support.rs           shared test helpers: run, TestDir, instances_with, memory_database
  src/migrations.rs             ordered list of migrations (include_str! of SQL files), app_schema_version,
                                app_migrations (sqlx form, for restores and checksum checks)
  migrations/NNNN_*.sql         versioned SQL
  tauri.conf.json               window, CSP, bundle, plugins.sql.preload
  capabilities/default.json     permissions: core:default, sql:allow-select, sql:allow-execute,
                                dialog:allow-save, dialog:allow-open, log:allow-log
```

## Architecture rules

- **Controller–service–repository layers.** Data flow: **component → composable (controller) → `*.service.ts` → `*.repository.ts` → `infrastructure/`**. Each layer imports only the one below it (plus `types/`, `utils/`); `no-restricted-imports` in `.oxlintrc.json` (one override per folder, also for the native `@tauri-apps/*` packages) and the SQL check in `test/architecture.spec.ts` fail `make test` otherwise. A new layer folder needs its own override there.
  - **Composables are the controller layer:** shared state, loading/error, reload after writes. No business rules.
  - **Services:** build the value object, call repositories, turn results and typed errors into user-facing messages, decide what is saved together. No SQL, no database client, no field rules of their own.
  - **Repositories:** SQL, row ↔ type mapping, transactions. They accept only `*Values` value objects, report "not found" as `false`, and turn constraint failures into `MissingReferenceError` / `DuplicateValueError`. No validation, no user-facing messages.
- **Value objects** (`*Values` classes in `types/`) own the validation and normalising rules of the data they describe (e.g. `HouseholdCategoryValues.from(input)` trims the name and checks the icon). Pattern: `private constructor`, `static from(input)` that throws readable errors, `readonly` fields, and a type-only `declare private readonly brand` so a plain object with the same fields doesn't type-check. Put new rules there, not in services or components.
  - **Infrastructure:** database client, native log. Only repositories use the database client.
- Writes that must succeed or fail together go through **one `transaction([...])` call** (in a repository). Separate `execute()` calls (or `BEGIN`/`COMMIT` via `execute()`) are not atomic: the plugin may run each one on a different pooled connection.
- **Rust follows the same layers:** `commands.rs` (controllers, no logic) → service modules such as `data_transfer/mod.rs` (rules, file handling, messages) → their `repository.rs` (SQL only) → `db.rs` (shared pool, binding, transactions). New native features get the same `mod.rs` + `repository.rs` split.
- Everything that belongs to a household object (attributes, documents, maintenance) is a **child table** with `household_object_id … REFERENCES household_objects (id) ON DELETE CASCADE`. The fixed columns of `household_objects` stay as they are; new features (e.g. smart-home links) add child tables instead. Export/import needs no change for new tables (it reads all user tables). Attributes are one row per attribute (`household_object_attributes`), deliberately not a JSON column (unchecked, hard to search) and not per-category definitions (break when an object changes category).
- **Let the database enforce what it can**, in the migration: `CHECK (date(x) IS x)` for 'YYYY-MM-DD' columns (`IS`, not `=`: `date()` returns NULL for invalid dates, and a CHECK that is NULL passes), `CHECK … IN (…)` for enumerations (keep the TS constant next to it in sync), UNIQUE where a duplicate makes no sense, triggers for rules across rows (see 0004, 0005). Don't store what can be calculated: when a maintenance task was last done is the later of its own `last_done_date` (entered by hand) and its newest record, calculated in `types/maintenance-schedule.ts`. So "Mark as done" is just one INSERT, and editing or deleting a record can't leave a stale date.
- **Attachments have exactly one owner** ("exclusive arc": one FK column per owner kind, each ON DELETE CASCADE; a trigger checks that exactly one is set). A new owner (e.g. expenses) = a migration (`ALTER TABLE attachments ADD COLUMN expense_id …`, an index, drop + recreate both `attachments_one_owner_*` triggers with the new column; see the header of 0005) + a member of `AttachmentOwner` + an entry in `OWNER_COLUMNS` and the owner SQL in `attachment.repository.ts`. `AttachmentList` then works for it unchanged.
- **The database is the source of truth for files:** a file in `attachments/` without a row is garbage (removed at startup); a row without a file shows "missing" when opened. The frontend never passes a path inside the app folder to Rust: files are copied in from a dialog path and opened by id.
- **Child-table lists must be reloaded after cascades.** Deleting an object or category, and restore/import, call `reloadObjectChildren()`. A new child table's composable is added there.
- SQL uses `$1, $2, …` placeholders only. Rows are snake_case and get mapped to camelCase types in the repository.
- Money is stored as **integer cents**.
- Composables hold module-level `ref`s (a shared singleton state), expose them `readonly`, and reload from the DB after writes. Write methods rethrow so dialogs can show errors.
- Dialogs call the composable directly and own their own saving/error state.
- Components use `<script setup lang="ts">`, typed `defineProps`/`defineEmits`/`defineModel`, and scoped CSS with theme variables (`rgb(var(--v-theme-primary))`).

## Adding a new entity (pattern)

1. `src-tauri/migrations/000N_<name>.sql` + append an entry to `src-tauri/src/migrations.rs` (next version number).
2. `src/types/<entity>.ts`
3. `src/repositories/<entity>.repository.ts` (SQL via `select`/`execute`/`transaction`) + `test/repositories/…spec.ts`
4. `src/types/<entity>.ts` gets a `<Entity>Values` value object (rules) + `test/types/…spec.ts`;
   `src/services/<entity>.service.ts` (orchestration, messages; calls the repository) + `test/services/…spec.ts`
5. `src/composables/use<Entity>s.ts` (controller)
6. Components under `src/components/<entity>/`, a view in `src/views/`, a route in `src/router/index.ts`, a nav item in `AppSidebar.vue`.

## Gotchas

- **Linter = Oxlint, formatter = Oxfmt** (ESLint is blocked: typescript-eslint doesn't run on TS 7). Oxlint lints only the `<script>` of `.vue` files (no template rules), and the type-aware rules (`--type-aware`, `oxlint-tsgolint`) cover `.ts` files only. Lint warnings fail too (`--deny-warnings`). Switched off on purpose: `typescript/consistent-return` (it doesn't understand exhaustive `switch` statements; the declared return types are checked by `tsc`), and, in `test/**` only, `no-misused-spread` / `no-unsafe-type-assertion` (tests spread value objects into plain copies and cast invalid input on purpose) and `consistent-function-scoping`. Prefer fixing a finding over disabling it; if a single line really needs it, use `// oxlint-disable-next-line <rule>` with a reason comment. Migrations are in the formatter's `ignorePatterns`; keep them there. `.gitattributes` forces LF for all text files, so `format:check` gives the same result on Windows and in CI.
- **Never edit, renumber or delete an existing migration.** sqlx checksums them, and the app refuses to start. Always add a new one.
- The DB is **preloaded** natively (`plugins.sql.preload`). The frontend uses `Database.get()`, and `sql:allow-load` is intentionally not granted. The connection string `sqlite:homebase.db` appears in 3 places: `lib.rs`, `tauri.conf.json` and `infrastructure/database.ts`.
- The DB file is per user, outside the repo: `%APPDATA%\com.homebase.desktop\homebase.db` on Windows, `~/Library/Application Support/com.homebase.desktop/` on macOS, `~/.config/com.homebase.desktop/` on Linux (the plugin uses `app_config_dir`). Don't change `identifier`.
- New native capabilities need explicit permissions in `capabilities/default.json`. Grant least privilege.
- **Vuetify 4**: MD3 typography classes (`text-title-large`, not `text-h6`). Its CSS is in `@layer`s, so unlayered CSS in `main.css` wins. Vuetify 4 no longer resets browser margins; `main.css` does that.
- **Vite 8**: Rolldown/Oxc. esbuild is not installed, so don't set `minify: 'esbuild'`.
- **TypeScript 7.1 beta + `@vue/content-mapper` alpha (exact pins, prerelease on purpose).** `vue-tsc` is gone; `tsc -b --runExternalCode` type-checks `.vue` files via `contentMappers` in `tsconfig.app.json`. `package.json` `overrides.typescript` is needed because prerelease versions don't satisfy npm peer ranges; remove it when stable versions ship. Don't reinstall `vue-tsc`.
- **Vuetify native attrs/events in templates:** the content mapper rejects props/events a component doesn't declare. Vuetify's `v-btn` has no `onClick`, `type`, or `aria-label`, and inputs lack `inputmode`. Write them as `v-bind="{ onClick: handler }"`, `v-bind="{ type: 'submit' }"`, etc. (`v-list-item` declares `onClick`, so `@click` is fine there.) A plain `@click` on `v-btn` fails `npm run typecheck`.
- **Backups don't contain document files yet** (see _Backups include documents_ in PlannedFeatures.md). Until they do, `restore_backup` / `import_json` call `attachments::set_aside_orphans`: files the new data doesn't use move to `attachments.before-restore/` / `attachments.before-import/` (files it uses are taken back from there first), so the startup cleanup never deletes files an undo might need.
- **Settings** are key/value rows (`settings` table). A missing key = the default, and unreadable values fall back to the default (`settingsFrom`), so a new setting needs no migration.
- **Migration files must stay LF.** sqlx checksums the exact bytes. `.gitattributes` forces `eol=lf` for `src-tauri/migrations/*.sql`; with Windows `core.autocrlf` a CRLF checkout would otherwise make the app refuse to start ("migration N was previously applied but has been modified").
- Logs: `%LOCALAPPDATA%\com.homebase.desktop\logs\homebase.log` (Windows; `app_log_dir`). Use `log::info!/error!` in Rust and `logError()` in TS. Never log user data (no SQL parameter values).
- CSP: `style-src 'unsafe-inline'` is required for Vuetify's runtime theme. Don't add remote origins; the app must work offline.
- **Rust tests need `dist/`** (`generate_context!` embeds it at compile time): run `npm run build` first on a fresh checkout. `main.rs`, `app.rs`, `commands.rs` are excluded from Rust coverage by filename (`coverage:rust` script), so keep logic out of them.
- **Versions are `0.0.0` on purpose.** The real version is the latest `vX.Y.Z` git tag. A merged pull request labelled `major`/`minor`/`patch` triggers `.github/workflows/release.yml`, which writes the version on the build machine (`scripts/release-version.mjs`). Never bump versions in `package.json`/`Cargo.toml` by hand.
- **CI** (`.github/workflows/ci.yml`): jobs `lint` (format check + lint) and `audit` (`scripts/audit.mjs`: `npm audit` at level high, minus the accepted advisories in `audit-allowlist.json`; each entry has a reason and an `expires` date, after which it fails again) on Linux, `typescript unit-test` and `rust unit-test` each on Windows + Linux. `release.yml` reuses it via `workflow_call`.
- **Run Vitest via the npm scripts, not `npx vitest`.** VS Code opens terminals with a lowercase `e:\` working directory, which makes Vitest load itself twice ("Vitest failed to find the runner"). `scripts/vitest.mjs` starts the CLI via an upper-case drive letter.
- **Rust coverage counts every closure.** An error closure that never runs (`.map_err(|e| e.to_string())` on a call that can't fail in a test) counts as an uncovered line, even when the statement around it is covered. Pass a named function instead (`.map_err(error_text)`), share one helper per error message, or add a test that triggers the error. Keep `log::info!` calls on one line: their arguments only run while a logger is active.
- **Vitest mocks:** `vitest.config.ts` sets `mockReset`, so set mock return values in each test or in `beforeEach`. Composables have module-level state: use `vi.resetModules()` + dynamic `import()` per test, with the service mocks created in `vi.hoisted()` so they survive the reset.
- Node 26 is required (`.node-version`, `engines`). If `cargo` is "not found" right after installing Rust, the shell or editor still has the old PATH; restart it.
