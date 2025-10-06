# Tauri Desktop Implementation Plan for the Vite Game App

## Objectives

- Deliver a desktop-ready bundle of the existing game client by wrapping the Vite app in a Tauri shell.
- Reuse the current web build output (`dist/`) so desktop artifacts stay in sync with browser releases.
- Establish a development workflow that mirrors existing `pnpm` scripts while honoring Tauri's requirements (fixed
  ports, `TAURI_DEV_HOST`, etc.).
- Prepare the foundation for a follow-up release that embeds an indexer sidecar so every desktop install can participate
  as a network node.

## Prerequisites & Tooling

- Confirm Rust toolchain installation (`rustup`, nightly not required) and Tauri prerequisites for each target platform:
  - **macOS**: Xcode CLT, `brew install tauri-cli` (optional), Apple Developer certificates for notarization later.
  - **Windows**: Visual Studio 2022 Build Tools with Desktop development workload.
  - **Linux**: GTK3 development libraries (`libgtk-3-dev`, `libwebkit2gtk-4.1-dev`, etc.).
- Update onboarding docs to mention `pnpm --filter game-app tauri dev` under a "Desktop" section once the scripts land.
- Ensure Vite build emits to `client/apps/game/dist` (already default) and `pnpm install` at repo root has been run.

## Directory Layout Expectations

```
client/apps/game/
  package.json
  dist/
  src/
  vite.config.ts
  src-tauri/           # new folder created by `tauri init`
    Cargo.toml
    src/main.rs
    tauri.conf.json
```

- Run `pnpm --filter game-app dlx tauri init --ci --app-name "Eternum" --window-title "Eternum"` inside
  `client/apps/game` to scaffold `src-tauri` without interactive prompts.
- Accept the TypeScript + Vite template; choose Rust Edition 2021. The CLI adds `src-tauri` but does not alter existing
  source files.

## Phase 1: Baseline Tauri Shell

### 1. Initialize Tauri Project

- Execute the init command above (once).
- Verify `Cargo.toml` references `tauri = { version = "^2", features = [...] }` as required; adjust features (e.g.,
  enable `shell-open` if deep links are needed).
- Add `src-tauri` to `pnpm-workspace.yaml` so shared scripts can run from the monorepo root if desired.

### 2. Align Package Scripts

- In `client/apps/game/package.json`:
  - Add `"tauri": "tauri"` script (CLI proxies to `src-tauri`).
  - Create `"tauri:dev": "pnpm tauri dev"` and `"tauri:build": "pnpm tauri build"` helpers if we want explicit labels.
- At the workspace root, optionally expose `"desktop:dev": "pnpm --filter game-app tauri dev"` for convenience.

### 3. Configure `tauri.conf.json`

- Replace `build` block with:
  ```json
  {
    "build": {
      "beforeDevCommand": "pnpm --filter game-app dev",
      "beforeBuildCommand": "pnpm --filter game-app build",
      "devUrl": "http://localhost:5173",
      "frontendDist": "../dist"
    }
  }
  ```
- Ensure `tauri.allowlist` is minimal (only `shell.open`, `window` management, etc.) to keep security surface small.
- Populate `tauri.bundle` metadata (identifier, icons, copyright, category).
- Check in platform-specific icon stubs in `src-tauri/icons` (we can reuse existing branding).

### 4. Update Vite Config (`vite.config.ts`)

- Import `defineConfig` and read `const host = process.env.TAURI_DEV_HOST;`.
- Apply the server overrides exactly once:
  ```ts
  export default defineConfig({
    clearScreen: false,
    server: {
      port: 5173,
      strictPort: true,
      host: host || false,
      hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
      watch: { ignored: ["**/src-tauri/**"] },
    },
    envPrefix: ["VITE_", "TAURI_ENV_*"],
    build: {
      target: process.env.TAURI_ENV_PLATFORM === "windows" ? "chrome105" : "safari13",
      minify: process.env.TAURI_ENV_DEBUG ? false : "esbuild",
      sourcemap: !!process.env.TAURI_ENV_DEBUG,
    },
  });
  ```
- Confirm the `envPrefix` change does not break existing usages of `import.meta.env`.

### 5. Rust Entrypoint Tweaks

- In `src-tauri/src/main.rs`, set the window title, dimensions, and optionally disable file drop if unneeded.
- Consider hooking `setup` to inject environment-derived config or to register future commands.

