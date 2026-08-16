# Eternum — Agent Instructions

This file is the coding, review, and operating standard for the whole repository. `CLAUDE.md` is a symlink to it. Read
this first; a subdirectory `AGENTS.md` (e.g. `client/apps/game/AGENTS.md`) may add local rules but never lowers the bar
set here.

## What this repo is

Eternum is a fully onchain strategy game built with Dojo (Cairo) running on our own Katana appchain. One codebase serves
two persistent worlds — **Blitz** (short, timed matches) and **Eternum** (long format). Games are not separate
deployments: they are rows keyed by `game_id` inside a world, created through the factory (GameRegistry) with immutable
balance presets. The client is a React + three.js app; players sign with a Cartridge Controller session wallet.

## Engineering principles

1. **KISS, always.** The simplest workable design wins. Overcomplication is a bug: flag it in review like one. Do not
   add layers, options, or abstractions a current requirement does not demand.
2. **Systemic fixes over point patches.** Before fixing an instance, ask what CLASS of bug it belongs to. If the same
   root cause can bite elsewhere, fix the root: one source of truth, guard at the chokepoint, migrate the existing
   copies. A fix that leaves siblings alive is incomplete.
3. **Success of systemic work is deletion.** When a layer becomes trustworthy, the bespoke fallbacks, holds, TTLs, and
   timers above it must disappear. A "fix" that only adds code is suspect.
4. **Evidence before optimization.** Instrument, convict, then fix what the data names. Briefs and PRs cite the log
   line, profile, or metric that motivated the change.

## How the game works, end to end

**Chain.** Cairo/Dojo contracts (`contracts/game`) define the world: realms and structures on a hex map, resource
production and buildings, armies (explorers) that travel/explore/battle, relic crates, hyperstructures, and victory
points. Transactions go to Katana (instant mining, 30s idle heartbeat).

**Indexing.** Torii indexes each world and serves clients three ways: entity subscriptions (current state, grpc-web
stream), event-message subscriptions (transient notifications), and SQL (immutable history / aggregates).

**Client sync.** One pipeline: bootstrap → Dojo setup → snapshot sync → `GameSyncRuntime` ingest queue (time-budgeted
slices, ~25ms) → RECS components. RECS is the single authoritative store; everything renders from it. The event stream
has failure detection, backoff re-subscribe, and renewal for cancel-only handles (gap-fill replay is the current
workstream).

**Rendering.** three.js `WebGPURenderer` only (modes `webgpu-auto` / `webgpu-force-webgl`; the legacy WebGL stack is
deleted). Two main scenes: `WorldmapScene` (chunked hex terrain, instanced models, camera acts as a view filter over
synced state) and `HexceptionScene` (local realm view, buildings). Heavy work goes through the frame-budget work queue;
pipelines prewarm behind loading gates with a time-box, never blocking a visible transition. `RenderProfile` has Quality
and Battery modes — Battery changes when/how often work happens, never what pixels look like. Both cap at 60fps.

**Player actions.** UI → optimistic write → tx via Controller → Katana → torii echo reconciles. Optimistic state is
being unified onto a single provisional-write path through the normal ingest pipeline (see Direction below); do not add
new bespoke optimistic channels.

## State & sync guardrails

Every client bug class in the Aug 2026 playtests traced to a violation of one of these. They apply to `client/apps/game`
and `packages/*`.

1. **One truth, per fact.** Current entity state lives in RECS only. SQL serves immutable history and aggregates, never
   an alternative copy of a live fact. When touching a stray direct-fetch read path for live state, delete it.
2. **Entities are state; events are ephemera.** Anything persistent renders from the entity stream. Event messages drive
   only transient flourishes (toasts, FX triggers) — and every event-driven feature must survive a dead event stream
   (query-on-demand or entity-derived fallback).
3. **Spread ambient work; apply player events atomically.** Batching, slicing, and lane scheduling exist for
   bulk/ambient churn. One player-initiated or single logical event (a move, a placement, a provisioned realm) must
   become visible in one step. Batching must never show in the result of one action.
4. **No silent defaults.** A config or keyed lookup that misses must be loud in dev. Never let a silent fallback return
   a zero that gameplay math consumes.
5. **Pending state expires, and lives in one place.** Optimistic/provisional state is one record per entity with an
   expiry enforced where it is consumed — never parallel maps cleaned in sync.
6. **Wired or deleted.** If it is exported, something imports it; if it is config, something reads it. No capability
   lands without its call site.

## Repo map

- `client/apps/game` — the game client (React, three.js, Vite). Has its own `AGENTS.md`.
- `client/apps/game-docs`, `landing`, others — auxiliary apps.
- `packages/core` — game logic, sync runtime, managers (chain-agnostic TypeScript).
- `packages/{dojo,react,types,provider,torii}` — Dojo/RECS bindings and shared types.
- `contracts/game` — the world's Cairo contracts; other `contracts/*` are peripheral (passes, marketplace, factory).
- `deploy/appchain` — CDK stack, torii config, ops scripts, and the infra README (read it before touching infra).
- `docs/plans` — implementation briefs (the handoff format between planning and execution agents).
- `docs/architecture/ai-first-harness-architecture.md` — standard for workflows/deployer/observability code: one
  responsibility per job, explicit steps and artifacts, machine-readable results.

