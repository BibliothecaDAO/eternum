# Realms game client — play only, and fast

Brief for the game-client pass on `apps/game`. Two halves: the **deletions** the L2/L3 split hands the client (the web
app takes the lobby and every L2 action — `realms-webapp-brief.md`), and the **performance classes** measured during the
A.3/A.4 gates (`realms-phase-2-brief.md`, A.3 findings). The client's job after this brief: open `/play?game=<id>`,
resolve the gameplay account from the identity session, connect to herald, render, and submit L3 transactions. Nothing
else.

Rules: the repo `AGENTS.md` and `apps/game/AGENTS.md`; client guardrails (RECS is the one truth; Herald's overlay is the
only shared provisional state; player events apply atomically; no silent defaults; wired or deleted). Every performance
change cites the measurement that motivated it and re-measures after.

## Half one — deletions (after the web app takes the lobby)

- `src/ui/features/landing/**` (the entry modal, worlds summary, game selector, play view),
  `src/runtime/world/world-directory.ts` consumers that choose a game (the directory read stays only to resolve the
  `game` query into a world profile), spectator entry UI (spectate is a URL: `/play?game=<id>&spectate=1`,
  `utils/spectator-session.ts` stays the one source).
- Every L2 signer path: wallet connectors in the client, `VITE_PUBLIC_IDENTITY_RPC_URL` reads, cosmetics registration
  calldata (`services/blitz/blitz-settlement-calls.ts` cosmetic ids), `hooks/registration-cosmetic-token-ids.ts`.
- `src/ui/features/cosmetics/**` UI (gallery, showcase, chest-opening store, dev preview), `services/amm/**`, the
  prediction-market stubs (`MenuEnum.predictionMarket`, `View.PredictionMarket`, the retired buttons and comments),
  `VITE_PUBLIC_MARKETPLACE_URL`, `accountName` in the account store and the `Player-` fallback
  (`services/identity/player-name.ts`: the name comes from the identity session).
- Whatever knip reports unused after the above. The three.js cosmetics render path (`three/cosmetics/**`) stays — it
  reads the RECS row.

Gate: `pnpm knip` clean; no `starknet` wallet connector in `apps/game`; the client builds with no L2 URL in its env; a
game plays from `/play?game=<id>` with the name from the session.

## Half two — the measured classes (quiet box, 2026-08-29)

| Measurement                          | Value                 | Bar       |
| ------------------------------------ | --------------------- | --------- |
| boot → bootstrap done                | 1.7 s                 | 1 s       |
| boot → first terrain                 | 5.2 s                 | 2 s       |
| WebGPU probe on a fresh profile      | 15 s timeout          | ≤ 1 s     |
| `createRenderPipeline` on first load | 91 calls / 10.8 s     | ≤ 2 s     |
| explore click → rendered, p50 / p95  | 267 / 302 ms          | p95 250   |
| fog reveal after explore             | late; 0.9 s animation | immediate |
| fog on provision / army creation     | does not clear        | clears    |

Classes and the fix for each (each is one chokepoint, not a set of patches):

1. **Render-pipeline compile on the critical path.** 91 pipelines compiled synchronously before first terrain. Fix: one
   pipeline warm-up list built from the asset manifest, compiled off the critical path (or precompiled per backend), and
   the first-terrain frame drawn with the terrain pipelines only. Evidence: `[FramePerf]` spike sink and the
   `__eternumGameEntryTimeline` `first_terrain` stage.
2. **WebGPU probe.** A 15 s timeout on a probe that answers in milliseconds when it answers at all. Fix: probe with a
   bounded budget (≤ 1 s) and remember the answer per profile; WebGL2 is the lane on this hardware
   (`brave-webgpu-wayland-nvidia` note) and must not pay for a WebGPU attempt every boot.
3. **Fog.** Reveal happens only on a live `TileOpt` change inside the retained render area (`worldmap.tsx` ~1253–1261);
   hydration writes `exploredTiles` without invalidating the fog page, so provision and army creation never clear and
   explore clears late. Fix: one fog invalidation chokepoint fed by every explored-tile write (hydration, diff, own
   action), with the reveal animation starting from the diff, not from a later frame.
4. **Explore latency.** p95 302 vs 250: the stages `submit_guard_released` and `rendered` carry the excess
   (`__clientActionLatencyMeasurements`). Fix: the submit guard releases on `pre_confirmed` from herald's overlay, not
   on the receipt; render-on-arrival for one player event applies the diff in the same frame it is received (guardrail
   3: one action, one visible step).
5. **Bootstrap.** 1.7 s to bootstrap on a quiet box with a 1.3 s herald snapshot; the snapshot is already paged and the
   client waits for all pages before rendering. Fix: render from the first page that contains the player's own
   structures and stream the rest.

Gate: on the quiet lab box, from a fresh profile: first terrain ≤ 2 s, explore p95 ≤ 250 ms across 20 explores, fog
clears in the frame after provision / army creation / explore; the harness explore bar unchanged; every number recorded
in the brief next to the old one.

## Order

Half two, classes 3 and 4 first (they are gameplay-visible and independent of the web app), then 1, 2, 5; half one when
the web app's lobby gate passes. Owner runs the human gate on the quiet box. Codex or a third agent, the owner's call on
capacity; Claude reviews.

## Half three — 96 players: the client as layers (audit 2026-09-01)

Evidence: the deployed build (`madara-lab-99ada3d5b74`, `eternum-game.pages.dev`) spectating game 11 (`lab-mthy45g3`,
96/96 players, 288 realms) from a headless WebGL2 browser: snapshot receive 910 ms + apply 373 ms, bootstrap done at 3.8
s, first terrain at 12.7 s, 82 `[FramePerf]` spikes in 16 s (worst 6.7 s) every one `frame_owner=unattributed`. Plus
four read-only code audits (sync, render, React, measurement) and the chain-side 96-bot runs
(`deploy/madara-lab/.lab/runs`, 3,840/3,840 actions, pre-confirmed p95 ≤ 105 ms). No client number at 24 or 96
concurrent players existed before this; every earlier client figure was taken with ≤ 8 bots.

The client is six layers. Each layer below names the class that makes update count turn into CPU, the one fix, what the
fix deletes, and the gate. Layers are ordered by the data path; the order of work is at the end.

### L0 — Herald stream (client-facing edge of the server)

- Class: per-block write amplification. `apps/herald/src/live-world.ts:242-244` sends the confirmed diff, an
  `overlay_reset`, then re-publishes every pre-confirmed transaction as a fresh diff; a row touched by one action
  reaches the client 3–4× per block. `game-stream.ts:132-134,181-183` re-`JSON.stringify`s the same message once per
  subscriber (96×).
- Fix: `rebuildOverlay` publishes the delta against the previous overlay; `publish` stringifies once and fans out the
  string.
- Gate: rows received per confirmed head / rows changed on chain ≤ 1.1 (recorded with `pnpm lab:probe-herald`).

### L1 — Transport (`packages/core/src/sync/herald-game-sync-transport.ts`)

- Class: unchanged rows re-emitted. `acceptSet` with `preconfirmed:false` never clears `pendingRows` (`:311-315`), so
  `resetOverlay` (`:332-335`) re-emits every already-confirmed row, one `onEntity` each. `reconcileSnapshot`
  (`:358-364`) re-emits the whole world through single `onEntity` calls on any reconnect where resume fails (reconnect
  cadence 200 ms, `:80`). Per row: `Array.find` over the 49-model manifest (`model-manifest.ts:137`); per snapshot chunk
  a full `TextEncoder.encode` only to count bytes (`:200`).
- Fix: clear the pending identity on confirm; reset emits only where `currentRows` ≠ `confirmedRows`; reconcile goes
  through `onEntityBatch` diffed against `currentRows`; a manifest `Map` at module scope; byte count from
  `serialized.length`.
- Gate: rows applied to RECS / rows received = 1.0 at steady state (the `GameSyncRuntimeMetrics` counter, see M).

### L2 — Ingest (`entity-ingest-queue.ts`, `apps/game/src/dojo/recs-game-sync-store.ts`)

- Class: a layer that exists only to be undone. Every row is wrapped into Torii's typed-value envelope
  (`recs-game-sync-store.ts:99-173`) so `@dojoengine/state.setEntities` can unwrap it, which then resolves the component
  by string-building `${ns}-${name}` across all 113 components per row and `await`s once per entity.
  `takeNextApplyBatch` spreads the whole pending Map to slice 1,000 (`entity-ingest-queue.ts:285`, quadratic on the
  snapshot). `onLiveUpdate` fires per entity and writes the connection store twice per row
  (`apps/game/src/sync/game-sync.ts:45-49`).
