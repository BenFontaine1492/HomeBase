# AGENTS.md

Quick orientation for coding agents. Read this first, then open only the files you need.

## What this is

HomeBase is an offline, Windows-first desktop app for household management: Tauri 2 + Vue 3 + Vuetify 4 + SQLite, UI in English and German. Pages: Dashboard (configurable widgets), Search, Projects (projects with their investments and a savings roadmap; one page per project), Inventory (categories, objects with attributes, documents, maintenance), Finances (tabs Costs, Income, Recurring: costs incl. maintenance costs, income, receipts, recurring costs and income, export for a tax advisor) and Settings (General, Data, Maintenance). Roadmap: `PlannedFeatures.md`; setup: `README.md`.

## Working conventions

- **The user runs build/dev commands themselves.** Ask them to run the command and paste the output.
- **Prefer the `make` targets** (PowerShell): `make startup` (app with HMR), `make stop`, `make teardown` (also kills leftover Vite/Vitest/Tauri/Rust processes), `make test` (format check + lint + typecheck + TS and Rust tests with the coverage gate: the one command to verify changes), `make linting` (Oxfmt, then `oxlint --fix`), `make audit-fix`. Use npm scripts only for steps without a target (`npm run typecheck`, `npm run build`, `npm run tauri build`, `npm run test:coverage`, `npm run coverage:rust`).
- **Coverage is gated at 100%** (TS: lines/branches/functions/statements; Rust: lines). Every changed file in `services/`, `composables/`, `utils/`, `types/`, `repositories/` gets its spec in `test/` (mirrors `src/`); changes in `src-tauri/src` get Rust tests. Avoid unreachable branches (e.g. `?? ''` on values that are never undefined).
- **Feature workflow:** implement the task from `PlannedFeatures.md` → delete it there (move decisions other entries need, fix references) → update `README.md` and this file if they are no longer accurate. In `PlannedFeatures.md` the number is the priority; refer to other items by name.
- Don't commit; the user commits after testing.
- No Pinia, Express, REST APIs, Docker or other servers. Discuss any new dependency first.
- Skip: `node_modules/`, `dist/`, `src-tauri/target/`, `src-tauri/gen/`, `src-tauri/icons/`, lock files.

## Map

```text
src/
  router/index.ts         routes (hash history); meta.titleKey/sectionKey → window title
  plugins/                themes.ts (light/dark colours, contrast-tested), vuetify.ts (component defaults)
  i18n/                   t(), formatPreferences; messages/en.ts defines the keys, de.ts must match
  assets/styles/main.css  global styles: type ramp (hb-*), buttons, alerts, tabs, focus, margin reset
  types/                  domain types, *Values value objects, pure logic (schedules incl. recurring-schedule.ts
                          shared by recurring costs and income, statistics, search, project-roadmap.ts,
                          dashboard widget registry WIDGET_TYPES, tax export plan) — most rules live here
  infrastructure/         database.ts (select / execute / transaction), log.ts (logError)
  repositories/           SQL + row mapping; repository-errors.ts; native-command.ts (invoke Rust commands)
  services/               orchestration + user-facing messages; service-errors.ts
  composables/            controllers: shared module-level state per domain; reloadObjectChildren.ts
  components/common/      shared building blocks (AppDialog, ConfirmDialog, PageHeader, ListSection, ListRow,
                          MetaList, StatusBadge, ActionsMenu, DateField, EmptyState)
  components/<domain>/    dashboard (widgets/ + widget-registry.ts), projects, investments, inventory, attachments,
                          maintenance, costs, income, finances (shared by both), settings, layout (AppSidebar)
  views/                  one per route; settings/ sub-pages
  utils/                  formatting (currency, date, file size), chart options (dashboard, roadmap), colours, excel formats
test/                     Vitest specs mirroring src/; architecture.spec.ts (no SQL outside repositories)
src-tauri/
  src/app.rs              plugins + commands, startup error dialog            [no coverage: no logic here]
  src/commands.rs         #[tauri::command] wrappers                          [no coverage: no logic here]
  src/db.rs               shared pool, bind_json, execute_transaction
  src/migrations.rs       ordered migration list + tests;  migrations/NNNN_*.sql
  src/data_transfer/      backup/restore, JSON/CSV export, JSON import; upgrade.rs (older exports)
  src/attachments/        document files in <app config dir>/attachments/ (store, open by id, orphans)
  src/tax_export/         export folder for a tax advisor: receipts + .xlsx (rust_xlsxwriter)
  capabilities/default.json, tauri.conf.json
```

## Architecture rules

- **Layers:** component → composable (controller) → `*.service.ts` → `*.repository.ts` → `infrastructure/`. Each layer imports only the one below (plus `types/`, `utils/`, `i18n/`); enforced by `no-restricted-imports` overrides in `.oxlintrc.json` (a new layer folder needs one) and `test/architecture.spec.ts`.
  - **Composables:** shared module-level `ref`s exposed `readonly`, loading/error, reload after writes; write methods rethrow. No business rules.
  - **Services:** build the value object, call repositories, turn results and typed errors into messages, decide what is saved together. No SQL.
  - **Repositories:** SQL (`$1, $2, …` only, snake_case rows → camelCase types), transactions. Accept only `*Values`, report "not found" as `false`, turn constraint failures into `MissingReferenceError` / `DuplicateValueError`.
  - **Value objects** (`*Values` in `types/`) own validation and normalising: `private constructor`, `static from(input)` throwing readable errors, `readonly` fields, `declare private readonly brand`.
