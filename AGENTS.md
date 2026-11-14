# AGENTS.md

Quick orientation for coding agents. Read this first, then open only the files you need.

## What this is

HomeBase is an offline Windows-first desktop app for household management: Tauri 2 + Vue 3 + Vuetify 4 + SQLite. Implemented so far: an Investments page (list/add/edit/delete) and an Inventory placeholder. The roadmap is in `PlannedFeatures.md`, and setup details are in `README.md`.

## Working conventions

- **The user runs build/dev commands themselves.** Ask them to run the relevant command and paste the output, instead of running it yourself:
  `npm run typecheck` · `npm run build` (frontend) · `npm run tauri dev` (app with HMR) · `npm run tauri build` (installers → `src-tauri/target/release/bundle/{nsis,msi}/`) · `npm install`
- Don't commit. The user commits after testing.
- Do not add Pinia, Express, REST APIs, Docker or other servers. Discuss any new dependency before adding it.

## Skip these (large / generated)

`node_modules/`, `dist/`, `src-tauri/target/`, `src-tauri/gen/`, `src-tauri/icons/` (generated from `icons/app-icon.svg`), `package-lock.json`, `src-tauri/Cargo.lock`.

## Map

```text
src/
  main.ts, App.vue              bootstrap + shell (sidebar + <router-view>)
  router/index.ts               routes: /investments (default), /inventory — hash history
  plugins/vuetify.ts            theme colours (incl. priority-high/medium/low) + component defaults
  assets/styles/main.css        global overrides (font, button case, margin reset)
  types/investment.ts           Investment, InvestmentInput, InvestmentPriority
  services/database/
    database.service.ts         ONLY place that touches @tauri-apps/plugin-sql: select(), execute()
    database-error.ts           DatabaseError, describeError()
  services/investment.service.ts   all investment SQL + row mapping + validation
  composables/useInvestments.ts    module-level shared state + add/update/delete (reload after write)
  components/layout/            AppSidebar
  components/common/            PageHeader, EmptyState
  components/investments/       SummaryCard, PriorityList, ListItem, PriorityChip,
                                InvestmentFormDialog (create+edit), DeleteInvestmentDialog
  views/                        InvestmentsView, InventoryView
  utils/currency.ts             formatCents, parseAmountToCents, centsToAmountInput (EUR)
src-tauri/
  src/lib.rs                    registers tauri-plugin-sql + migrations (that's all the Rust)
  src/migrations.rs             ordered list of migrations (include_str! of SQL files)
  migrations/NNNN_*.sql         versioned SQL
  tauri.conf.json               window, CSP, bundle, plugins.sql.preload
  capabilities/default.json     permissions: core:default, sql:allow-select, sql:allow-execute
```

## Architecture rules

- Data flow: **component → composable → `*.service.ts` → `database.service.ts` → plugin**. Components never contain SQL.
- SQL uses `$1, $2, …` placeholders only. Rows are snake_case and get mapped to camelCase types in the service.
- Money is stored as **integer cents**.
- Composables hold module-level `ref`s (a shared singleton state), expose them `readonly`, and reload from the DB after writes. Write methods rethrow so dialogs can show errors.
- Dialogs call the composable directly and own their own saving/error state.
- Components use `<script setup lang="ts">`, typed `defineProps`/`defineEmits`/`defineModel`, and scoped CSS with theme variables (`rgb(var(--v-theme-primary))`).

## Adding a new entity (pattern)

1. `src-tauri/migrations/000N_<name>.sql` + append an entry to `src-tauri/src/migrations.rs` (next version number).
2. `src/types/<entity>.ts`
3. `src/services/<entity>.service.ts` (uses `select`/`execute`)
4. `src/composables/use<Entity>s.ts`
5. Components under `src/components/<entity>/`, a view in `src/views/`, a route in `src/router/index.ts`, a nav item in `AppSidebar.vue`.

## Gotchas

- **Never edit, renumber or delete an existing migration.** sqlx checksums them, and the app refuses to start. Always add a new one.
- The DB is **preloaded** natively (`plugins.sql.preload`). The frontend uses `Database.get()`, and `sql:allow-load` is intentionally not granted. The connection string `sqlite:homebase.db` appears in 3 places: `lib.rs`, `tauri.conf.json` and `database.service.ts`.
- The DB file is per user, outside the repo: `%APPDATA%\com.homebase.desktop\homebase.db` on Windows, `~/Library/Application Support/com.homebase.desktop/` on macOS, `~/.config/com.homebase.desktop/` on Linux (the plugin uses `app_config_dir`). Don't change `identifier`.
- New native capabilities need explicit permissions in `capabilities/default.json`. Grant least privilege.
- **Vuetify 4**: MD3 typography classes (`text-title-large`, not `text-h6`). Its CSS is in `@layer`s, so unlayered CSS in `main.css` wins. Vuetify 4 no longer resets browser margins; `main.css` does that.
- **Vite 8**: Rolldown/Oxc. esbuild is not installed, so don't set `minify: 'esbuild'`.
- **TypeScript 7.1 beta + `@vue/content-mapper` alpha (exact pins, prerelease on purpose).** `vue-tsc` is gone; `tsc -b --runExternalCode` type-checks `.vue` files via `contentMappers` in `tsconfig.app.json`. `package.json` `overrides.typescript` is needed because prerelease versions don't satisfy npm peer ranges; remove it when stable versions ship. Don't reinstall `vue-tsc`.
- **Vuetify native attrs/events in templates:** the content mapper rejects props/events a component doesn't declare. Vuetify's `v-btn` has no `onClick`, `type`, or `aria-label`, and inputs lack `inputmode`. Write them as `v-bind="{ onClick: handler }"`, `v-bind="{ type: 'submit' }"`, etc. (`v-list-item` declares `onClick`, so `@click` is fine there.) A plain `@click` on `v-btn` fails `npm run typecheck`.
- **Migration files must stay LF.** sqlx checksums the exact bytes. `.gitattributes` forces `eol=lf` for `src-tauri/migrations/*.sql`; with Windows `core.autocrlf` a CRLF checkout would otherwise make the app refuse to start ("migration N was previously applied but has been modified").
- CSP: `style-src 'unsafe-inline'` is required for Vuetify's runtime theme. Don't add remote origins; the app must work offline.
- Node 26 is required (`.node-version`, `engines`). If `cargo` is "not found" right after installing Rust, the shell or editor still has the old PATH; restart it.
