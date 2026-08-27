# Repository Agent Instructions

This file defines the default coding and review standard for the entire repository. `CLAUDE.md` is a symlink to it, so
every agent harness reads the same standard.

On startup, read this file first. Then read any more specific `AGENTS.md` file in the subdirectory you are working in.
More specific files may add local rules, but they should not lower the quality bar defined here.

## What this repo is

Eternum is a fully onchain strategy game built with Dojo (Cairo). One codebase serves multiple game worlds and formats —
**Blitz** (short, timed matches) and **Eternum** (long format). Games are rows keyed by `game_id` inside a persistent
world, created through the factory (GameRegistry) with immutable balance presets — not separate deployments.

The data pipeline, end to end: Cairo contracts (`contracts/game`) define the world (realms, buildings, resources,
armies, exploration, battles, relics, hyperstructures, victory points) → transactions execute on a Starknet sequencer →
Herald folds confirmed blocks, maintains the pre-confirmed overlay, and streams snapshots plus ordered diffs → the
client's sync runtime ingests updates into RECS, the single authoritative store → three.js scenes (`WorldmapScene`,
`HexceptionScene`) and the React UI render from it. The acting UI may show a local pending indicator; shared provisional
state comes only from Herald's pre-confirmed overlay.

Key directories: `apps/game` (the game client — has its own `AGENTS.md`), `packages/core` (game logic and sync runtime),
`packages/*` (Dojo/RECS bindings, shared types), `contracts/*` (Cairo), `deploy/appchain` (self-hosted chain infra —
read its README before touching it), `docs/plans` (implementation briefs: each item states its evidence, the fix, and a
verifiable gate).

## Engineering Principles

1. **KISS, always.** The simplest workable design wins. Overcomplication is a bug: flag it in review like one, and do
   not add layers, options, or abstractions a current requirement does not demand.
2. **Systemic fixes over point patches.** When a bug appears, ask what CLASS of bug it belongs to before fixing the
   instance. If the same root cause can bite elsewhere (a signal derived ad-hoc in several places, a guard every call
   site must remember, an unbounded cache pattern), fix the root: create the single source of truth, move the guard to
   the chokepoint, and migrate the existing copies onto it. A fix that leaves siblings of the same bug alive is
   incomplete. Example: spectator intent lives in `apps/game/src/utils/spectator-session.ts` — consumers import it;
   nobody re-derives it from the URL or account heuristics.
3. **Success of systemic work is deletion.** When a layer becomes trustworthy, the bespoke fallbacks, holds, TTLs, and
   timers stacked above it should disappear. A systemic "fix" that only adds code is suspect.
4. **Evidence before optimization.** Instrument, convict, then fix what the data names. Performance and bug-fix changes
   cite the log line, profile, or measurement that motivated them.

## AI-First Harness Standard

This repo follows `docs/architecture/ai-first-harness-architecture.md`.

When changing workflows, deployer code, shared runtime packages, or observability:

- prefer one workflow responsibility per job
- prefer explicit step names, artifacts, and retry boundaries
- prefer structured, machine-readable results over free-form status text
- centralize shared runtime, world, factory, manifest, release, and incident logic
- design operational code so agents can tell what ran, what changed, and how success is verified

## Client State & Sync Guardrails

Every client bug class in the Aug 2026 playtests traced to a violation of one of these rules. They apply to `apps/game`
and `packages/*`.

1. **One truth, per fact.** Current game facts live in RECS only: Herald's confirmed snapshot and ordered diffs are
   written into RECS — never held in a side store, react-query cache, or scene-local map as the primary copy. Immutable
   history and query-derived aggregates that are not current entity truth (story logs, battle logs, swaps, token
   transfers) may be SQL read models, but SQL must never provide an alternative or fallback version of a fact that is
   also present in RECS. Do not add new direct-fetch read paths for live state; when touching one, delete it.
2. **Entities are state; events are ephemera.** Anything persistent renders from Herald's snapshot plus entity diffs.
   Event messages drive only transient flourishes (toasts, FX triggers), and every event-driven feature must recover
   through the snapshot, replay ring, or immutable history sink. Event delivery is an accelerator, not the source of
   truth.
3. **Spread ambient work; apply player events atomically.** Batching, slicing, and lane scheduling exist for
   bulk/ambient churn. One player-initiated or single logical event (a move, a placement, a provisioned realm) must
   become visible in one step: batching must never show in the result of one action.
4. **No silent defaults.** A config or keyed lookup that misses must be loud in dev. Never let a silent fallback return
   a zero that gameplay math consumes.
5. **Pre-confirmation is shared; click feedback is local.** Herald owns the one pre-confirmed overlay and resets it at
   each confirmed head. The client never predicts or overrides RECS rows. An acting surface may keep local pending UI
   state for its own click, but that state must not become an alternative game fact or a bespoke reconciliation channel.