- Writes that must succeed together go through **one `transaction([...])` call**; separate `execute()` calls may run on different pooled connections.
- **Rust uses the same layers:** `commands.rs` → service `mod.rs` → `repository.rs` → `db.rs`.
- **The database enforces what it can:** `CHECK (date(x) IS x)` for dates (`IS`, not `=`), `CHECK … IN (…)` for enumerations (keep the TS constant in sync), UNIQUE, triggers for cross-row rules. Don't store what can be calculated (e.g. a task's last-done date). Money is **integer cents**.
- **Household object data are child tables** (`household_object_id … ON DELETE CASCADE`); don't add columns to `household_objects`. After cascades (deleting an object or category, restore/import) call `reloadObjectChildren()`; a new child table's composable goes there. Export/import read all user tables, so new tables need no change there.
- **Attachments have exactly one owner** (one FK column per owner kind + `attachments_one_owner_*` triggers). New owner = migration (column, index, recreate both triggers; see 0005 and 0009) + `AttachmentOwner` member + `OWNER_COLUMNS` and owner SQL in `attachment.repository.ts`.
- **The database is the source of truth for files:** files without a row are removed at startup; the frontend never passes a path inside the app folder to Rust (copy in from a dialog path, open by id).
- Components: `<script setup lang="ts">`, typed `defineProps`/`defineEmits`/`defineModel`; dialogs call composables directly and own their saving/error state.

## Texts and languages

- **No UI text in code:** every visible text (also errors of value objects and services) is `t('key')`, with the key in `en.ts` *and* `de.ts`. Plurals: `'{count} object | {count} objects'`.
- Call `t()` when the text is shown, never at module load (label tables are functions, option lists `computed`).
- Numbers, dates and amounts go through `utils/` (`formatCents`, `formatDate`), never `toLocaleString()`/`Intl` in components. Tests run in English; texts from Rust are English only.

## UI conventions (Windows 11 look on Vuetify)

- Colours in `plugins/themes.ts`, all other styling in `main.css`. Components set no font sizes, colours or radii; scoped CSS is for layout. Exceptions: `components/common/`, the sidebar logo.
- Text: `hb-title` / `hb-subtitle` / `hb-body-strong` / `hb-body` / `hb-caption`, `hb-numeric` for amounts; secondary text `text-medium-emphasis`; weights 400 and 600.
- Sizes: controls 40 px (Vuetify defaults; no `size="large"`, no `density` on fields), actions in cards and rows 32 px (`size="small"`); spacing 4/8/12/16/24/32/40 px; icons 16/20/24 px; corners 4 px (controls, rows), 8 px (cards, dialogs, menus).
- Buttons: accent `color="primary" variant="flat"` once per view or dialog; standard = no variant; subtle `variant="text"`. Destructive confirmations only inside their dialog.
- Use the shared components (`AppDialog` with the main action first and `required-hint`, `ConfirmDialog`, `PageHeader`, `ListSection` + `ListRow`, `EmptyState`, `ActionsMenu`, `MetaList`, `StatusBadge`, `DateField`, `SettingsRow`).
- Success = toast (`useNotifications().notify`), errors inline (`v-alert`). Settings pages save at once (`useAutoSave`). Switches only for changes that apply at once; checkboxes in forms.
- **No "·" between values.** Status colours keep 4.5:1 contrast in both themes.

## Adding things

- **Entity:** migration + entry in `migrations.rs` → `types/<entity>.ts` (+ `Values`) → repository → service → `use<Entity>s.ts` → components, view, route, sidebar item. Specs for each layer.
- **Dashboard widget:** entry in `WIDGET_TYPES` (`types/dashboard.ts`) + pure number functions with tests → component in `components/dashboard/widgets/` (props `settings`, `size`; charts via `DashboardChart`, several series via its `series` prop) → one line in `widget-registry.ts`. Income widgets reuse the cost statistics through `pointOfIncome`. No migration (`widget_type` has no CHECK on purpose; unknown types show a placeholder).
- **Setting:** key/value rows, missing = default, so no migration: `SETTING_KEYS`, `AppSettings`, `DEFAULT_SETTINGS`, the parser in `settingsFrom`, a `SettingValue` factory.

## Gotchas