## Working on the code

**Run the client:** `pnpm dev` in `client/apps/game` with `--mode appchain.blitz` or `--mode appchain.eternum` (env
files per mode; `.env.production` is what the deployed client uses).

**Tests — the traps:**

- Never run bare `npx vitest` from the repo root: duplicate workspace names under `contracts/*/ext` break it. In
  `client/apps/game` use `pnpm test [files]` (wrapper). In `packages/core` use `pnpm exec vitest run` (bare `pnpm test`
  there is watch mode and never exits).
- Known load-sensitive flake: `instanced-model.material-semantics.test.ts` times out in full runs and passes in
  isolation. Verify in isolation before blaming your change.

**Required checks before finishing:** `pnpm run format` and `pnpm run knip` for non-Cairo changes; `scarb fmt` for
Cairo. Typecheck the packages you touched. Say so explicitly if a required command fails or is unavailable.

**Client UX changes** must add an entry to `client/apps/game/src/ui/features/world/latest-features.ts` (see the client
`AGENTS.md`).

**Git:** stage explicit paths only — never `git add -A`/`git add .` (parallel agents may share the worktree, and blind
staging has swept junk before). Never `reset --hard`, `checkout .`, `clean -fd`, `stash`, or `--no-verify`. Commit only
what you changed.

## Clean code standard

The top level of a file reads like an outline of intent, in domain terms.

- One level of abstraction per function: orchestrators orchestrate, builders build, validators validate. Extract long
  bodies out of top-level branches into precisely named helpers (`is…`/`should…` for conditions,
  `build…`/`resolve…`/`run…` for actions).
- Names describe domain meaning, not syntax. A vague helper name is hiding the wrong abstraction.
- Shared resolution or IO gets centralized, not copied "temporarily" across files.
- Comments state a constraint the code cannot show — why a choice exists, never what the next line does.
- PR descriptions sound like an engineer explaining a change: specific, honest about verification and non-goals. No
  autogenerated summaries or file-move inventories. Do not commit PRD documents unless explicitly asked.
- Before finishing, reread your exported functions top to bottom: if flow requires descending into helpers, or shared
  logic is duplicated, refactor before stopping. Do not leave sloppy code behind because it "works".

## Infra & deployment

Everything runs in AWS `061906581174` (us-east-1) on one EC2 box (m7a.xlarge, Elastic IP `52.54.98.119`), managed by CDK
(`deploy/appchain/cdk`). Katana + two torii instances run in docker; nginx routes by Host header. Chain data, torii DBs,
and TLS certs live on a RETAIN EBS volume at `/data`, so instance replacement keeps them.

| Endpoint                    | Path                                                        |
| --------------------------- | ----------------------------------------------------------- |
| `katana.jcndata.com`        | Cloudflare-proxied → nginx :80 → katana :5050               |
| `torii.jcndata.com` (blitz) | **DNS-only** → nginx :443 (direct TLS, http2) → torii :8081 |
| `torii-eternum.jcndata.com` | **DNS-only** → nginx :443 (direct TLS, http2) → torii :8082 |
| `play.jcndata.com`          | Tester client, S3 + Cloudflare                              |

The torii hostnames are deliberately not proxied: Cloudflare's ~100s idle cutoff killed the sparse event-message stream.
Direct TLS (Let's Encrypt on the box, auto-renewed, certs on `/data`) is the systemic fix; the client's stream-recovery
machinery is insurance on top, not life support.

- **Deploy the client:** `gh workflow run deploy-client.yml --ref <branch> -f version=<label>` (builds from the
  committed `.env.production`).
- **Launch a game:** factory UI in the client (`/factory`) → `game-launch.yml`.
- **Change infra:** edit the CDK stack; note that userData changes replace the instance (data survives on `/data`). See
  `deploy/appchain/README.md` for torii config via SSM and other ops.
- Box access is via AWS SSM (`aws ssm send-command`, profile `realms-appchain`).

## Direction & handoffs

Current direction: the appchain is the home chain (two persistent worlds, factory-created games), with a gateway to
mainnet later. The client stabilization arc (sync overhaul S1–S4, render overhaul P0–P3.x) is converging on **P4
systemic consolidation**: event-feed gap-fill replay, optimistic state unification, and material/texture consolidation —
see `docs/plans/render-overhaul-p4-codex-brief.md`.

Work is handed between agents as briefs in `docs/plans/`: each item states the evidence (log line, measurement), the
fix, and a verifiable gate. Follow the brief's gates literally; if the evidence contradicts the brief, say so instead of
building it anyway.