### 6. Development Workflow

- Standard dev loop: `pnpm --filter game-app tauri dev` → Tauri runs Vite dev server then opens desktop window pointing
  to `http://localhost:5173`.
- For physical iOS testing (future), set `TAURI_DEV_HOST=$(ipconfig getifaddr en0)` prior to running `tauri dev`; update
  docs with a helper script.
- Update onboarding docs (game README) with a "Desktop Development" section covering the above commands and
  prerequisites.

### 7. Bundling & Distribution

- Production build sequence:
  1. `pnpm --filter game-app build` (emits `dist/`).
  2. `pnpm --filter game-app tauri build` (calls Rust bundler, produces `.app`, `.exe`, `.AppImage`, etc., in
     `src-tauri/target/*`).
- Configure `tauri.bundle` targets (`"targets": ["macOS", "windows", "linux"]`) and supply platform-specific icon assets
  under `src-tauri/icons`.
- For CI:
  - Extend existing pipeline to install `pnpm`, Rust, and target toolchains.
  - Cache `pnpm` store and Rust `target/` between runs.
  - Upload artifacts per platform for QA.

### 8. Quality & Testing

- Add smoke test plan: launch app, verify initial route loads, run a short gameplay script; evaluate Playwright + Tauri
  driver or simple Rust integration tests using `tauri::test` (when available).
- Enforce lint/format:
  - Add `"tauri:lint": "pnpm --filter game-app tauri lint"` (or `cargo fmt && cargo clippy`).
  - Update CI to execute `cargo fmt --check` and `cargo clippy -- -D warnings` under `src-tauri`.
- Confirm hot reload works by modifying a React component while `tauri dev` is running.

## Phase 2: Indexer-Enabled Desktop Builds

### 1. Sidecar Architecture

- Decide whether the indexer runs as a Rust crate within the main binary or as a sidecar process managed by Tauri:
  - For modularity, create `src-tauri/indexer/` crate compiled as a sidecar binary.
  - Define IPC surface via Tauri commands or the `@tauri-apps/plugin-shell` API.
- Map configuration for peer discovery, storage directories, and ports; note firewall considerations.

### 2. Data & Asset Bundling

- Extend `tauri.conf.json` `bundle.resources` to ship any static datasets, schemas, or migration files required by the
  indexer.
- Provide first-run setup script that seeds local databases and checks disk availability.

### 3. UI Integration & Feature Flagging

- Build a desktop-only feature flag (env `TAURI_ENV_ENABLE_INDEXER`) so we can ship the shell before enabling the node
  features.
- Surface indexer status in UI (e.g., system tray indicator, modal) through Tauri events.

### 4. Operations & Telemetry

- Instrument health metrics (sync status, block height, errors) and send to existing analytics when allowed.
- Document upgrade path and cleanup routines (e.g., resetting local node state).

### 5. Distribution Considerations

- Ensure notarization/signing pipelines handle sidecar binaries.
- Update CI to build multi-binary bundles and include E2E smoke tests that validate indexer startup.

## Open Questions & Risks

- **Port collisions**: If 5173 is occupied, do we offer a fallback? We can expose `TAURI_DEV_PORT` env override but
  document expectation.
- **Security review**: Need explicit audit of Tauri allowlist, CSP, and `dangerousRemoteDomainIpcAccess` settings.
- **CI footprint**: Desktop bundling requires per-platform runners; confirm availability or use GitHub Actions matrix.
- **Future iOS support**: If we target Tauri mobile in addition to desktop, revisit host/IP configuration and plugin
  support.

## Reference Commands

```bash
# Initialize Tauri once
pnpm --filter game-app dlx tauri init --ci

# Dev mode
pnpm --filter game-app tauri dev

# Production bundle
pnpm --filter game-app build && pnpm --filter game-app tauri build

# Format Rust sources
cargo fmt --manifest-path src-tauri/Cargo.toml
```

## Next Steps

1. Run the init command and commit the new `src-tauri` scaffold.
2. Apply the configuration edits above (`tauri.conf.json`, `vite.config.ts`, package scripts).
3. Smoke-test `pnpm --filter game-app tauri dev` on macOS to validate baseline shell.
4. Scope the indexer sidecar design and create follow-up tasks for implementation.