**Migrations and data**
- **Never edit, renumber or delete a migration** (sqlx checksums them; the app refuses to start). Files must stay LF (`.gitattributes`); they are excluded from the formatter.
- **Seed data:** only 0007 (default dashboard = frozen `DEFAULT_DASHBOARD`; changing it needs a new migration, an import without the table leaves it empty: "Reset to default"). The tax categories of 0009 were replaced by free-text categories in 0014.
- **Older JSON exports** hold rows, not migrations: a migration that moves or drops data needs a matching step in `data_transfer/upgrade.rs`. Backups need nothing (a restore runs the migrations).
- **Backups don't contain document files yet;** restore/import call `attachments::set_aside_orphans` so an undo still finds the files.
- DB file: `%APPDATA%\com.homebase.desktop\homebase.db` (per user; don't change `identifier`). It is preloaded natively (`Database.get()`, no `sql:allow-load`); `sqlite:homebase.db` appears in `lib.rs`, `tauri.conf.json`, `infrastructure/database.ts`.

**Domain rules**
- **No tax advice:** categories only group entries for the export; add no rules or hints about what is deductible.
- **Categories** (`types/category.ts`, migration 0014): a cost or income entry has one free-text `category`, like an attribute name. The forms (`components/finances/CategoryField.vue`) suggest the default list in the UI language (`COST_CATEGORY_KEYS` / `INCOME_CATEGORY_KEYS`, texts `costs.categories.*` / `income.categories.*`) and the categories used before; grouping and filters compare `categoryKey` (trimmed, case-insensitive). There are no cost or income types, no tax category table and no labour share. A maintenance cost gets "Maintenance" (in the UI language) when it is created, a purchased investment's cost "Purchase".
- **Costs:** a maintenance record's cost is its row in `costs` (written in the same transaction); the Costs page edits only its tax details.
- **Recurring costs and income:** separate tables (`recurring_costs`, `recurring_income`), one schedule (`types/recurring-schedule.ts`): dates are counted from the start date (month ends stay); recording checks that `next_due_date` is unchanged, so nothing is recorded twice.
- **Income** (`income`, migration 0013) mirrors the costs. The export includes all costs and/or income of the year, by category; income receipts go to `<income folder>/<category>/`.
- **Tax export:** the frontend builds the plan (`types/tax-export.ts`), Rust carries it out: never into an existing folder, receipts copied by attachment id. A receipt folder may have parts joined by `/` (each a safe name).
- **Projects** (migration 0015): every investment belongs to one project (`project_id`, required by triggers because it was added by `ADD COLUMN`; deleted with its project, its costs keep their data). `projects.sort_order` is the funding order of the roadmap; an investment's `sort_order` orders the planned investments within its project; purchased ⇔ `purchased_date` (0008 triggers).
- **Roadmap** (`types/project-roadmap.ts`): only recurring income − recurring costs, on their exact due dates from today (overdue ones count today), balance 0 today; an investment needs its estimated cost minus the amount saved. Projects are funded one after another in their order; each project is also dated on its own. Nothing is stored: it is recalculated from the loaded data. 30 years ahead at most.

**Frontend toolchain**
- **Oxlint + Oxfmt** (no ESLint). Oxlint checks only the `<script>` of `.vue` files; warnings fail. Prefer fixing over `// oxlint-disable-next-line <rule>` (with a reason). Lib is ES2022: no `toSorted()`.
- **TypeScript 7.1 beta + `@vue/content-mapper`** (exact pins; `tsc -b --runExternalCode`, no `vue-tsc`). It rejects undeclared props/events: on `v-btn` write `v-bind="{ onClick }"`, `v-bind="{ type: 'submit', form: formId }"`, and give it a declared prop too (e.g. `:text`). Same for `id` on `v-form`, `inputmode` on inputs.
- **`defineProps`:** declare props inline (no imported types), and `withDefaults` can't use local constants. Only `npm run build` catches this.
- **Vuetify 4:** CSS is in `@layer`s, so unlayered `main.css` wins: its margin reset beats spacing classes on `<p>`/headings (use a scoped class). `v-window` clips its content (floating labels at the top need padding). MD3 typography class names.
- Vite 8 (Rolldown): no esbuild. Run Vitest via the npm scripts (lowercase drive letter issue). `mockReset` is on; composable tests use `vi.resetModules()` + dynamic `import()` with mocks in `vi.hoisted()`.

**Native side**
- New native capabilities need least-privilege permissions in `capabilities/default.json`. CSP stays offline-only (`style-src 'unsafe-inline'` is needed).
- `dragDropEnabled: false`: Tauri's file drop would break HTML5 drag and drop; files come only through dialogs.
- Rust tests need `dist/` (`npm run build` on a fresh checkout). `main.rs`, `app.rs`, `commands.rs` are excluded from coverage. Every closure counts for coverage: pass named functions (`.map_err(error_text)`); keep `log::info!` calls on one line. Heavy Rust builds can overload the PC: limit jobs (`CARGO_BUILD_JOBS=2`).
- Logs: `%LOCALAPPDATA%\com.homebase.desktop\logs\homebase.log`. Never log user data.

**Release and CI**
- Versions stay `0.0.0`; a merged PR labelled `major`/`minor`/`patch` releases via `release.yml`. Never bump versions by hand.
- CI (`ci.yml`): lint + audit (`audit-allowlist.json` entries expire) on Linux, TS and Rust tests on Windows + Linux. Node 26 is required.
