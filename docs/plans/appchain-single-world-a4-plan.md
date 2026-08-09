# A4 — Client Migration — Work Plan (Claude-executed)

Status: **IN PROGRESS (started 2026-08-09).** Milestone A4 of `docs/plans/appchain-single-world.md`. Owner-decided: all
client work is Claude's own implementation (Codex handled contracts/pipeline/tooling). Base audit:
`docs/plans/appchain-single-world-a0/client-core.md` (file:line inventory). Motto: KISS.

## Inputs now frozen

- World: `s2_blitz` at `0x15ab45…b661a` on the dev appchain; torii target `http://<dev ALB>:8081` (stock torii-s2; fork
  torii keeps serving the s1 client until A5).
- D16 (A3-NOTES): key-prefix, member-on-key, and composite clauses ALL work in queries + subscriptions on SDK
  `1.7.0-preview.3`. gRPC queries MUST project models (78 models > SQLite 64-join limit).
- Keys: `game_id` is key[0] on every per-game model, entity id key[1] (C1); `ResourceList`/ `ResourceMinMaxList` are
  `(preset_id, …)`; rulebook models preset-keyed — resolve `preset_id` from the game's `GameRegistry` row. Global
  models: `AddressName` (account-level names), `BiomeDiscovered`, RNG.
- Presets: 1 = legacy 2h (HIDE), 2 = official-60 "Regular Fast" (DEFAULT), 3 = Duel balance (launch with twoPlayerMode).
  Catalog: `blitz-fast` → version 2, `blitz-duel` → version 3; hide `blitz-open`; UI `version` field = preset id.

## Phases (recommended ~60–80-file path from the audit)

**P1 — Game profile + dead machinery.** _Adjustments (2026-08-09): dual-arm reality — mainnet keeps the legacy flow from
this same client, so `manifest-patcher` (load-bearing for both arms; identity on s2) and `factory-worlds` (landing list
until P5) are KEPT; `world-torii` scope-injection becomes a natural no-op on single-world torii-s2 and is deleted with
the P4 SQL rewrite. Bindings decision: ONE generated `contract-components.ts` with the namespace as a bootstrap
parameter (appchain → `s2_blitz`, mainnet → `s1_eternum`) and a superset schema (s2 models incl. `game_id` + retained
s1-only models — models absent on a chain simply never receive data). `.env.local` → torii-s2 :8081;
`.env.appchain.blitz` unchanged (torii.jcndata.com becomes the s2 torii at A5 cutover)._ `WorldProfile` → `GameProfile`
(constant chain endpoints + `gameId`); active game from dashboard selection/URL; env: `VITE_PUBLIC_TORII` → torii-s2 for
the s2 arm. DELETE the shared-torii scoping machinery (audit §6: world-torii.ts, use-world-availability scope injector,
appchain-worlds-summary internal_id JOIN, factory-worlds.ts wf- reads, manifest-patcher). Regenerate
`contract-components.ts` bindings from the s2 manifest (namespace + game_id fields); sweep the 521 `s1_eternum-`
literals.

**P2 — Sync boundary (the isolation mechanism).** Generate the per-model key-arity table from the s2 manifest (do not
hand-maintain); sync.ts model lists → clause FACTORIES taking gameId (key[0] prefix, keyCount+1); delete the
subscribe-to-everything fallback branch (audit §5 — the ghost-settlement mechanism); torii-stream-manager
`buildModelKeysClause` chokepoint prepends gameId; bounded spatial sync gains
`AndCompose(MemberClause(model, "game_id", Eq, gameId))` (D16-proven); queries.ts: all arities +1,
`getEntitiesFromTorii` → `keys:[gameId, entityId]`, per-query model projection everywhere, sessionStorage config cache
key includes gameId.

**P3 — Core managers.** `configManager`: keep the module export, scope internally — `WorldConfig[gameId]` for the 39
singleton reads; rulebook reads via `preset_id`; `getTick`/`getSeasonConfig` from the game's registry row (kills the
wrong-clock bug); dev-mode assert on default-miss. `gameEntityKey(...)` wrapper prepending the active gameId + codemod
over the 266 `getEntityIdFromKeys` sites (raw calls become the lint signal for global models). Scope
LeaderboardManager/MapDataStore/unscoped runQuery scans; SeasonEnded → per-game (a finished game must not end every
game).

**P4 — SQL layer + lint.** packages/torii `~71 FROM clauses / 13 files`: every `s2_blitz-` table gets
`WHERE game_id = ?` (JOINs on BOTH sides); the LIMIT-1 WorldConfig pattern → keyed reads. Add the /sql scoping lint/test
(A3-deferred): any s2_blitz table reference without game_id fails CI.

