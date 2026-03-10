# Worldmap Optimization Feedback Loop

Run these commands from `client/apps/game` or invoke them from repo root with `pnpm --dir client/apps/game ...`.

Use the existing Playwright worldmap benchmark as a repeatable optimization loop:

- `pnpm bench:worldmap:feedback`
  Runs the benchmark, writes raw artifacts into `output/playwright/worldmap-optimization-loop/<timestamp>/`, and
  compares the latest run against `benchmarks/worldmap-performance.baseline.json` if that file exists. When the script
  launches Vite itself, it automatically picks a free localhost HTTPS port starting at `4173`. It also derives the
  spectator world and chain from the game env files (`.env.local` first, then the repo defaults) unless
  `WORLDMAP_SPECTATOR_WORLD` / `WORLDMAP_SPECTATOR_CHAIN` are already set.
- `pnpm bench:worldmap:feedback:baseline`
  Runs the benchmark and replaces the saved baseline with the latest result.
- `pnpm bench:worldmap:feedback:headed`
  Same as the normal loop, but leaves the browser visible for investigation.
- `pnpm bench:worldmap:feedback -- --skip-web-server`
  Reuses an already-running local game app on `https://127.0.0.1:4173` when you do not want Playwright to manage Vite.
- `pnpm bench:worldmap:feedback -- --skip-web-server --base-url https://127.0.0.1:4181`
  Points the benchmark at a manually started server on a different port when Vite had to fall back from `4173`.

Each run emits:

- `worldmap-benchmark.json`: raw Playwright payload captured from the in-browser debug hooks
- `worldmap-benchmark.png`: benchmark screenshot
- `worldmap-feedback.json`: machine-readable regression analysis
- `worldmap-feedback.md`: concise human-readable report

Useful overrides:

- `--debug-armies <count>`
- `--sweep-iterations <count>`
- `--skip-web-server`
- `--base-url <url>`
- `--frame-threshold <fraction>`
- `--chunk-threshold <fraction>`
- `--heap-threshold <fraction>`
- `--metric-threshold <fraction>`

Example:

```bash
pnpm bench:worldmap:feedback -- --debug-armies 120 --frame-threshold 0.2
```
