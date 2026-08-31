# A3 — Torii Simplification — Codex Handoff

Status: **CLOSED — A3 ACCEPTED 2026-08-09** (review + live bidirectional D16 verification on the dev-stack torii-s2
service). Milestone: A3 of `docs/plans/appchain-single-world.md`. Prereq: A2 COMPLETE — the `s2_blitz` world is live on
the dev appchain at `0x15ab45aea9188b0c4a8de1dc00fd23e71082aef2cb6384451d37ce0771b661a` with preset 1 registered and a
real 29-second pipeline launch validated.

**Motto: KISS.** Smallest workable version of everything; no new abstractions; overcomplication is a review finding.

## Mission

The torii fork (`~/torii`, branch `feat/dynamic-contract-indexing`, image `1.8.16-mw-dynamic-v*`) exists ONLY because we
ran many worlds through one torii: its three patches are the GraphQL multi-world panic fix, the gRPC ambiguous-column
fix (duplicate model JOINs across worlds), and `world_registry_models` auto-discovery of factory-deployed worlds. The
single-world architecture removes the reason for all three. A3 proves stock upstream torii serves the s2 world
correctly, produces the vanilla config, verifies the D16 subscription question that gates A4's client sync design, and
gives us a pruning story for ended games.

Sequencing reality (differs from the plan doc's original exit): the production torii at `torii.jcndata.com` must KEEP
serving the legacy s1 worlds until the client migrates (A4) — so A3 validates and stages everything, the reviewer stands
up a parallel vanilla-torii service for s2, and the legacy fork retires at A5 cutover, not now.

## Ground rules

- Branch: `feat/single-world-blitz`. NEVER commit to `feat/appchain-phase-1`.
- Scope: a new `deploy/appchain/torii-s2/` directory (config template + validation/pruning scripts + README),
  `docs/plans/A3-NOTES.md`, and additions under `config/deployer/clean/tests/` if you write JS/TS tests. Do NOT touch:
  `client/` (reviewer's domain), the torii fork repo, `deploy/appchain/cdk/` (reviewer deploys), `.github/workflows/`,
  `contracts/` (no Cairo changes — escalate gaps via A3-NOTES).
- Everything must be verifiable on the LOCAL spike stack (`deploy/appchain/spike`): katana + the s2 world migrated
  locally (A2's flow: `sozo migrate` with the spike-rendered profile, then `deploy/appchain/scripts` bootstrap +
  `register-preset.ts`, then `launch-step.ts create-world` — see A2-NOTES for the exact commands). You cannot reach AWS.
- Upstream torii: use the official published image/binary matching dojo 1.8.x (the chain serves Starknet RPC 0.10 — pick
  the newest upstream torii release compatible with it; record the exact version in A3-NOTES). If an upstream release
  does not exist for RPC 0.10, STOP and record it — do not patch torii.

## Deliverables

**D1 — Vanilla single-world torii config** (`deploy/appchain/torii-s2/torii.toml.template`): stock upstream torii, ONE
pinned world (templated address), `namespaces = ["s2_blitz"]`, no `world_registry_models`, no exclusions, sane indexing
settings copied from the current dev config (pending/pre_confirmed/controllers as today). Plus a short README: how to
render and boot it locally against the spike stack.

**D2 — Upstream parity matrix.** Boot STOCK upstream torii locally against the local s2 world with two games created
(game 1 and game 2, overlapping players/coords — reuse the A2 launch CLI twice). Verify and record PASS/FAIL for each
surface the client uses:

1. `/sql`: table-per-model with `game_id` columns; a `WHERE game_id = ?` query returns only that game's rows (spot-check
   GameRegistry, Structure, TileOpt, Resource).
2. GraphQL: entity query with a `game_idEQ` where-filter on a model; no panic (the fork's panic was multi-world-specific
   — prove it's gone in single-world).
3. gRPC entity fetch: no ambiguous-column errors on models that previously collided (the fork fixed duplicate JOINs —
   single world should not produce them; query a model + its nested members).
4. Torii bootstraps from block 0 and reaches head; record indexing wall-clock for the spike chain.

**D3 — D16 subscription verification harness** (`deploy/appchain/torii-s2/d16-verify.ts`, bun +
`@dojoengine/torii-client` or the SDK the client uses — check `client/` package.json for the exact `@dojoengine/*`
versions; using the SAME versions matters because this result gates A4's design; reading client/package.json is allowed,
editing client/ is not). Against local stock torii with two live games:

1. Subscribe with a KEY-PREFIX clause (`game_id` as keys[0], remaining keys wildcard) → mutate state in game 1 (a
   launch/settle/explore via existing CLIs or a direct system call) → the update arrives.
2. Same subscription → mutate game 2 → NO update arrives (isolation).
3. MemberClause on `game_id` as a MEMBER (for models where the client filters by member, e.g. `GameRegistry.status`):
   does a Member where-clause on a key field work in queries and subscriptions?
4. Composite clause: game_id prefix + player address (the "my entities in my game" shape). Output a PASS/FAIL matrix per
   clause shape per surface (query vs subscription). THIS MATRIX IS THE DELIVERABLE A4 DEPENDS ON — precision beats
   breadth: exact clause JSON, exact observed behavior.

**D4 — Pruning script** (`deploy/appchain/torii-s2/prune-games.ts`): deletes a finished game's rows from torii's sqlite.
Input: db path + game_id list (or `--settled-older-than-days N` resolving game ids via the GameRegistry table). Deletes
`WHERE game_id = ?` from every `s2_blitz-*` model table that has a game_id column, plus the matching rows in torii's
internal `entities`/`entity_model`/`event_messages` tables (keys begin with the game_id felt — inspect the schema and
document exactly what is and isn't prunable). `--dry-run` prints per-table counts. Measure on the spike: DB size before
create → after two games + play → after pruning game 1 (VACUUM) → record the numbers. If some internal table can't be
pruned safely, document the limitation rather than forcing it — flat-ish beats corrupted.

**D5 — `docs/plans/A3-NOTES.md`**: upstream version chosen; parity matrix; D16 matrix; pruning numbers + limitations;
anything escalated.

## Facts that save time

- Current dev torii config shape: SSM `/realms-appchain/dev/torii-config` (mirrored in the A2 handoff scout notes) —
  copy indexing settings from there; the spike's `torii/torii.template.toml` is the multi-world FORK shape, don't copy
  its world_registry parts.
- The fork's three patches and their motivations are in memory/plan docs; the GraphQL panic repro was world-scoped
  queries across worlds; the gRPC bug was duplicate model JOINs when two worlds shared a namespace. Both need
  single-world DISPROOF, not fixes.
- Two-game local setup: A2-NOTES documents the exact spike commands; `launch-step.ts` with
  `APPCHAIN_MANIFEST_PATH=contracts/l3/game/manifest_spike.json` and local RPC/TORII URLs.
- The client's SDK is 1.7-line (`client/package.json` — read-only) and A4 will use key-prefix subscriptions; if the
  installed torii-client can't express a clause shape, that's a FINDING (record it), not something to work around
  silently.
- Model key orders: every per-game model has `game_id` at key[0] (C1); `ResourceList`/`ResourceMinMaxList` are
  PRESET-scoped (`preset_id` key[0]) — don't include them in per-game pruning.
- Torii sqlite internal schema: look at the actual DB the spike produces (`torii-data` volume) rather than guessing
  table shapes.

## Definition of done

1. Stock upstream torii serves the local s2 world: D2 matrix all-PASS (or failures precisely documented with repro).
2. D16 matrix complete for all four clause shapes × query/subscription, with exact clause payloads.
3. Prune cycle measured: numbers in A3-NOTES; script has dry-run and refuses to run against a db with a live
   (non-Settled) game in the target list.
4. `pnpm run format` + `pnpm run knip` pass; all new scripts run under bun with repo deps only.
5. A3-NOTES complete. Reviewer then: reviews, stands up the parallel `torii-s2` service on the dev stack with the D1
   config, re-runs D3 against it, and wires A4 client work against that endpoint.