**P5 — Dashboard + factory-v2 UX pass.** Games list from `GameRegistry` (replaces wf-WorldDeployed discovery);
availability/registration/settlement hooks on game_id predicates; catalog per the frozen mapping; surface
`artifacts.gameId`; the shared world address is no longer a per-game identity — the UX treats games as rows of one
world; run-record UI renders the 2-step appchain plan.

**P6 — Acceptance (plan exit).** Two concurrent games open in two tabs against torii-s2, fully isolated: clocks, maps,
settlements, leaderboards. One-time session approval verified. Playtest launch through the UI button after the Lambda
`DEFAULT_WORKFLOW_REF` flip (the flip itself is the A5 gate — until then, manual dispatch).

## Order and discipline

P1 → P2 → P3 are strictly sequential (each is the foundation of the next). P4 can interleave after P2. P5 last (needs
the data layer stable). Commit per phase; `pnpm run format` + `knip` + the client test suite per commit; no drive-by
refactors outside the audit's file lists.

## P2/P3 execution notes (2026-08-10)

- **P2 shipped** (`adcc66999b`): `src/dojo/game-scope.ts` is the single scope module (namespace + gameId, set in
  `runBootstrap` next to `configManager.setActiveGame`). The `buildModelKeysClause` chokepoint collapses every per-game
  model into one `keys: [gameIdHex]` VariableLen clause (D16 encoding); the per-model key-arity table turned out to be
  unnecessary — VariableLen with the game-id prefix covers all arities, so only the per-game/chain-global classification
  matters, and that set is pinned against `manifest_appchain.json` by `game-scope.test.ts` instead of generated.
  Subscribe-to-everything fallback deleted; appchain env now runs bounded spatial sync (matches mainnet blitz prod).
  s2 stream list drops SeasonEnded/QuestLevels/PlayersRankFinal, adds GameRegistry.
- **P3 codemod shipped**: `gameEntityKey` (plus `buildingEntityKey` — s2 Building inserted an `alt` key, always 0 since
  structures never sit on the alt plane — and `worldConfigKey` for s1-const→s2-gameId rows: WorldConfig,
  HyperstructureGlobals, SeasonPrize, MMRGameMeta). Core/react import from `managers/config-manager`; **client files
  import the twin helpers from `@/dojo/game-scope`**, deliberately: 51 client test files hand-mock
  `@bibliothecadao/eternum`, and a package-root import would force every one of those mocks to stub the helper.
  Trial-keyed prize rows (PlayerRank/RankPrize) branch on active game (s2 keys by game_id, s1 by trial_id).
  AddressName/preset-table/s1-only (Market/Liquidity/Trade/Quest) lookups intentionally keep raw `getEntityIdFromKeys` —
  raw calls on per-game models are now the code-review signal.
- **SeasonEnded → per-game**: `configManager.isGameOver()` reads GameRegistry.status (Ended/Settled);
  `LeaderboardManager.isSeasonOver` and the rewards-menu gate branch on it; the SeasonEnded event stays legacy-only.
  SeasonWinnerStoreManager's `sqlApi.fetchSeasonEnded()` is P4 (SQL arm).
- **Scan scoping resolved by construction**: with every ingress path (streams, snapshots, targeted queries) game-scoped
  and RECS wiped on world/game switch (`clearBootstrapWorldData`), unscoped `runQuery` scans can only ever see the
  active game's rows — no per-row game_id filters added.
- Found and fixed along the way: bindings generator missed `metadata.types` u32 prepend for single-line arrays (16
  models; BlitzSettlement test caught it); `normalizeProduction` crashed on partial Resource fixtures; players-panel
  GuildWhitelist lookup had (address, guild) reversed — a pre-existing always-miss.

## P4 execution notes (2026-08-10, `f8cfade684`)

- `buildApiUrl` is the SQL chokepoint: `{GF}`/`{GF:alias}` markers on every per-game table, resolved to
  `game_id = N` (s2) or `1=1` (legacy); namespace swap rides the same transform. `setSqlGameScope` set at bootstrap.
- The scoping lint is live: `packages/torii/src/queries/sql/game-scope-lint.test.ts` derives the per-game table set
  from the manifest and fails any unmarked reference. `-- legacy-only` comments opt out queries that never run on s2.
- Arm splits: battle logs (raid arm s1-only), hyperstructure leaderboard config (S2 variant joins
  GameRegistry+PresetConfig+WorldConfig), fetchSeasonEnded → null on s2. `buildUnscopedApiUrl` protects cross-world
  reads (market ranks, faith leaderboard) from the active-game rewrite.
- Deferred to P5 (by design): blitz-settlement/entry-flow SQL still runs the world-address `withWorldScope` fork
  machinery — P5 replaces it with explicit game-id predicates from GameRegistry (registration targets a chosen game,
  not the ambient scope); game-review-service needs per-game parameterization for reviewing non-active games.