6. **Wired or deleted.** If it is exported, something imports it; if it is config, something reads it. Do not land a
   capability without its call site.

## Clean Code Standard

Write code so the top level reads like an outline of intent. The reader should understand what the code does before they
need to understand how it does it.

### Core Rule

At the top level of a file, exported functions, orchestration functions, and workflow steps should read in business
terms, not implementation terms.

### One Level Of Abstraction Per Function

Each function should stay at one conceptual level.

- Orchestration functions should orchestrate.
- Payload builders should build payloads.
- Resolvers should resolve values.
- Writers should write artifacts.
- Validators should validate.

Do not mix these responsibilities in one function unless the function is trivially small.

### Top-Level Readability

When reading an exported function from top to bottom, it should feel like a checklist.

If a top-level `if` block contains a full transaction body, a long object literal, or several unrelated operations,
extract that body into a helper with a precise name.

### Naming

Use names that describe what the code means in the domain, not what the syntax is doing.

If a helper name feels vague, the helper is probably hiding the wrong abstraction.

### Conditional Logic

Keep conditions simple at the top level.

- Pull complex boolean logic into `is...`, `has...`, `should...`, or `matches...` helpers.
- Pull action bodies into `build...`, `resolve...`, `create...`, `grant...`, `write...`, or `run...` helpers.
- Prefer one clear condition per branch.

If two branches do different domain actions, they should usually call different helpers.

### Data Construction

Do not bury business intent inside large inline object literals.

When a payload is trivial and obviously local, keeping it inline is acceptable.

### Shared Logic

If the same kind of resolution or IO exists in more than one place, centralize it.

Do not copy small "temporary" helpers across files in the clean module. If it is reusable, make it shared.

### File Structure

Keep related code together and keep file names honest.

- `shared/` is for genuinely shared helpers
- `factory/` is for factory discovery or factory-owned concepts
- `launch/` is for launch orchestration and launch artifacts
- `role-grants/` is for generic and specialized role-grant flows
- `config/` is for config loading, step selection, execution, and native config application
- `indexing/` is for indexer dispatch and tracking

Do not leave domain logic in the wrong folder once the true ownership is clear.

### Mutations And Results

Prefer clear result flow over scattered mutation.

- Collect related data into named result objects.
- Mutate summaries deliberately and near the orchestration flow.
- Avoid passing partially-known state through many helpers.

If a helper requires a fully resolved object, require it explicitly instead of threading optionals through the success
path.

### Comments

Comments should explain why a choice exists, not restate obvious code.

### PR Writing

Pull request titles and descriptions should sound like a thoughtful engineer explaining a change to another engineer.

Keep them specific, concise, and honest about verification and non-goals. Avoid autogenerated-sounding summaries,
file-move inventories, and vague cleanup language.

Do not commit PRD documents unless the user explicitly asks for that documentation change.

### Required Checks

When non-Cairo code changes, run these commands before finishing:

- `pnpm run format`
- `pnpm run knip`

When Cairo code changes, run:

- `scarb fmt`

If a change touches both non-Cairo and Cairo code, run all relevant commands.

If a required command fails or is unavailable, say so explicitly in the final handoff.

### Running Tests

- Never run bare `npx vitest` from the repo root: duplicate workspace names under `contracts/*/ext` break it.
- In `apps/game`, use `pnpm test [files]` (the wrapper script).
- In `packages/core`, use `pnpm exec vitest run` — bare `pnpm test` there is watch mode and never exits.
- Three load-sensitive files (`instanced-model.material-semantics`, `game-entry-preload`, `play-asset-manifest`) carry a
  30s `vi.setConfig` test timeout because full-suite contention starves them past the 5s default on green code. If one
  trips anyway, verify it in isolation before blaming your change.

### Before Finishing

Do one review pass specifically for readability.

Read the exported functions and top-level helpers in order and ask:

1. Can I understand the flow without descending into helper bodies?
2. Are helper names specific enough that I trust them immediately?
3. Is any top-level block still carrying payload, query, fs, or transaction detail?
4. Is any shared logic duplicated across files?
5. Is any file doing work that belongs in a different folder?

If the answer to any of these is yes, refactor again before stopping.

## Git Discipline

Stage explicit paths only — never `git add -A` or `git add .`; parallel agents may share a worktree, and blind staging
sweeps in work that is not yours. Never use `reset --hard`, `checkout .`, `clean -fd`, `stash`, or `--no-verify`. Commit
only what you changed.

## Non-Negotiable Rule

Do not leave sloppy code behind because it "works".

If the structure is hard to read, the work is not done.