- Fix: delete `setEntities`. One `heraldValue → ComponentValue` coercer per component schema (memoised per
  `(component, fieldPath)`, using the `authoritativeComponentLookup` Map that already exists), one `setComponent` per
  row. Slice by iterating the Map with a counter. Liveness per batch, throttled ≥ 250 ms. `MAX_APPLY_SLICE_MS` 25 → 6
  (one frame budget, same number as the scene's queue).
- Deletes: the envelope encoder, the `@dojoengine/state` dependency on the live path, the per-entity promise chain.
- Gate: ingest of the 96-player snapshot ≤ 150 ms apply; no sync-owned long task ≥ 50 ms during a 96-bot workload.

### L3 — RECS observers

- Class: `Has(hot)` as a global re-render bus. 34 `useEntityQuery([Has(X)])` sites and 40 `useComponentValue` sites each
  subscribe to every row of the component; `@dojoengine/react` returns a fresh array per row. The store managers then
  re-scan the component (`ui/store-managers.tsx:294` Resource → `getResourceBalances` per row; `:596` ExplorerTroops →
  `formatArmies` over all armies; `:49`/`:275` ResourceArrival twice). `DevSyncOverlay` is mounted in production
  (`ui/layouts/world.tsx:57`) and renders once per ingested row. `Social` and `Settings` run their world-wide queries
  before their `if (!isOpen) return null`.
- Fix: one RECS → store bridge that runs at most once per ingest slice (it is the same chokepoint as L2's flush) and
  publishes narrowed slices (my structures, my armies, selected entity, leaderboard). Components subscribe to slices.
  `useEntityQuery([Has(hot)])` is banned by a source test for aggregate derivation, the way
  `polling-discipline.source.test.ts` bans intervals.
- Deletes: the nine store managers become one bridge; `DevSyncOverlay` mounts only under `DEV_MODE_ENABLED`.
- Gate: React commits per second ≤ 10 with 96 bots active and no selection change (React Profiler sample in M).

### L4 — Spatial projection (`world-spatial-projection.ts`)

- Class: per-row publish. `applyTileOptUpdate` → `publishChanges` once per row (`:516`, `:643`); the S3 brief's
  "coalesce to once per scheduler tick" was never built. Downstream, every army batch re-resolves hover
  (`worldmap.tsx:1243,1332`) and every structure batch triggers a full visible-structure pass.
- Fix: accumulate and flush once per ingest slice. This is the item the S3 brief already specifies.
- Gate: projection listener invocations per slice = 1.

### L5 — Scene (`apps/game/src/three`)

Ranked by cost at 96 players; each is one chokepoint.

1. Terrain composite. `applyTerrainPresentationComposite` (`worldmap.tsx:5582`) maps every composite cell (24×24×12 =
   6,912) with `hexKey.split(",")` per cell, then `present()` rebuilds all prop pools and the fog mask for the whole
   window (`procedural-terrain.ts:287,292`, `terrain-prop-pools.ts:49`) — on every explored tile inside the window,
   outside the frame budget. Fix: incremental composite (mutate presentations, compose once per batch — plan item 1.5),
   numeric cell keys, per-page delta writes into fixed pool sub-ranges, commit in the `critical` lane so it is measured.
   PR #4905 (living roads) re-presents on structure changes too, so this is now the first item, not a follow-up.
2. Structure pass. Any structure change re-runs `resolveStructureInfo` (3 RECS reads + BigInt unpack) for every visible
   structure (`structure-manager.ts:321→1199,393`). Fix: cache `StructureInfo` per entity, invalidated by the component
   subscriptions that already exist; drive the pass from the change set.
3. Hover from data. `resolveHoverLabelEntities` materialises all armies and raycasts every instanced mesh
   (`worldmap.tsx:2191,2218,2232`, `army-model.ts:2532`) on every army/structure batch. Fix: position-indexed lookup,
   lazy raycast, reconcile only when the hovered hex's entities changed (plan item 3.4).
4. Procedural actors uncapped (`procedural-army-representation.ts:13-15`). Fix: a hard actor budget by screen size,
   instanced fallback beyond it (the handoff exists).
5. `updateAllInstances` dirties every buffer for a one-army change (`army-model.ts:2406`). Fix: `addUpdateRange` per
   slot, as `PathRenderer` does.
6. One draw call per compact label (`compact-entity-label-renderer.ts:39`). Fix: the label atlas (plan item 6.1).
7. `STRUCTURE_INSTANCE_CAPACITY = 512` throws on overflow (`structure-manager.ts:1456`). Fix: size from the window
   maximum, loud clamp like `army-model.ts:522`.
8. CSS2D renders every frame at close view (`game-renderer-policy.ts:243`); `ReservedHyperstructureManager` re-renders
   all reserved hexes on any structure change. Fix: floor at 16 ms and render on change; consume the change set.

Gate: on the owner's laptop (WebGL2 lane) spectating a live 96-bot game: steady p95 frame ≤ 16.7 ms, zero frames ≥ 50 ms
outside chunk switches, terrain draws ≤ 40, `frameBudgetLongTasks` = 0 over 60 s.

### L6 — React overlay

- Class: one store, 269 selectors, 1 Hz object churn. `useUIStore` merges six slices (`use-ui-store.ts:262`); every
  `set()` (tooltip on hover, `setCycleProgress` at 1 Hz) runs all 269 selectors. `BlockTimestampPoller` publishes a new
  object every second so every consumer re-renders (`block-timestamp-poller.tsx:11`); ~36 files own a 1 Hz
  `setInterval`. `top-header.tsx:50` calls `getBlockTimestamp()` on every render.
- Fix: the Command Deck (half four) replaces the mount tree, so this is done as part of it, not patched: one clock store
  with primitive fields, tooltip/hover in their own store, selectors per field, the six windows mounted only when open.
- Gate: React commits per second ≤ 10 idle (same measurement as L3).

### M — measure first (prerequisite, one day)

1. Expose `GameSyncRuntimeMetrics` (`onMetrics` is plumbed but never wired, `game-sync.ts:61-72`) and
   `getWorldmapRenderDiagnostics()` (DEV-only today, `worldmap.tsx:7621`) under `?dev` in deployed builds, as
   `window.__eternumSyncMetrics` / `__eternumRenderDiagnostics`.
2. Frame owner attribution: `unattributed` on every spike means the terrain composite, hover reconcile and label DOM run
   outside `runWithFrameWorkOwner`. Wrap them so a spike names its owner.
3. The number this brief lacks: a client attached to a live 96-bot game (`pnpm lab:harness -- --bots 96 --minutes 25` on
   the box, owner's laptop spectating with `?dev`, `Ctrl+Shift+R` for 60 s). Record rows/s received, rows/s applied,
   React commits/s, p95 frame, long tasks, heap slope — before and after each layer. Those columns go into the table in
   half two.

Recorded, phase M (2026-09-01, branch `client-scale-96p`): dev server, headless Brave 1600×900 on software WebGL2,
spectating game 11 (`lab-mthy45g3`, 96/96, finished, so live churn is 0). "Before" is the branch with only the
settlement-level fix: before that fix the branch could not set up the worldmap scene against any real game, because
`Structure.base.level` is the 0-based `RealmLevels` enum (every fresh realm is 0) and PR #4905's settlement footprint
threw on 0. Items 1 and 2 landed; item 3 still needs a live 96-bot game from the owner.

| Measurement (game 11, spectate, software WebGL2)     | Before (settlement fix only)                    | After phase M                                    |
| ---------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------ |
| snapshot receive / apply                             | 905 / 162 ms                                    | 878 / 154 ms                                     |
| snapshot rows, batches, max batch apply              | not exposed                                     | 7,217 rows, 3 batches, 91 ms                     |
| bootstrap done / terrain visible / world interactive | 6.0 / 16.2 / 16.3 s                             | 5.0 / 15.1 / 15.1 s                              |
| `frameBudgetLongTasks` at boot, then over 60 s       | 3 (max 48 ms), +0                               | 3 (max 47 ms), +0                                |
| steady-state spike digests over 60 s (~0.8 fps here) | ~10 / 10 s, worst 1.3–1.6 s, all `unattributed` | ~9 / 10 s, worst 1.3–1.5 s, all `render:backend` |
| heap over the 60 s window                            | 371 → 373 MB                                    | 376 → 378 MB                                     |
| live rows received / component writes applied        | not exposed                                     | 0 / 0 (finished game)                            |

What is exposed: `window.__eternumSyncMetrics` (the runtime's counters, now with `totalLiveEntityOperationsApplied` so
the L1 ratio is `totalLiveEntityOperationsApplied / totalLiveEntityUpdates`) and the existing
`getWorldmapRenderDiagnostics()` family, both gated on `DEV_MODE_ENABLED` (`?dev`) instead of `import.meta.env.DEV`, so
deployed builds have them. One accessor keeps its one name: `__eternumRenderDiagnostics` was not added as a second
alias. Owners added: `terrain:composite` (cell mapping + anchors + page requests), `terrain:present` (the main-thread
pool/fog commit after the worker), `hover:reconcile`, `labels:css2d`, and `render:backend`. The last one is not in the
list above: on software GL every frame _is_ the render pass, so without it no headless measurement could name any owner;
on a GPU the render is a few ms and CPU owners dominate the same digest. Still unattributed and left for the half-two
boot classes: the pre-scene boot window (module load and the first React mount, worst ~0.8 s in one 10 s window) runs
outside any scene owner.

Reviewed 2026-09-01 (Claude, independent reproduction on the same setup): gating verified both ways (`?dev=0` → both
globals absent, `?dev=1` → present); snapshot 7,217 rows / 3 batches / max batch 102 ms, receive 903 / apply 219 ms;
`frameBudgetLongTasks` 3 at boot, +0 over 65 s; heap flat (GC'd 406 → 323 MB); 93 spike digests: 91 `render:backend`
(`attribution=cpu-bound`, `gpu_backend_ms` ~1.7), 2 unattributed in the pre-scene boot window as stated. Terrain tests
(144), core sync tests (57) and the apps/game typecheck reproduce clean. **Phase M approved.** Review notes carried
forward: `requireSettlementLevel` silently clamps values above `RealmLevels.Empire` — fine today (only a future contract
change can produce one), add a loud dev warn if that ever changes; the deployed-build reachability was proven via the
runtime flag on the dev server — sanity-check `?dev` once on the next real deploy; M.3's live ratio stays owed to Phase
1's measurement game.

Recorded, phase 1 (2026-09-01, branch `client-scale-96p`; L0 + L1 + L2 + the submit guard). Same setup as phase M (dev
server, headless Brave on software WebGL2, spectating game 11, finished, so live churn is 0), and the box still runs the
pre-phase herald, which is the compatibility case the client must handle. "Before" is phase M's after.

| Measurement (game 11, spectate, software WebGL2) | Before (phase M)                   | After phase 1                                                                               |
| ------------------------------------------------ | ---------------------------------- | ------------------------------------------------------------------------------------------- |
| snapshot receive / apply (7,217 rows)            | 878 / 154 ms (reviewer: 903 / 219) | 749 / 148 ms                                                                                |
| store writes for the snapshot, max batch apply   | 3, 91 ms (reviewer 102)            | 5, 44 ms                                                                                    |
| sync-owned spike digests over 150 s              | 0 of 187                           | 0 of 311 (`render:backend` 310, terrain 1)                                                  |
| `frameBudgetLongTasks` at boot, then over 60 s   | 3 (max 47 ms), +0                  | 3 (max 54 ms, terrain commit), +0                                                           |
| heap after boot, then over 60 s                  | 376 → 378 MB                       | 309 → 310 MB                                                                                |
| live rows received / component writes applied    | 0 / 0 (finished game)              | 1,329 / 1,329 = 1.00 on game 15 after herald A+B (0.28–0.36 on game 14) — passes            |
| calls_built → sign_send_started p95              | not measured                       | 4.7 ms over 6 explores with a bot key; enqueue → sign+send 1.3–3.5 ms after the first burst |
| herald rows received per head / rows changed     | not measured                       | 1.34 on game 15 after herald A+B, 299 heads (8.35 on game 14) — passes                      |

Live gates (2026-09-02, game 14 `lab-mtjo7c6z`, 95 bots acting, herald redeployed from the branch at `73d44929dfe`,
spectating from the dev server on headless software WebGL2). **applied/received fails**: 1,152 rows received against 326
component writes in 60 s of provisioning churn (0.28) and 384 against 138 in the steady workload (0.36). The 10-minute
wire probe explains it: of 132,776 rows on the wire over 279 heads, 96,490 (73 %) repeat a row already in the same diff
— herald publishes one `set` per member event, so a transaction touching ten members of one `Resource` row ships that
row ten times — and the pre-confirmed/confirmed double delivery adds 20,394 distinct rows (1.28× the 15,892 distinct
rows the blocks changed). The transport delivers every intermediate value (each differs from the held one) and the
ingest queue merges them per entity and model before the store; that merge is the whole gap between received and
applied. The M-era republish after `overlay_reset` is gone: 811 rebuild and revert rows over 279 heads (2.9 per head).
**Wire ratio fails** at 8.35 against the ≤ 1.1 bar. The fix for both sits at the herald's publish chokepoint: collapse
each published diff to one change per (model, key), last write wins; then drop confirmed rows equal to the held overlay
row — the second step only once the client that keeps rows across resets is deployed, because an old client's eager
revert would otherwise leave a wrong fact. **The no-sync-long-task hold passes**: over 60 s of churn the ingest owns at
most 7 ms of any spike frame (`owner_ms`, added to the `[FramePerf]` line for this), and `frameBudgetLongTasks` moved +0
idle, +4 in the steady workload and +153 during the provisioning burst, the last while the scene was still booting under
655 rows/s; the lifetime `maxBatchApplyDurationMs` of 52 ms is the boot snapshot's 1,000-row write, so the metrics now
also carry `maxLiveBatchApplyDurationMs`. **The submit guard passes** without a human login:
`deploy/madara-lab/scripts/probe-submit-guard.ts` (`pnpm lab:probe-submit-guard <gameId>`) joins a game with a fresh
gameplay account through the harness setup path and drives the client's own `configureGameplayAccountSubmits` and
`EternumProvider` queue — three bursts of five actions (two explores on different armies, three produces) on game 13,
because game 14's last slot went to the first attempt: calls_built → sign_send_started p50 1.8 / p95 4.7 ms over the six
explores; enqueue → sign+send 1.3–3.5 ms for every action after the first burst and 100–112 ms in the first burst only
(the one shared pre-confirmed nonce read of a fresh account, which sits after that seam); nonces 6 → 21 for 15 actions,
all 15 `PRE_CONFIRMED`, no stranded hash (12 reverted on game rules, expected for an unprepared bot). The human
in-browser pass is deferred, not waived. Phase 2 baseline, React commits per second (a devtools-hook stub counting
`onCommitFiberRoot`, installed before the page loads): 2.0 spectating at low churn, 19.7 spectating under the full
95-bot workload with no selection change.

Ruling (reviewer, 2026-09-02): the two failures stand and the diagnosis is verified at code level (`world-fold.apply`
emits one full-row `FoldChange` per member event, so a ten-member write ships the row ten times). The herald fix is
approved as **two separately deployable steps**. **Step A — intra-diff collapse**: at the publish chokepoint, collapse
every outgoing diff (confirmed broadcast and overlay delta alike, before the ledger compare) to one change per (model,
key), last write wins. Client-agnostic — any client sees the same final values, once; deploys freely. **Step B —
suppress confirmed rows whose value equals the held overlay row**: kills the pre+confirmed double delivery. Deploy-order
sensitive the OTHER way round from phase 1: a pre-phase-1 client self-reverts at `overlay_reset` into a `confirmedRows`
map that never received the suppressed value, and the ledger will not re-send — a wrong fact until the row next changes
on chain. Step B therefore lands as its own commit and reaches the box only after every client we serve is ≥ phase 1
(concretely: after `eternum-game.pages.dev` is redeployed from this branch — owner/reviewer step, which also ships the
phase-1 client). No runtime flag; two commits and deploy order do it. Design note: step B supersedes `forgetConfirmed` —
the ledger keeps holding the value across confirm; the invariant to test is that for every (model, key) the published
sequence converges any subscriber, old or ≥ phase 1, to the chain's current value within one head. Re-measure bars after
A+B: wire rows per distinct changed row ≤ 1.5, applied/received ≥ 0.9. The herald fix and its re-measure come BEFORE any
Phase 2 code; Phase 2's design stays approved as amended, and its baseline (2.0 → 19.7 React commits/s under churn) is
exactly the L3 class it must close. Also noted for L5: the +153 long tasks during the provisioning burst are chunk-owned
boot work under 655 rows/s — item-1 territory, not sync.

Herald fix reviewed and deployed (reviewer, 2026-09-02): step A `bb9d184e3dd` (collapseChanges per (model, key), last
write wins, applied to confirmed broadcasts and overlay transactions before the ledger compare) and step B `d04a5d75e38`
(`settleConfirmed` keeps a confirmed row off the wire when subscribers hold its value; a pending write equal to the
confirmed row stays out of the ledger; `settleReverts` skips reverts equal to confirmed) — semantics traced through the
pending↔confirmed cases, late-subscriber snapshot parity and resume-from-ring; one harmless imperfection (a pending
write equal to old-confirmed followed by its own confirmation publishes one redundant row, which the client transport
dedupes). Herald suite 48/49, the failure being the pre-existing model-registry drift. Deployed in the ruled order:
client to `eternum-game.pages.dev` from the branch tip (workflow run 33599560955, green 06:42Z), then box herald pulled
to `d04a5d75e38` and restarted (healthy, block 60,561). Re-measure game: 15, `lab-mtjqbqr5`, 95 bots, 25-minute
workload, one open slot. Bars: wire ≤ 1.5, applied/received ≥ 0.9.

Phase 2 review (reviewer, 2026-09-02): L4 `3ee28acfaf9` and L3 `9b1a1fb7ef8` audited and reproduced. The runtime's slice
hook fires projection flush before slice listeners as specified; the bridge marks slices dirty from seventeen `update$`
sources and derives once per slice into `useWorldSlicesStore` (plus one `useUIStore` write); the `recs-query-discipline`
source test enforces the ban with an EMPTY allowlist — stronger than required; seven managers deleted (net −1,097
tracked production lines). Independent idle reproduction: 1.98 React commits/s spectating game 15 (their 2.07), no
bridge console errors. The three suspicious "pre-existing" failures were verified at the phase-2 parent in a detached
worktree — all fail there too; the polling-discipline one was a stale allowlist entry for
`factory-v2-watch-workspace.tsx` (its interval left in upstream drift) and is pruned in this commit, making that test
green again. **Approved pending the churn gate.** Findings carried to the gate hand-back: (1) the bridge (306 lines)
ships without its own unit test — add a small install/derive/dispose test with a fake runtime before the gate closes;
(2) the bridge's `useUIStore.subscribe` handler flushes pending dirty slices on ANY store write in the mark-to-slice
window, not only selection/relic changes — harmless (idempotent, self-clearing) but measure whether it shows up as extra
flushes under churn; (3) flush cadence is once per applied slice, which under heavy churn approaches frame rate — if the
churn gate fails, the lever is a per-slice minimum interval, not consumer patches. Re-measure game for the churn gate:
16 (`lab-mtjsp8bk`, 95 bots, 25 minutes).

Re-measured after herald steps A and B (2026-09-02, game 15 `lab-mtjqbqr5`, 95 bots, box herald `d04a5d75e38`, pages.dev
client on the branch tip; spectating from the dev server on headless software WebGL2). **Wire ratio passes**: 18,740
rows on the wire over 299 heads for 14,009 distinct rows changed, 1.34 against the ≤ 1.5 bar (8.35 before). Intra-diff
repeats are gone (0, from 73 %), the confirmed diff carried 28 rows in ten minutes (80,348 in the previous probe), and
rebuild plus reverts stayed at 308 rows, 1.03 per head. The remaining quarter, 4,731 rows, is the same row written again
by a later transaction inside the same head: successive chain changes, each a real delivery. **applied/received
passes**: 1,329 rows received and 1,329 entity writes applied over 60 s at ~22 rows/s with ~7.5 events/s alongside, 1.00
against the ≥ 0.9 bar, with the applied counter now counting entity writes only — event applies were inflating it (the
first run read 1,538 applied for 1,463 received). **The no-sync-long-task hold still passes on the new wire shape**: in
the steady run with the scene up the largest live slice was 31 ms, `frameBudgetLongTasks` moved +0 and React committed
2.8 times per second; the `sync:ingest` spike lines showed `owner_ms` up to 622 ms, which is some fifteen sub-50 ms
slices accumulated inside one 1.7 s software-GL frame, so the spike line now also prints `owner_max_ms`, the owner's
longest single call. A second run booted under the full workload and never got the scene up within 160 s (React 20.7
commits/s, +156 chunk-owned long tasks, the phase 2 class again); its 66 ms slice was the replay of the boot backlog, so
`maxLiveBatchApplyDurationMs` now counts running-status slices only.

What changed, by layer. L0 (`apps/herald`): `rebuildOverlay` publishes only rows whose value differs from what
subscribers hold (an `OverlayLedger` at the one pre-confirmed publish chokepoint; a confirmed diff forgets its row so a
rebuilt row the head moved is still published) and publishes explicit reverts for overlay rows the rebuilt block no
longer carries (`set` to the confirmed row, `del` when confirmed has none); `publish` stringifies once and the ring
keeps the string; `DiffLatencyMonitor` logs `herald_diff_slow` over 200 ms and a per-kind digest per minute. Same
message shapes, epoch/seq and resume; `overlay_reset` is still published at every head. L1 (transport): one
`currentRows` map; a `set` whose value equals the held row is not delivered, a delete always is; `overlay_reset` carries
no rows (herald reverts explicitly), so the client never reverts on its own — `confirmedRows`, `pendingRows` and
`resetOverlay` are gone; a fresh snapshot after a failed resume reconciles into one `onEntityBatch` of changed rows;
manifest lookup is a `Map`; bytes come from `serialized.length`. Deploy order (review ruling, 2026-09-02): **herald
first, client second** — the reverse of the implementation's initial claim. Old client + new herald only degrades
freshness: it reverts pending rows at reset and shows the confirmed value until the row's next diff (≤ one block,
self-healing, never a wrong fact). New client + old herald is the dangerous combo: the old herald never publishes
explicit reverts and the new client rightly never invents one, so a dropped/reverted pre-confirmed transaction (tile
contention exists in every harness run) leaves a wrong game fact in RECS indefinitely. The box herald must therefore be
redeployed BEFORE any live game is played or measured against this client. L2 (ingest): the Torii typed-value envelope,
`@dojoengine/state`'s `setEntities` (and the dependency) and the per-entity promise chain are deleted; one coercer
compiled per component schema writes each row with `setComponent`/`updateComponent`;
`recs-game-sync-store.parity.test.ts` feeds 50 real game-11 rows across 20 models plus partial updates and matches the
legacy output verbatim (`recs-game-sync-store.parity.json`), except that NumberArray members
(`Structure.troop_explorers`, `BlitzSettlement.structure_ids`) were reaching RECS as raw envelope objects under the
legacy path and now arrive as numbers; the ingest slice iterates the pending map in place (O(batch));
`MAX_APPLY_SLICE_MS` 25 → 6 (a store write stays capped at 1,000 rows, which is why the snapshot lands in 5 writes
rather than 25 frames — live batches are far below the cap, so the 6 ms slice governs them); liveness is one callback
per batch, the connection store is written at most every 250 ms; `DevSyncOverlay` mounts only under `DEV_MODE_ENABLED`;
the dead `logging` flag went with `setEntities`. Submit guard: nonces are dispensed locally per account (one shared
pre-confirmed read per burst, FIFO), sign+send fires without waiting on any other action, a failed send resyncs and a
nonce rejection retries once; the provider's promise queue drains synchronously and fires batches without awaiting the
previous one (batching rules unchanged); explores of the same explorer still serialise by design until the ghost makes
the next click relative to the pending position. Unit evidence: a 20-action burst is fully in flight from one nonce
read; 10 actions are signed in the same macrotask while sends take 150 ms.

Reviewed 2026-09-02 (Claude, independent reproduction): game-11 table reproduced — snapshot receive/apply 783/166 ms,
7,217 rows in 4 store writes, max batch apply 48 ms (halved from phase M's 91–102 ms), `frameBudgetLongTasks` 3 at boot
and +0 over 65 s, heap flat, zero `[GameSync]` coercion warnings across the full real snapshot, 77/78 spike digests
attributed. Tests reproduced with the real runners: herald vitest 44/45 (the one failure, `model-registry.test.ts`
expecting 45 persistent models and finding 43, is PRE-EXISTING on `client-scale-audit` — verified by restoring the base
`model-manifest.ts` — and belongs to the branch's own manifest/registry drift, same class as `worldmap-initial-refresh`;
flag to the branch owner); core sync 58/58, provider 80/80 (pipelining + explorer serialization + one-tick multicall
merge all asserted), game sync + parity + account 25/25; typecheck clean; `@dojoengine/state` gone from apps/game deps.
Diff audit: the transport deletion is real (three structures → one `currentRows`, no client-side revert),
`OverlayLedger` handles the repeat-value-after-confirm subtlety and late subscribers correctly, the per-explorer
explore/VRF lock stays with its why-comment, and the NumberArray deviation is inert (no non-test RECS consumer of
`troop_explorers`; `structure_ids` is read from herald HTTP, not RECS) and strictly better than the envelope objects
legacy wrote. **Phase 1 approved**, with the deploy-order ruling above replacing the commit's claim. Watch item for the
live gate: a lost middle nonce in a pipelined burst can strand later transactions in the mempool until the gap refills —
the harness's failure classes will show it if it happens. Owed to the live game (after the herald redeploy):
applied/received = 1.0 under churn, no-sync-long-task hold, submit-guard p95, and the wire ratio via `lab:probe-herald`.

Recorded, phase 2 (2026-09-02, branch `client-scale-96p`; L3 + L4). Before: 19.7 React commits/s spectating game 14
under the full 95-bot workload and 2.0 at low churn (phase 1's measurement, a devtools-hook stub counting
`onCommitFiberRoot`, installed before the page loads). After, on this session's tree: 2.07 commits/s spectating game 15
idle after its workload ended, scene up, no bridge errors; **the ≤ 10 commits/s under churn gate is owed to the next
live game** — no bot workload was running when the code landed. L3: one RECS → store bridge
(`apps/game/src/sync/recs-store-bridge.ts`) subscribes to the hot components only to mark slices dirty and derives the
dirty slices once per ingest slice from the runtime's new `subscribeSliceApplied` hook, writing each store once: the
existing `playerStructures`, `selectableArmies`, `playerRelics`, arrivals summary, `gameWinner`, clock gates and
`disableButtons` into `useUIStore`, and the new slices (`players`, `guilds`, `structures`, `buildings`,
`hyperstructures`, `blitzSettlementPlayers`, `resourceArrivals`, faith read models, `seasonEnded`) plus three revision
counters (`leaderboardRevision`, `resourcesRevision`, `armiesRevision`) into a dedicated `useWorldSlicesStore`, so the
bridge's write never runs `useUIStore`'s selectors. Consumers that keep their own RECS reads (in-game leaderboard, prize
panel, winners table, register-points button, resource table, exploration dashboard) memoise on the revision and say so
at the memo. Seven store managers died (player structures, selectable armies, relics, public troop arrivals, season
winner, season timer, button state); the arrival auto-claim and auto-register-points runners stay in
`apps/game/src/ui/action-runners.tsx` reading slices. Every `useEntityQuery` without a `HasValue` is gone from
`apps/game` and `packages/react` (`usePlayers`, `useGuilds`, `useHyperstructures` deleted from the shared package;
`useBlitzSettlementPlayerAddresses` deleted), and `recs-query-discipline.source.test.ts` bans new ones with a named,
reasoned allowlist that is empty today. Social and Settings mount their query-bearing bodies only while open. L4: the
spatial projection keeps its indexes current per row but publishes once per ingest slice through `flush()`, merging
first-previous with last-current per key and dropping rows that end the slice where they started; the runtime calls it
before the bridge's listeners so a slice's scene work and store work each happen once. Net: 25 production files
+352/−1,097 plus 762 lines in six new files (bridge 306, runners 323 carried over from the managers, store 56, readers
26, hyperstructure infos 36, mount 15); tests +188/−49 and a 64-line source test.

Phase 2 churn gate (2026-09-02, game 16 `lab-mtjsp8bk`, 95 bots, spectating from the dev server on headless software
WebGL2 with the scene up, 60 s inside the steady workload at ~24 rows/s and ~8 events/s): **React 3.38 commits/s**
against the ≤ 10 bar (19.7 before phase 2); idle on the same tree after the workload ended, 2.31 commits/s with zero
rows, slices or derives — the residual is the 1 Hz clock UI, L6's business. Projection publishes 29 over 38 applied
slices (`projectionPublishCount` now sits next to `appliedBatchCount` in the sync metrics): at most one per slice, and a
slice with no spatial change publishes nothing. Bridge derives 38 for 38 slice triggers and 0 store triggers
(`window.__eternumBridgeMetrics` under `?dev`); the review's finding that the bridge flushed on any `useUIStore` write
while dirty is closed at the source — its store subscription now derives only for a selection or relic-refresh change.
Applied/received 1,420 / 1,420, `frameBudgetLongTasks` +0, live max slice 34 ms, so the phase 1 holds survive the new
tree. `recs-store-bridge.test.ts` installs the bridge with a fake runtime and real components, writes real parity rows
through the store, and pins one derive at install, one per applied slice however many rows changed, derives only for
selection or relic changes among store writes, and nothing after dispose.

Phase 2 closed (reviewer, 2026-09-02): gate record audited, the store-write flush fix is at the source (early return
unless selection or relic-refresh changed, with `__eternumBridgeMetrics` counting triggers under `?dev`), the L4 gate
gained a permanent counter (`projectionPublishCount` beside `appliedBatchCount`), and the owed bridge unit test landed.
Reviewer reproduction: bridge + discipline tests 10/10, core sync 64/64, apps/game typecheck clean; the churn window
itself was accepted on the recorded methodology (game 16's workload had ended), consistent with the idle number the
reviewer measured independently last round. 19.7 → 3.38 commits/s under churn closes the L3 class. Next per the order:
L5 items 0–3 + continuous zoom, far-LOD first. The parked biome-material polish (owner's separate track) must not ride
along — it lands after L5 to avoid worldmap collisions.

Recorded, L5 items 0–3 + continuous zoom (2026-09-02, branch `client-scale-96p`, one commit). Item 0: one whole-world
biome surface (`apps/game/src/three/terrain/world-biome-surface.ts`) — an instanced flat hex per explored tile painted
from the projection's tile index (seeded from `getTiles()` at bind, then one `setTile` per tile change and one
`commit()` per ingest batch, `addUpdateRange` on the touched slot span) plus one shroud plane in the fog's deep colour
that grows with the explored extents; two draw calls, ≤ 65,536 tiles (loud overflow). It replaces the shared navy ground
plane on the worldmap (`shouldCreateGroundMesh` → false; that plane at y = −0.05 hid everything below it). The far band
(> 45) hides the procedural terrain group and shows the surface alone; nearer bands composite the pages over it, so
there is no window edge at any zoom. Continuous zoom: the wheel feeds `continuous_delta` intents to the existing
coordinator, the camera sits on the worldmap's fixed azimuth at the eased distance with a pitch keyframed by distance
(42° at 10 → 52° at 20 → 58° at 45 → 66° at 80, `worldmap-camera-view-profile.ts`), the settled distance persists per
scene (`use-camera-zoom-store` v2, a slider in Settings), the local view's `enableZoom` is always on with its own 52°
pitch; camera far plane and scene fog now follow the distance instead of a 40-unit cap. Deleted: the Close/Medium/Far
presets and their profiles, the stepped wheel controller and anchor solver, the 1/2/3 shortcuts, the "Enable Map Zoom"
setting and every `enableMapZoom` reader (renderer, hexception, store bridge), `changeCameraView` across the base scene,
dev GUI and control bridge, the `resolveCurrentSceneName` pass-through, and the fixed-zoom PTD doc. Bands (`CameraView`)
survive only as content selectors: close < 15, far > 45. Item 1: composite cells carry `col`/`row` and are keyed by
`hexCellKey(col,row)` (`terrain/hex-cell-key.ts`; every `hexKey.split` and the string sets are gone); page applies
mutate the presentation state only and `requestVisualTerrainCompositeCommit()` composes and presents once per batch in
the work queue's critical lane (`terrain:composite`), so an exact chunk's pages, a shell's pages or a burst of live-tile
rebuilds cost one composite; `TerrainPropPools` writes each page into a fixed per-archetype slot (12 slots, capacity
1.5× the measured per-page maximum per archetype, loud overflow) with `addUpdateRange` on the slot's sub-range, and
`TerrainFogField` keeps per-page shroud lists and rewrites only the changed page's mask sub-rect; `present()` diffs
pages by key + fingerprint. The whole-window `update(all)` paths, the never-read `visibleTerrainMembership` (module,
ownership arrays, two tests of a dead write) and the `composeWorldmapVisualTerrainPresentations` alias are deleted. Item
2: `StructureInfo` is cached per entity and invalidated by the projection change set and the existing
`Structure`/`StructureBuildings`/`Hyperstructure`/ `AddressName` subscriptions; the visible pass keeps a
`Map<ID, renderable>` for the current chunk window, applies each change batch to it and commits one diff — a bounds
query only runs on a chunk change (`getVisibleStructuresForChunk` deleted). Item 3: army and structure batches call
`reconcileHoverLabels` only when a change's previous or current hex is the hovered hex; pointer moves keep the raycast.
Net: 55 tracked files +2,015/−1,459 (production +1,198/−1,020, tests +817/−439) plus 338 new production lines in three
files and 487 new test lines; eight files deleted. Honest cost: the prop/fog delta writes grew those three modules by
~380 lines (slot allocator, region writer, delta bookkeeping) and the structure manager by 116; the deletions elsewhere
carry the net.

L5 gate record (2026-09-02, game 16 `lab-mtjsp8bk` after its workload ended: 96 realms, 4,226 explored tiles, 310
visible structures, spectating from the dev server in headless software WebGL2). No terrain edge at any zoom:
screenshots at distance 80 (whole explored world as biome hexes, shroud beyond, structures on top), 36 (pages composited
over the surface, flat hexes visible past the window) and 10.8 (close), captured with the render loop stalled
(`scratchpad/screens/far-lod-d80-noground.jpeg`, `far-lod-medium36.jpeg`, `far-lod-close11.jpeg`; the owner reproduces
with `?dev=1` and `getWorldBiomeSurface()`). Surface: 4,226 instances uploaded in one commit (`worldBiomeSurfaceCommits`
1, `worldBiomeSurfaceInstancesUploaded` 4,226, gauge `worldBiomeSurfaceInstances`), 2 draw calls, 16.9 k triangles.
Draws and triangles from the scene graph (visible meshes × instances, before frustum culling): far band = terrain group
hidden, terrain draws 2 / 0.017 M triangles (bar < 1.5 M passes); close band = terrain group 38 draws + surface 2 = 40
(bar ≤ 40), 18.1 M submitted terrain triangles — the twelve-page composite's whole-window prop pools (15 archetypes,
e.g. broadleaf 1,887 instances, count 2,100 with slot padding), which is the pre-existing window cost, not this phase's;
the ≤ 3 M close bar belongs to the terrain benchmark scenario (see the benchmark line). Continuous zoom: four wheel
notches 80 → 35.95 and six more → 10.83, transitions started/completed 2/2, the settled distance written to the store
once per transition; the ecology/page composite recomposed 5 times across the two zooms (`terrainCompositeRebuilt`).
Structure cache: at boot 1,974 hits / 367 misses over 3 bounds queries; seven minutes later 5,074 hits / 367 misses — no
structure was rebuilt without a row change — and `visibleStructureChangeSetUpdates` stayed 0 because the finished game
sent no batches. Hover: no batch arrived, so the gate is by construction (`reconcileHoverLabelsForProjectionChanges`).
Explored-tile churn: the whole-window paths no longer exist; the counters to watch on a live game are
`getTerrainUploadMetrics()` → `propPoolPageWrites`, `propPoolInstancesUploaded`, `propPoolFullRewrites` (≤ 1, the
catalog arriving late), `propPoolPaddingInstances`, `fogMaskPageWrites`, `fogMaskTexelsWritten`, `fogMaskFullRebuilds`
(flat except on window moves), beside `worldBiomeSurfaceCommits`; **the live churn numbers are owed to the next running
game** (game 16 had ended). At boot with four pages present the counters read `propPoolPageWrites` 4,
`propPoolInstancesUploaded` 725, `propPoolFullRewrites` 0, `fogMaskFullRebuilds` 1, `fogMaskPageWrites` 0 — and
`propPoolPaddingInstances` 11,139: the fixed per-page slots leave zero-scaled gaps inside each pool's drawn prefix, and
those gaps are still vertex-shaded (about 15× the real instances at boot, shrinking as the twelve slots fill). That is
the named cost of the sub-range design; if it shows on the owner's p95, the follow-ups are a tighter slot capacity
(1.25× the measured page maximum) or prop pools as `BatchedMesh` with per-instance visibility so gaps cost nothing.
`frameBudgetLongTasks`: 1 at boot, 3 after the two zooms; **the +0-over-60-s hold is not demonstrable in this lane** —
at close zoom the software rasteriser takes 23 s per frame on the 18 M submitted triangles, the chunk-transition
watchdog (20 s) then forces a recovery refresh every ~115 s, and each recovery re-applies the exact pages (+1 long task
per cycle: 5 at 459 s, 6 at 649 s); on a GPU the same frame is milliseconds. Tests: terrain 36 files / 175 pass (incl.
the new pool-slot, fog sub-rect, surface and cell-key tests), scenes 193/194 (the known `worldmap-initial-refresh`
drift), structure manager 45/45, zoom modules, runtimes, stores and UI 12 files / 50 pass; `apps/game` typecheck clean;
knip adds nothing new (the two `dist` d.ts files pre-date the branch). Owed to the owner's machine: steady p95 ≤ 16.7
ms, the 60 s long-task hold under churn, and `benchmark:terrain:quick` — it drives `/debug/procedural-terrain-benchmark`
through `npx agent-browser` against an https dev server; run here against the session's server on 5174 it spent the
whole 10-minute budget installing and starting the browser and was killed without a result (exit 143), so its
draws/triangle bars are unverified in this lane. The pure terrain suite that the benchmark's evaluator shares its
thresholds with is green.

L5 review (reviewer, 2026-09-02): code, tests and counters all reproduce — 219 terrain/structure tests, typecheck, and
on a live 96-bot game (17, `lab-mtjzah2p`) the upload counters held under real churn: `propPoolFullRewrites` 0,
incremental fog/page writes only, structure-cache hits climbing, zero full-window re-uploads. Zoom deletions verified
(`changeCameraView` 0 references; `CameraView` survives only as the content-band selector). **The code is approved; two
gate cells stay owed** — the GPU p95 bands and a clean max-zoom-out screenshot (the headless shots are behind the
finished-game modal, and the headed session ended in a tab crash before a clean capture). They close with a two-minute
owner-run snippet on the deployed client (redeployed from this tip). What the measurement session found on the way, now
on the books: (1) **background-tab throttling stalls boot** — with `document.hidden` the sync drain runs at ~100 ops/s
against ~140 rows/s arriving, so a hidden tab never finishes booting; foregrounding completed it instantly. Fix class
for the boot phase: a visibility-aware drain (keep the 100 ms timer authoritative when hidden). (2) **First terrain
201.7 s** on the production build over the fully-populated 96-player world (renderer-init 1.0 s) — the half-two boot
classes now have their 96-player headline number; the cost is terrain/model/chunk work, not the renderer. (3) On the
real GPU, spike frames carry small owned shares (`terrain:composite` ≤ 56 ms per slice) with the remainder unattributed
— extending frame-owner coverage to army sync and chunk work is the M follow-up that makes the next profile conclusive.
(4) One renderer tab crash at the end of the session, cause uncaptured — watch for recurrence. Prop-padding ruling: keep
the fixed slots; nothing in the GPU evidence names vertex-bound padding as a cost — revisit only if the owner-run p95
does (evidence before optimization). Phase 4 (Command Deck) may start; the owed cells close in parallel.

L5 owed cells, closed by the owner on the deployed build (2026-09-02 pm, RTX 3070 WebGL2, spectating a 96-player world,
build `50c07ffef…`): **terrain-edge gate PASSES** — the whole explored world is visible at maximum zoom-out with no edge
(screenshots in the session). **The GPU frame gate FAILS**, and the attribution says exactly why: zoomed out, `rf()`
reads p50 60.8 / p95 176.1 ms (277 of 524 frames over 50 ms) with the stats recorder at 21 fps avg, **318 draw calls
average (805 max) and 13.4 M triangles average (20.5 M max)** — the far band hides the page terrain but every structure
mesh, procedural character, prop, FX and text label still renders across the whole world. The "far band = 2 draws"
number was terrain-only accounting; the content never joined the ladder. Zoomed in: p50 49 / p95 103.8 ms. Named spike
owners on the run: `manager:structure-full-refresh` 194 ms, `terrain:composite` owner_max 67 ms (the critical-lane
commit is one unsplit task, far over the 8 ms budget), one `render:backend` 1,857 ms (pipeline-compile class). Ruling —
**L5b, before Phase 4**: (1) far/mid-band CONTENT gating at the zoom-band chokepoint: beyond the band threshold
structures render as instanced atlas icons, armies as instanced colour+tier markers, and procedural characters, props,
terrain FX and text labels are hidden — this is the artifact's label-ladder far and mid rows, promoted from later work
because the far band is unusable without it; (2) the terrain composite commit splits into ≤ 8 ms sub-tasks; (3) the
structure full pass is sliced or bounded so no single owner share exceeds the frame budget. Re-measure bars on the
owner's machine: far and mid band p95 ≤ 16.7 ms with far-band draws ≤ 60 and triangles ≤ 2 M; close band no worse than
today and zero unsplit long tasks — the close-view content cost then feeds L5 items 4–8.

L5b reviewed (reviewer, 2026-09-02): the ladder is one frozen band→content table read by every surface
(`worldmap-content-ladder.ts`, wiring enforced by a source test); the present pipeline runs per-page geometry and buffer
writes as separate revision-guarded tasks with a fingerprint no-op guard; the sliced structure diff fences `isCurrent`
per slice and removes+re-adds refreshed entities inside one slice so nothing blinks. Reviewer reproduction: ladder +
wiring + structure + visibility-diff + terrain suites 206/206, typecheck clean; the far-band screenshot is the strategic
map as ruled (biome surface + sparse icons, no models, characters or text). **Code approved; the GPU bars remain with
the owner's re-measure on the redeployed build.** The close band's 507 compact-label draws are confirmed as L5 item 6's
class — if the close bar fails, the atlas is the lever, not the ladder.

L5b owner re-measure (2026-09-02, deployed build, WebGL2 — the WebGPU init stalled 15 s and fell back, with the
`preload-webgpu-renderer-backend` chunk throwing `TypeError: r is not a function`; both belong to half two class 2 and
are now scheduled): far band p50 6.1 / p95 24.3 ms with **21 draws / 20k triangles** (draw and triangle bars pass 30×;
12 of 5,424 frames over 50 ms); mid p50 6.2 / p95 36.5; close **p50 12.1** (was 49 — 4×) / p95 145.5, the p95 carried by
a 2.6 s first-zoom pipeline-compile burst (half two class 1) over the 507 label quads (L5 item 6). Residuals ruled as
**L5c** before Phase 4's first review lands: (1) **the far band lost its subjects** — the ruling said structures render
as instanced atlas icons and armies as colour+tier markers, but only the pre-existing POI points survived, so the
strategic map shows biomes with no structures or armies; add the instanced structure-icon and army-marker layers to the
far (and mid, where models already show) band; (2) split `terrain:present:partition` to the 8 ms sub-task budget (22 ms
observed); (3) bound the WebGPU probe and fix the preload chunk TypeError so capable hardware actually gets WebGPU.
Re-measure far/mid p95 after 1+2; close is accepted with its attributions. Phase 4 (Command Deck steps 1+2) may start in
parallel — different files.

L5c reviewed (reviewer, 2026-09-02): the strategic-marker layer draws every structure and army from the spatial
projection in owner colours, far-band only, kept current from the change sets — the per-kind/per-tier instanced meshes
(≤ 8 draws) are an accepted simplification of the single-atlas letter, well inside the 60-draw bar; the partition is one
linear bucketing pass with per-page sorts (2.6–2.8 ms headless); the WebGPU lane probe is bounded at 1 s with typed
verdicts, remembered per profile in `eternum-renderer-lane`, forced-WebGL never probes, and the root cause is on the
record: three's capability addon holds an unbounded top-level await that Rollup propagates into async chunks with
late-assigned exports — the addon import is deleted everywhere and a source test bans it. Reviewer reproduction:
marker/lane/discipline/wiring/terrain suites 197/197, typecheck clean, the far-band screenshot shows the ownership map.
**Approved; deployed from this tip.** Owner closes the two owed cells: far/mid p95 ≤ 16.7 after the partition split, and
the capable machine reaching `webgpu` via `?rendererMode=webgpu-auto` then booting the remembered lane with no probe.

L5c owner re-measure (2026-09-02, deployed build, WebGL2 lane — the boot log shows no probe stall and no preload error;
whether this machine has any WebGPU adapter at all is still unconfirmed, see brave://gpu): far band p50 18.1 / p95 30.4
with only 6 of 2,365 frames over 50 ms and **21 draws / 20k triangles** (structure and triangle bars pass); mid p50 6.1
/ p95 36.3; close **p50 6.1 / p95 18.2** — the close band, 12.1/145 one build earlier and 49/104 at the baseline, is now
the best band in the game, confirming the compile-burst attribution. The far/mid p95 cells stay open, and the owner
added two design rulings from playing the build: (1) **the mid band still shows a black void beyond the composite
window** — the far biome surface exists but only renders at far; and (2) **the strategic map replaces the real art too
eagerly** — "cap the max zoom out before we turn it into this, for now — I want to see the real art." Ruled as **L5d**:
(a) the far biome surface becomes a permanent underlay beneath page terrain at near and mid, so no band ever shows void
beyond the window (~2 draws); (b) wheel zoom-out is capped at the top of the mid band for now — the far strategic band
(markers layer included) stays in the code, unreachable by wheel, parked until the owner asks for a map-mode key; the
zoom cap and the band thresholds live where the CameraView bands are defined, one constant each, no new mode. After L5d
the max-out view IS the mid band over the full biome underlay; owner re-measures max-out and the digests rule the
residual (compile bursts feed half two class 1, label quads feed L5 item 6).

Additions from the owner's same session. **(c) armies render twice at close zoom** — the screenshot shows the procedural
army character (base mesh, no cosmetics, wrong scale) standing beside the legacy army model. The owner's ruling: **keep
the legacy army models as the one active representation for now** — the procedural characters are still being iterated
on, so `proceduralCharacters` turns off at every band (a dev flag may re-enable them for that iteration; nothing is
deleted), which also closes the double-render by construction. The biome work is approved as-is. And the WebGPU question
is answered: `eternum-renderer-lane` reads `{"lane":"webgl2","reason":"adapter-timeout"}` — the bounded probe works;
this Brave/Wayland/NVIDIA machine never answers `requestAdapter()` (matches the earlier brave://gpu finding), so the
instant fallback is correct; `?rendererMode=webgpu-auto` re-probes after any driver or browser update.

One more L5d item from the owner: **(d) the minimap viewport is not synced to the camera on load** — it only matches
after the first wheel event. Same class as the sync guardrails' "entities are state; events are ephemera", applied to
camera state: the minimap derives its rectangle from zoom events and never reads the current camera on mount. Fix at the
chokepoint: on mount and on scene handoff the minimap reads the camera's current position/distance once, then subscribes
for updates — and any other camera-state consumer wired events-only gets migrated in the same change.

**(e) The adapter-timeout verdict is a false negative on capable machines.** The owner's Brave returned a real
`GPUAdapter` from the console at idle, while the boot-time probe recorded `adapter-timeout` twice (fresh `recordedAt`
each run) — because the 1 s wall-clock race runs during boot, when multi-hundred-ms boot tasks block the main thread and
the adapter's reply cannot be delivered before the deadline. A capable machine gets webgl2 remembered forever. Ruling:
`adapter-timeout` becomes a **soft verdict** — the current boot stays on WebGL2 (no stall), but once boot settles the
client re-probes in the background at idle and rewrites the lane memory, so the NEXT load boots WebGPU;
`no-adapter`/`no-navigator-gpu` stay hard verdicts. The owner's machine is the test case: after the fix, load once
(webgl2), reload — the second load must show `renderer_mode=webgpu`.

Scheduled after L5b gates green (owner + reviewer, 2026-09-02): **worldmap decomposition**. The perf work is hardening a
~7,600-line god-object in place — every L5 fix threads through `worldmap.tsx`, and it is the one file where concurrent
agents are forbidden. The extraction pattern is already half-done (`worldmap-terrain-presentation- runtime`,
`worldmap-zoom/`, `worldmap-store-bridge`, `worldmap-critical-manager-catchup-runtime`); the remaining cut lines are the
frame-owner seams (hover, structure pass, projection intake, boot/handoff). Rules: move-only commits separated from any
logic change; each extracted module owns its tests with no private cross-imports; the gate is that the scene file's top
level reads as an outline per the repo's Clean Code Standard (line count ≤ ~1,500 as the smell proxy, not the goal).
Runs after L5b and may overlap Phase 4's UI-layer steps, never L5b itself.

Recorded, L5b (2026-09-03, branch `client-scale-96p`, one commit on top of the L5 tip). (1) Content ladder: one table,
`apps/game/src/three/scenes/worldmap-content-ladder.ts`, maps the zoom band (`CameraView`, resolved from distance) to
what renders — near: everything; mid: models and FX, text only for priority entities, armies as tier glyphs; far: the
strategic map, atlas icons and markers only. Every surface reads it from the band listener it already had: the structure
manager hides every `InstancedModel` group, wonder, cosmetic attachment (now under one root) and CSS2D group, clears its
compact labels and skips model animation in the far band, keeping the `PointsLabelRenderer` icons (one `THREE.Points`
draw per category — these are the ruling's atlas icons); the army manager hides every army model group
(`ArmyModel.setModelsVisible`, animation skipped while hidden), stops presenting procedural characters (the existing
reconcile restores the hidden legacy representation per entity, so the handoff is atomic) and gates compact labels; the
chest and reserved-hyperstructure managers hide their models; the scene hides the FX backends (every effect now hangs
under one `world-fx` root with `setVisible`), combat projectiles/impacts and arrival ghosts, and the detailed terrain
group as before. Mid-band label priority (`shouldShowTextLabel`): selected, hovered and under-attack always; then own,
allied and the top-10 leaderboard owners (`LeaderboardManager.playersByRank`, normalised addresses); spectators only the
first three. The scene pushes a `WorldmapLabelPriorityContext` to both managers on band change, hover, hex leave and
selection change. (2) The composite commit is now a pipeline of critical-lane tasks: `terrain:composite` (compose),
`terrain:composite:present` (ecology anchors + kick), then inside `presentAsync(input, scheduler)`
`terrain:present:partition`, `:roads`, `:request` per page, `:release`, `:page` (geometry) and `:page-writes` (prop slot

- fog cells) per changed page, `:fog` — each revision-guarded, a superseded run resolves null. The request build lost
  its 55 k-string halo map and per-page sorts (numeric cell keys), and the road builder's A\* keys are numeric too
  (`hexCellFromKey` inverts `hexCellKey`). (3) The structure full refresh (`refreshExisting`) commits through
  `commitManagerVisibilityDiffSliced` — 6 ms slices, each its own `manager:structure-full-refresh` task, the pass fence
  checked per slice, points batches per slice, one `commitVisibleIds` at the end; targeted passes stay one step.
  Counters: gauges `contentBand`, `structureFullRefreshSlices`, `structureFullRefreshMaxSliceMs`,
  `structureHiddenModelGroups`, `structureCompactLabelsShown`; `getTerrainPresentMetrics()` under `?dev`
  (`presentTasks`, `presentRequestsMaxMs`, `presentPageTaskMaxMs`, `presentPageWritesMaxMs`, `presentFogMaxMs`).
  Latest-features: "Strategic Map View". Net: 30 tracked files +1,479/−417 (production +1,112/−373, tests +367/−44) plus
  122 new production lines (the ladder) and 606 new test lines; the structure manager (+185), the terrain present
  wrapper (+171) and the sliced diff helper (+131) carry the growth — the ruling asked for three new capabilities, and
  the deletions are the whole-window request build, the scene-per-effect FX parenting and the duplicated model loops.

L5b gate record (2026-09-03, game 16 `lab-mtjsp8bk` snapshot, 96 realms / 310 visible structures / 65 armies, spectating
from the dev server in headless software WebGL2; scene-graph draws and triangles = visible meshes × instances before
frustum culling, same instrument as the L5 record). Far band (distance 80): **9 draws, 0.026–0.056 M triangles** (bars ≤
60 / ≤ 2 M) — the biome surface's two draws, six structure/army icon `Points`, the interactive hex grid; the earlier
far-band content (structure models, characters, props, FX, labels, reserved sites: 318 draws / 13.4 M on the owner's
box) is gone from the graph. Mid band (35.95): 56 draws / 12.85 M (terrain pages+props 5.6 M, models the rest) with
`structureHiddenModelGroups` 7 → 0 on entry and back to 7 on leaving; compact labels 0 as a spectator (only
selected/hovered/under-attack qualify). Close band (10.83): 507 draws / 12.87 M — one compact label quad per visible
entity is the draw count, L5 item 6's class, untouched here ("no worse than today" is by construction: the near row of
the ladder is today's behaviour). Present pipeline after the split, boot at far (4 pages, 32 tasks):
`presentRequestsMaxMs` 4.3, `presentPageTaskMaxMs` 1.6, `presentPageWritesMaxMs` 2.8, `presentFogMaxMs` 0.7 — every step
under 8 ms even in this lane (before splitting geometry from writes, the first page task read 20.8 ms). Structure full
pass: 15 slices over two band flips, `structureFullRefreshMaxSliceMs` 8 (6 ms budget plus one structure's overshoot);
the unit test commits 310 structures in 7 slices at 0.125 ms each. `frameBudgetLongTasks` **+0 over 60 s spectating in
the far band** (0 at 108 s, 0 at 163 s). Screenshots `scratchpad/screens/l5b-far.jpeg` (strategic map: biome hexes,
icons, nothing else), `l5b-mid.jpeg`, `l5b-close.jpeg`. Tests: terrain 37 files / 182, scenes + managers + FX 206/207
files (the known `worldmap-initial-refresh` drift), structure manager 12 files / 63 incl. the 7 new ladder tests and 5
sliced-diff tests; typecheck clean; knip adds nothing. Owed to the owner's machine: far and mid band p95 ≤ 16.7 ms,
close p50/p95 no worse than 49/104, zero unsplit long tasks under churn (the `rf()` snippet + stats recorder on the
deployed build).

Recorded, L5c (2026-09-03, branch `client-scale-96p`, one commit on top of the L5b re-measure). (1) The far band's
subjects: `apps/game/src/three/managers/strategic-marker-layer.ts` — one instanced quad mesh per structure kind (realm,
village, hyperstructure, bank, mine; the existing label icons as textures) and one per army tier (the army icon with the
tier numeral burned into a canvas texture), every instance tinted by the owner's `playerColorManager` colour, tilted to
the camera pitch, swap-removed so `count` is live, `addUpdateRange` per commit, loud overflow at fixed capacities. It is
fed from the whole-world spatial projection, not the render window: seeded beside the biome surface from
`getStructures()`/`getArmies()`, kept by the structure and army change sets (one commit per batch), refreshed for a
structure and its armies when a `Structure` row's owner changes, and shown only in the far band (mid keeps models, so
the layer stays far-only as the ruling allowed). Structure facts come from the structure manager's per-entity cache
(`getStructureMarkerFacts`), army owners from `ExplorerTroops.owner` → structure owner. Deviation from the ruling's
letter: one draw per kind/tier (≤ 8, four in game 16) instead of one atlas draw — no custom shader, no atlas asset, and
the far band's draw bar has 40 to spare. (2) `terrain:present:partition` no longer sorts the whole window: it buckets
cells per page in one linear pass and builds the cell map; each page sorts its own cells inside its request task; the
road builder now shares that map (`cellsByKey`) instead of building a second 9 k-key map, and the wrapper's private
`packCellKey` is gone in favour of the one `hexCellKey`. (3) WebGPU: three's capability addon answers "is WebGPU
available" with a **top-level `await navigator.gpu.requestAdapter()`** — unbounded, and Rollup turns every chunk that
reaches it into an async module whose exports are assigned only after its `__tla` resolves, which is exactly the preload
chunk's `TypeError: r is not a function` (`r()` was the not-yet-assigned `preloadWebGpuRendererModules`); the blockchain
vendor chunk carries its own top-level await, so the backend chunk was async regardless. Fix the class:
`apps/game/src/three/webgpu-lane-probe.ts` asks for an adapter with a 1 s bound and remembers the lane per profile
(`eternum-renderer-lane` in localStorage: `{lane, reason, recordedAt}`); the backend takes its lane from that (a forced
WebGL mode never probes, an explicit `?rendererMode=` re-probes and rewrites the memory, a fresh profile probes once, a
remembered lane starts immediately), records `webgpu` when the WebGPU lane actually initialises and `webgl2` after an
init stall so the 15 s guard is paid at most once per profile; the addon import is gone from the backend and the four
debug renderers (they report the backend three built, `resolveWebGpuRendererActiveMode`), the preload chunk file is
deleted (the primer awaits a dynamic import of the backend module, which settles after any top-level await), and
`renderer-lane-discipline.source.test.ts` bans the addon import. New fallback reasons: `webgpu-probe-timeout`,
`webgpu-remembered-fallback`. Latest-features: the Strategic Map entry now names the ownership markers. Net: 21 tracked
files +310/−72 (production +239/−53, tests +71/−19) plus 456 new production lines in two files and 218 new test lines;
one file deleted.

L5c gate record (2026-09-03, game 16 snapshot, headless software WebGL2, same instruments as L5/L5b). Far band shows its
subjects: 367 structure markers (285 realms, 51 villages, 31 mines; no hyperstructure or bank in this world) and 285
army markers (all T1) in owner colours — screenshot `scratchpad/screens/l5c-far-markers.jpeg`; gauges
`strategicStructureMarkers` / `strategicArmyMarkers`, 4 marker draws, so far-band draws 9 → 13 and triangles +2.6 k; the
layer hides on entering the mid band (`getStrategicMarkers().object3d.visible` false at 35.95) and the structure models
return (`structureHiddenModelGroups` 7 → 0). Partition: `presentRequestsMaxMs` 4.3 → 2.6–2.8 ms at boot in this lane
(bar ≤ 8; the owner's 22 ms was the global sort plus the road builder's second map, both gone). WebGPU: with
`?rendererMode=webgpu-auto` the headless browser (no adapter) answered `no-adapter` at once, remembered
`{"lane":"webgl2","reason":"no-adapter"}`, started on WebGL2 (`renderer_mode=webgl2-fallback`) and the next default boot
reused the memory without probing; the production build now has no `WebGPU-*.js` addon chunk and no preload chunk, and
`requestAdapter` appears only in the backend chunk's bounded probe. `frameBudgetLongTasks` +0 over the session. Tests:
352/354 files in the terrain, scene, manager, FX, combat, debug and renderer suites (the known
`worldmap-initial-refresh` drift plus the spatial-retention proxy, which now bans whole-projection reads only when they
feed the pathfinding worker — the far band's GPU layers read the whole projection by design); typecheck clean; knip adds
nothing. Owed to the owner: far/mid p95 ≤ 16.7 ms after the partition split, and a capable browser landing on
`renderer_mode=webgpu` with `?rendererMode=webgpu-auto` (the headless lane cannot show WebGPU).

Recorded, L5d (2026-09-03, branch `client-scale-96p`, one commit; the four ladder-level rulings a–d, smallest diffs).
(a) Underlay: the ladder gained `biomeUnderlay`, true on every row, and the scene's band listener applies it
(`worldBiomeSurface.setVisible(ladder.biomeUnderlay)`) — the whole-world biome surface sits at y = −0.7 under the page
terrain (land −0.47…0.37, water −0.055, fog sheet 0.24), so page terrain always wins where it exists and no band shows
void beyond the composite window. (b) Zoom cap: `WORLDMAP_BAND_BOUNDARIES` (close/medium 15, medium/far 45,
hysteresis 4) now lives in the band policy and `WORLDMAP_CAMERA_ZOOM.maxDistance` reads its `mediumFar`, so wheel
zoom-out stops at 45 — the top of the mid band; the far strategic band and the marker layer stay in the code and tests,
unreachable by wheel, parked in the ladder comment until a map-mode key. (c) One army representation:
`proceduralCharacters` is false on every row — the legacy army models are the one representation while the procedural
characters are iterated on; nothing is deleted, `?proceduralCharacters=1` under dev mode re-enables them (the existing
reconcile makes the switch atomic per entity, which also closes the double render by construction). (d) Camera state is
state: the scene now publishes `cameraTargetHex`/`cameraDistance` to the UI store unthrottled at the end of the entry
and resume alignment (`alignWorldmapCameraToDistance`), and the minimap seeds its scale from the current distance on
mount (`resolveMinimapScaleForCameraDistance`) instead of only reacting to the next change; the remaining camera
`CustomEvent`s (`minimapCameraMove`, `minimapZoom`) are commands from the minimap to the scene, not state, and stay.
Latest-features: the Strategic Map entry now says max zoom shows the real terrain over the full-world biome map and that
the icon map is parked behind a future map-mode key. Net: 9 tracked files +85/−22 (production +59/−13, tests +26/−9).

L5d gate record (2026-09-03, game 16 snapshot, headless software WebGL2). Zoom cap: eight wheel notches out from 35.95
stop at exactly 45 (`worldmapDistance` 45 persisted), band stays 2 (mid), the marker layer stays hidden and both the
page terrain group and the biome surface stay visible. No void beyond the window: screenshots at max-out
(`scratchpad/screens/l5d-maxout-45.jpeg` — pages in the centre, flat biome hexes beyond them to the frame edge) and mid
(`l5d-mid-25.jpeg`); what remains dark beyond the window is unexplored shroud in the deep-fog colour, the same constant
the in-window fog sheet mixes from. One army representation: at close zoom (distance 10, 65 visible armies) the scene
holds zero `procedural-army-character:*` objects; only the legacy instanced army model groups draw. Minimap: the SVG
viewBox and camera circle follow the published distance (12.21 → viewBox 123.8 wide, 14.92 → 151.3, i.e. scale
1.4·20/distance) — the mount-time mismatch the owner saw could not be reproduced headlessly, so the fix is the class the
ruling named (publish on entry/resume, seed from current state) and the owner confirms on the deployed build. Tests:
ladder, wiring, zoom, terrain, scene, manager, FX, combat, UI and store suites 378/379 files (the known
`worldmap-initial-refresh` drift); typecheck clean; knip adds nothing. Owed to the owner: re-measure max-out (= mid band
over the underlay), eyeball the art, and confirm the minimap matches the camera on load.

L5d(e) recorded (2026-09-03, second commit in the L5d stack). `adapter-timeout` is now a soft verdict inside
`webgpu-lane-probe.ts`: the boot that times out still starts on WebGL2 with no stall and remembers
`{lane: "webgl2", reason: "adapter-timeout"}`, but it schedules one background re-probe after boot settles
(`requestIdleCallback` with a 30 s ceiling, a 10 s timer where idle callbacks do not exist) with a 5 s bound and
rewrites the memory with the answer as `idle:<verdict>` — so the next load boots WebGPU when an adapter answers; a
remembered soft verdict (`adapter-timeout` or `idle:adapter-timeout`) re-probes at idle again on every boot until the
answer is hard; `no-adapter` and `no-navigator-gpu` stay hard and schedule nothing; the renderer never hot-swaps
mid-session. Unit tests pin the soft/hard split, the single idle re-probe, the memory rewrite and the remembered-soft
re-probe. Headless can only exercise the hard `no-adapter` path (this browser has no adapter); the owner's machine is
the live gate: load once (`renderer_mode=webgl2-fallback`, memory `adapter-timeout`), let it idle, reload — the second
load must log `renderer_mode=webgpu` with the memory reading `idle:adapter`.

### Order

M → L1 + L2 (deletions, the amplification ratio) → L3 + L4 (fan-out) → L5 items 1–3 → half four (which carries L6) → L5
items 4–8. Half two's classes 3–5 stay in front of all of this: they are gameplay-visible.

## Half four — the overlay redo: Command Deck

Design: the "Blitz Command Deck" artifact, https://claude.ai/code/artifact/0be5faba-8de2-403a-9e4b-0ebb87f54692 (real
captures of game 11, zones drawn on them, modal → surface table, identity states). The rules it fixes in code:

- One identity input, one output. The identity session is the only "logged in" fact; the chip in the top-left shows
  spectating / spectating as name / name · n realms / connecting. `NotLoggedInMessage` reads the Dojo account, which is
  the frozen `0x0` spectator account, so every spectator is told they are not logged in
  (`shared/components/not-logged-in-message.tsx`); `play-view.tsx:883` gates the landing on the gameplay account so an
  authenticated user sees "Sign in" while the account deploys; `gameplay-account-sync.tsx:43` nulls the account on every
  `activeWorld` object identity change, dropping the route from ready to loading mid-boot. All three go with the chip.
  The two URL spectate readers outside `utils/spectator-session.ts` (`play-route-boot-request.ts:34`,
  `game-entry/context.ts:100`) go. The identity API's allowed origins must include the game origin — on
  `eternum-game.pages.dev` `get-session` is CORS-blocked, so that build can never show a login.
- No modals. `BlankOverlayContainer` (`ui/shared/containers/blank-overlay-container.tsx:26`) is a full-screen
  `pointer-events-auto` wrapper around every `toggleModal` modal. The four systems (`toggleModal`, `CenteredModalShell`,
  `DialogShell`, `openedPopups`) become one anchored, non-blocking `Popover`; build / produce / army / transfer / attack
  become command-card tabs with ghost placement; market is a right ledger drawer; toasts, Transactions, Logistics and
  Notifications become one event feed; chat is a bottom-right drawer. Transaction state renders on the button and the
  entity (ghost → solid at pre-confirm → feed row gold at confirm → red flash + reason on revert). A direct realm link
  must hand off for a spectator (today `/hex?spectate=true` blocks at "Waiting for world map"; `boot=map-first` works).
- Deletes: Cartridge Controller button and the `x.cartridge.gg` iframe on the landing, the `demo-player` chat id,
  `NoAccountModal`, `SignInPromptModal`, `EndgameModal`, the reconnect hard reload, the 4 s reconnect grace timer,
  `bottom-right-panel.tsx`'s right-centre inspectors.

Gate: a spectator with a session sees no login banner and a Play affordance when they own a realm; no element with
`pointer-events-auto` covers the canvas while any surface is open; every action's pending state is visible on the entity
within one frame of the click; `apps/game` contains no `Modal` shell component.

## Procedural terrain

PR #4903 (procedural terrain and armies) and PR #4905 (ecology and living roads) are merged onto the phase-1 layout
(`e4524ccc668`, `8268a4c2ad1`): typecheck, the 49 terrain/verification test files (247 tests), prettier and knip clean.
The remaining cost class the PRs leave is L5 item 1. `worldmap-initial-refresh.source.test.ts` fails on
`feat/madara-lab` before the merge (it expects `return completeWorldmapInteractiveRefresh` where the branch has `await`)
— the branch's own refresh change, to be fixed by its author.

## Addendum — owner captures, 2026-09-01 pm

First real 96-player client sample (owner's GPU, 77 s stats recording, live game): fps min 2.7 / avg 45.8 / max 66.6;
draw calls 106–200 (avg 162); triangles ~1.16 M avg; +32 geometries, +19 textures, 0 new programs. Draw calls and
triangle counts are nowhere near a budget — the dips to 2.7 fps with an idle GPU confirm the bottleneck is main-thread
work (ingest, composite, fan-out), not rendering volume. These columns join the half-two table as the 96-player
baseline.

New classes the captures exposed, folded into the halves above:

- **L5 item 0 — far-LOD terrain.** Fully zoomed out, biomes end at a hard edge: terrain exists only inside the 48×48
  render window (`three/constants/world-chunk-config.ts:60`, 24×24 visual pages, `maxCompositePages: 12`). A 96-player
  map is several windows wide. Fix: one whole-world biome surface painted from `TileOpt` (already in RECS) — a single
  instanced flat-hex mesh or texture, unexplored shroud included — with the detailed procedural pages composited on top
  near the camera. Gate: no visible terrain edge at any zoom; ≤ 2 extra draw calls.
- **Continuous zoom.** The wheel sets exact camera height in world and local view. The CLOSE/MEDIUM/FAR presets and the
  "Enable Map Zoom" setting are deleted; zoom bands select content (far band = far-LOD + icons, near band = procedural
  pages, props, characters). The fixed-zoom assumption existed to bound terrain cost; the far-LOD removes the need.
- **Label ladder** (extends L5 item 6): far band zero text labels (ownership tint + icons for hyperstructures / own /
  under-attack); mid band names for own, allied, selected, top-10 only, armies as colour + tier glyph; near band full
  labels under a ~30 budget; selected/hovered/under-attack always. Same ladder gates the procedural-character handoff to
  instanced markers (L5 item 4's budget). One glyph/digit atlas, no DOM.
- **Transfers are invisible** (owner: "transfers dont seem to show up in the ui currently"). Logistics fires the tx and
  toasts "Sent resources", then nothing until arrival. Half four's event feed gains a gate: a started transfer is a feed
  row with a countdown and a caravan on the map within one frame of pre-confirm; arrival flips the row and credits the
  ledger.
- **Action-mode conventions.** Today: every owned army ringed at once, "Right-click to confirm / Esc to exit". Redo:
  left-click selects, right-click is the smart action on the target, Esc cancels; only the selection and legal targets
  are emphasised; ownership is tint. The ghost pattern already shipped (move preview, ghost building) — it becomes the
  single pending-state pattern for build / deploy / transfer / attack.
- **Confirmed in prod:** the sync-status overlay (DevSyncOverlay) renders in the owner's production build, bottom-left —
  the L3 mount-gate fix is not hypothetical.
- **Diagnosed — heraldry over-tint + tier-1 base body** (owner's bot close-up). Three causes, all tuning inside the
  procedural-character system, no bug: (1) tier 1 deliberately maps to the `base` asset — bald body in shorts
  (`procedural-character-appearance.ts` `assetByTier: {1: "base", 2: "peasant", 3: "ranger"}`), and every lab bot runs
  T1, so the whole map reads as unclothed; (2) the horse coat lerps toward the owner's heraldry colour at **0.72**
  (`procedural-horse-avatar.ts:489-494`), which turns the entire mount solid blue/pink for saturated player colours; (3)
  shields and crossbows are built entirely from one `accentMaterial` set to the player colour
  (`procedural-unit-equipment.ts:54,107`), so the prop is a flat colour blob. Fix: heraldry lives in accent zones — coat
  lerp ≤ ~0.2 with the colour carried by saddle cloth/banner/trim, props split metal/wood + accent trim, and T1 wears
  the peasant asset (or base + tabard) so no tier reads naked at distance. Gate: at mid zoom a bot army reads as an
  equipped unit with a coloured banner, not a tinted mannequin.

## Addendum — latency decomposition under load, 2026-09-01 evening

39 `explore_reveal` samples from the owner's client (EU) against the Ashburn box while 80 bots ran mid-workload (~5
tx/s): click→rendered p50 407 ms / p95 1,549 ms; pre_confirmed→rendered p50 143 ms / p95 353 ms. Segment medians: build
calls ~2 ms · submit guard ~30 ms idle, **150–280 ms when acting rapidly** · sign+send ~150 ms (transatlantic RTT +
tunnel) · submitted→pre_confirmed **~20 ms** · herald diff 30–60 ms (one ~600 ms hiccup in the tail) · diff→rendered
~130 ms. The p95 tail is compounding (elevated sign+send + block-boundary wait + herald hiccup landing together), not
one culprit.

What this changes in the halves above:

- **The premise is confirmed**: the sequencer has headroom at 80 bots (20 ms median execute+pre-confirm); the felt
  latency is ~70 % network + client.
- **The client-owned slice gets its gate.** diff_received→rendered (p50 143 ms under churn) is L2 + L5 work. Gate:
  pre_confirmed→rendered ≤ 50 ms p95 on the reference machine during a 96-bot workload.
- **New class — submit-guard serialization** (extends half two, class 4): calls*built→sign_send_started jumps to 150–280
  ms only when actions are rapid, i.e. the nonce lock queues the \_signing* of action N+1 behind action N. Fix the
  class: allocate nonces locally, pipeline sign+send, resync the nonce on revert; no action's signing ever waits on
  another action's receipt or pre-confirm. Gate: calls_built→sign_send_started ≤ 35 ms p95 regardless of action rate.
- **Geography is a named non-client lever.** Sign+send ~150 ms is RTT to Ashburn through the tunnel. The client-side
  answer is already half four's rule — the ghost renders at click, so felt latency is one frame at any RTT; measure
  "felt" as click→ghost. Box placement / an EU PoP is an infra decision, out of this brief's scope.
- **L0 gate addition**: herald logs per-diff fold→publish latency so a 600 ms diff hiccup is attributable (alert above
  200 ms), instead of surfacing only as a client tail sample.
- Block-boundary pre-confirm waits (~500 ms worst case) are cadence, accepted — invisible once the ghost carries the
  pending state.
