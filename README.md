# HomeBase

HomeBase is a personal household management desktop application. It is a central place to plan and monitor household-related information: planned investments, purchased household objects (heating, solar, appliances, …), purchase prices, warranties and maintenance.

In the future there might be features to controll and monitor smart home devices and tracking recurring expenses and manage household finances, see PlannedFeatures.md .  

**Current state:** technical foundation. The app shell, navigation, a database-backed *Future Investments* dashboard (list, add, edit, delete) and a household *Inventory* (user-defined categories and objects) are implemented. Investment reordering is not implemented yet.

All data stays local: no server, no internet connection and no account are needed.

---

## 1. Technology stack

| Component            | Technology                                             | Version |
| -------------------- | ------------------------------------------------------ | ------- |
| Language             | TypeScript (strict)                                    | 7.1 beta |
| Frontend framework   | Vue 3, Composition API, `<script setup lang="ts">`     | 3.5     |
| Build tool           | Vite (Rolldown bundler, Oxc minifier)                  | 8.3     |
| UI framework         | Vuetify + Material Design Icons (`@mdi/font`, bundled) | 4.3     |
| Routing              | Vue Router (hash history)                              | 5.5     |
| State                | Vue reactivity + composables (no Pinia)                | –       |
| Desktop framework    | Tauri                                                  | 2.12    |
| Native backend       | Rust                                                   | stable  |
| Database             | SQLite via the official Tauri SQL plugin (`sqlx`)      | 2.6     |

The project targets **Node.js 26 LTS** (pinned to `26.13.1` in `.node-version`, enforced via `engines` in `package.json`).

Deliberate version choices:

- **TypeScript 7.1 beta (prerelease, on purpose).** TypeScript 7 is the native (Go) compiler. It has no JavaScript compiler API, so `vue-tsc` no longer works. `.vue` files are type-checked by plain `tsc` through the `@vue/content-mapper` alpha (needs TS 7.1+; `contentMappers` in `tsconfig.app.json`, and `tsc` must run with `--runExternalCode`). Versions are pinned exactly and `package.json` has an `overrides` entry for `typescript`, because npm's peer ranges (`>= 5.8`, `*`) don't match prereleases. Type checking is about 6x faster than TS 6 + `vue-tsc` (about 1 s vs 6 s). Switch to stable releases and drop the `overrides` entry when TS 7.1 and a stable content mapper ship. The mapper always reports unknown props/events, and Vuetify doesn't declare native ones such as `onClick` on `v-btn`, so those are written as `v-bind="{ onClick: … }"` (see [AGENTS.md](AGENTS.md)). Editor support for Vue templates is weaker under TS 7 for now.
- **Tauri 2, not 3.** Tauri 3 and its plugins are only available as alphas.
- **Vue Router 5** lists Pinia only as an *optional* peer dependency, so it is not installed.
- **Vuetify 4** uses Material Design 3 typography classes (`text-title-large` instead of `text-h6`). It no longer resets heading and paragraph margins, so `main.css` does that.

## 2. Required development tools

End users only need the installer. **WebView2** is preinstalled on Windows 10/11, and the installer downloads it if it's missing.

Developers need:

| Tool | Notes |
| --- | --- |
| **Node.js 26 LTS** (npm 11) | `node -v`. Version managers that read `.node-version` (Nodist, fnm, …) pick it up automatically |
| **Rust** (stable, MSVC toolchain on Windows) | Install via [rustup](https://rustup.rs) or `winget install Rustlang.Rustup`. **Restart VS Code / your terminal afterwards**: running terminals don't see the new `PATH`, and `tauri dev` then fails with `cargo metadata … program not found` |
| **Microsoft C++ Build Tools** (Windows) | Visual Studio 2022 / Build Tools with the *Desktop development with C++* workload |
| **WebView2 Runtime** (Windows) | Preinstalled on Windows 10 (current builds) and 11 |
| Linux / macOS | See [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) (WebKitGTK, Xcode CLT, …) |

The first production build downloads the WiX and NSIS toolsets from GitHub, so it needs an internet connection once.

## 3. Installation

```bash
npm install
```

npm 11 skips dependency install scripts by default, and you'll see a warning for `esbuild`'s `postinstall`. This is harmless: that script only verifies the platform binary, which npm installs anyway.

**Nodist users:** `nodist npm <version>` downloads npm's GitHub *source* archive. For npm ≥ 7 that archive lacks bundled packages such as `@npmcli/config`, so npm crashes with `MODULE_NOT_FOUND`. Replace the folder `Nodist\npmv\<version>` with the contents of the published tarball (`https://registry.npmjs.org/npm/-/npm-<version>.tgz` → `package/`).

Cargo fetches the Rust dependencies automatically on the first `tauri dev` / `tauri build`.

## 4. Local development

Use the `make` targets from the project root (they run in PowerShell, so this is Windows-only; `make` must be installed, e.g. `winget install ezwinports.make`):

| Command | Purpose |
| --- | --- |
| `make startup` | Start the app: runs `npm run tauri dev` |
| `make stop` | Stop the HomeBase window and the Vite dev server (port 1420) |
| `make test` | Run the unit tests: runs `npm test` |

`make startup` starts the Vite dev server on `http://localhost:1420` and opens the native HomeBase window. Stop it with `Ctrl+C` in the terminal, or run `make stop` from another terminal.

- `.vue`, `.ts` and CSS/theme changes are hot-reloaded (HMR) without restarting the app.
- Changes under `src-tauri/` (Rust, `tauri.conf.json`, migrations) trigger a native recompile and restart.
- The development database is the same as the installed app's (see §6) and persists between restarts.

On the very first start, Vite may print "optimized dependencies changed. reloading" once while it pre-bundles the Vuetify components. This happens only once (cached in `node_modules/.vite`).

Other npm scripts:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Vite only (browser). The database is **not** available outside Tauri. |
| `npm run typecheck` | Type check with `tsc -b --runExternalCode` (includes `.vue` files) |
| `npm run build` | Type check and build the frontend into `dist/` |

## 5. Production build

```bash
npm run tauri build
```

Output (Windows):

| Artifact | Path |
| --- | --- |
| Executable | `src-tauri/target/release/homebase.exe` |
| NSIS installer (recommended, per-user, no admin) | `src-tauri/target/release/bundle/nsis/HomeBase_<version>_x64-setup.exe` |
| MSI installer | `src-tauri/target/release/bundle/msi/HomeBase_<version>_x64_en-US.msi` |

The app uses the operating system's WebView (WebView2 / WebKit). No Chromium or Node.js runtime is bundled. The installer is about 4 MB.

## 6. Database location

The database file is `homebase.db` in the application directory resolved by Tauri for the identifier `com.homebase.desktop`:

| OS | Path |
| --- | --- |
| Windows | `%APPDATA%\com.homebase.desktop\homebase.db` (e.g. `C:\Users\<you>\AppData\Roaming\com.homebase.desktop\`) |
| macOS | `~/Library/Application Support/com.homebase.desktop/homebase.db` |
| Linux | `~/.config/com.homebase.desktop/homebase.db` |

SQLite runs in WAL mode, so `homebase.db-wal` and `homebase.db-shm` may appear next to it. To back up the data, use **Settings → Data → Create backup** (a consistent snapshot via `VACUUM INTO`, safe while the app is running). To copy the files by hand instead, close the app first and copy all three files.

Restoring a backup or importing a JSON export keeps the previous data next to the database as `homebase.before-restore.db` or `homebase.before-import.db`. Each restore or import overwrites the previous copy.

The database is outside the install directory, so it survives restarts, updates and reinstalls. Uninstallers leave it in place unless you explicitly choose to delete app data.

**Implementation detail:** the SQL plugin resolves relative `sqlite:` paths against Tauri's `app_config_dir()` (verified in `tauri-plugin-sql` 2.6 source, `wrapper.rs`). On Windows and macOS this is the same directory as `app_data_dir()`. Only on Linux does it resolve to `~/.config/…` instead of `~/.local/share/…`.

**Changing the identifier changes the directory.** Never change `identifier` in `tauri.conf.json` after release without migrating the data.

## 7. Database architecture and migrations

```text
Vue component ──► composable (shared state) ──► service (SQL) ──► database.service ──► Tauri SQL plugin ──► SQLite
```

- **Components never contain SQL.** They use composables such as `useInvestments()`.
- **Services** (`src/services/*.service.ts`) contain all SQL for one entity and map `snake_case` rows to typed `camelCase` objects.
- **`database.service.ts`** is the single access point. It holds the one shared connection and wraps every failure in a `DatabaseError`. Always use `$1, $2, …` placeholders; never interpolate values into SQL.
- Money is stored as **integer cents**.

### How migrations run

1. The migrations are SQL files in `src-tauri/migrations/`, compiled into the binary via `src-tauri/src/migrations.rs`.
2. `plugins.sql.preload` in `tauri.conf.json` makes the plugin open the database during **native startup, before any window is created**, and apply all pending migrations.
3. Applied versions are recorded in the `_sqlx_migrations` table (with checksums). Each migration runs **once**.
4. Each migration runs **in a transaction**. If one fails, it is rolled back, the database stays at the last good version, and HomeBase exits instead of running against an inconsistent schema. The error is printed to stderr (visible when started from a terminal / in `tauri dev`).

### Adding a migration

1. Create the next numbered SQL file, e.g. `src-tauri/migrations/0003_create_household_objects_table.sql`.
2. Register it at the end of the list in `src-tauri/src/migrations.rs`:

   ```rust
   Migration {
       version: 3,
       description: "create_household_objects_table",
       sql: include_str!("../migrations/0003_create_household_objects_table.sql"),
       kind: MigrationKind::Up,
   },
   ```

3. Run `npm run tauri dev`. The migration is applied at startup.

Rules:

- **Never edit, renumber or delete a migration that has already run on any machine.** The checksum check would refuse to start. Fix mistakes with a new migration.
- Write additive, data-preserving SQL (`ALTER TABLE … ADD COLUMN`, new tables, data copies). For destructive table rebuilds, copy the data into the new table inside the same migration.

## 8. Security

- **Capabilities** (`src-tauri/capabilities/default.json`): only `core:default`, `sql:allow-select`, `sql:allow-execute`, `dialog:allow-save` and `dialog:allow-open` (native file pickers for backup/export). The backup/export/import commands in `data_transfer.rs` only receive paths the user picked in those dialogs.
- `sql:allow-load` is **not** granted. The frontend can only use the database preloaded by the native side and cannot open or create other database files.
- There is no filesystem, shell or HTTP access from the frontend.
- A strict Content Security Policy is set in `tauri.conf.json`. `style-src 'unsafe-inline'` is required because Vuetify injects its theme at runtime. Scripts are restricted to `'self'`.
- Everything works offline. Fonts and icons are bundled, with no CDN.

## 9. Project structure

```text
HomeBase/
├── index.html
├── package.json
├── vite.config.ts               # Vite + Vuetify plugin, fixed port 1420 for Tauri
├── tsconfig*.json
├── public/                      # Static files (favicon)
├── src/
│   ├── main.ts                  # App bootstrap (router, Vuetify, global error handler)
│   ├── App.vue                  # Shell: sidebar + routed view
│   ├── assets/styles/main.css   # Global style overrides (typography, buttons, cards)
│   ├── plugins/vuetify.ts       # Theme (colours) and component defaults
│   ├── router/index.ts
│   ├── types/                   # investment, household-category, household-object
│   ├── utils/                   # currency.ts (amounts in cents), date.ts
│   ├── services/
│   │   ├── database/
│   │   │   ├── database.service.ts  # Single connection, select/execute, error wrapping
│   │   │   └── database-error.ts
│   │   ├── investment.service.ts    # Investment SQL
│   │   ├── household-category.service.ts  # Inventory category SQL
│   │   └── household-object.service.ts    # Household object SQL
│   ├── composables/             # useInvestments, useHouseholdCategories, useHouseholdObjects, useDataTransfer
│   ├── components/
│   │   ├── layout/AppSidebar.vue
│   │   ├── common/              # PageHeader, EmptyState
│   │   └── investments/         # Summary card, priority list, list item, chip,
│   │                            # form dialog (create + edit), delete confirmation
│   │   └── inventory/           # Category tiles/dialogs, object list + dialogs
│   └── views/                   # InvestmentsView, InventoryView, InventoryCategoryView, SettingsView, settings/
└── src-tauri/
    ├── tauri.conf.json          # Window, CSP, bundling, SQL preload
    ├── Cargo.toml
    ├── capabilities/default.json
    ├── migrations/              # Versioned SQL migrations
    ├── icons/                   # Generated from icons/app-icon.svg (`npx tauri icon`)
    └── src/
        ├── main.rs
        ├── lib.rs               # Registers plugins, migrations and commands
        ├── data_transfer.rs     # Backup, restore, JSON/CSV export, JSON import
        └── migrations.rs
```

Add new domains (e.g. warranties) the same way: `types/` → `services/<entity>.service.ts` → `composables/use<Entity>.ts` → components/views.

## 10. Known limitations / next steps

- Investments can be listed, added, edited and deleted (via the ⋮ menu on each row). Drag-and-drop reordering is not implemented, and the drag handles are visual placeholders.
- Deletion is permanent. There is no undo or trash.
- Inventory: deleting a category runs two statements without a shared transaction. If the second fails, the category remains and the delete can be retried.
- If a migration fails in a release build, the app exits without a dialog because no dialog plugin is installed. Consider adding `tauri-plugin-dialog` or `tauri-plugin-log` once releases go to other users.
- The currency is fixed to EUR (`src/utils/currency.ts`), and number formatting follows the system locale.
- Only the light theme is defined. A dark theme can be added in `src/plugins/vuetify.ts`.
- Installers are not code-signed, so Windows SmartScreen will warn on first install.
- No automated tests yet.
