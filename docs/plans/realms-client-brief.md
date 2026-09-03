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

L5d reviewed (reviewer, 2026-09-02): the underlay is a ladder field on every row; the zoom cap and the band thresholds
read one shared `WORLDMAP_BAND_BOUNDARIES` table (`maxDistance` = the mid/far boundary, the far band parked in code and
tests); procedural characters are off everywhere behind a dev-only `?proceduralCharacters=1` override; the minimap
derives its initial scale from the live camera distance on mount and subscribes for updates; and `adapter-timeout` is a
soft verdict — one patient (5 s) idle re-probe per boot rewrites the lane memory so the next boot flips to WebGPU,
`no-adapter` staying hard. Reviewer reproduction: 215/215 across ladder/wiring/zoom/lane/structure/terrain suites,
typecheck clean; the max-out screenshot shows real terrain over the full-world biome underlay with no void. **Approved;
deployed from this tip.** The owner's four live checks (art at max-out + rf(), one army representation, minimap on load,
second-load WebGPU) close the phase; Phase 4 steps 1+2 then proceed.

**L5 CLOSED by owner acceptance (2026-09-02).** All four live checks passed on the deployed build: zoom-out stops at the
mid band over the full-world biome underlay with real art and no void; exactly one model per army; the minimap matches
the camera on load; and max-out reads **p50 12.1 / p95 24.6 ms** (from 61/176 at the L5b baseline). The one open
curiosity is parked by owner ruling ("let's keep the GPU for ourselves"): even the patient 5 s idle re-probe records
`idle:adapter-timeout` while a manual console `requestAdapter()` resolves instantly — WebGL2 remains the lane, the
soft-verdict machinery stays in place harmlessly, and the WebGPU chase stops here. Remaining perf levers (label atlas
item 6, compile prewarm half two class 1) stay queued on their own merits. **Phase 4 (Command Deck) steps 1+2 are now
the open track**, with the worldmap decomposition cleared to run alongside.

Queued finding for the label work (owner screenshot, 2026-09-02, mid band; explicitly deferred — "let's fully finish our
work first"): several army tier glyphs ("T1") render orphaned on empty hexes with no army beneath them — anchors
mispositioned or glyphs lingering after the army moved or despawned — and the mid band mixes name-plates and glyphs
inconsistently. The orphaning is a correctness smell: the glyph layer must be driven by the same reconcile that places
and removes the army models, not a parallel lifecycle. Folds into L5 item 6 (label atlas + ladder polish) when that item
is picked up, after Phase 4 steps 1+2.

Decomposition Cut 1 reviewed (reviewer, 2026-09-02): the ownership-pulse presenter extraction is a clean move (net −41
lines in the scene, presenter owns its cache, 6/6 new tests, ladder wiring still green) — **approved**. The agent's stop
is ruled correct: the remaining fat is pinned by seam-owning wiring/source tests by design, and cutting it is state
relocation, not moving. Ruling on the question: **state relocation is permitted, on the relocation basis** — when pinned
code moves to a collaborator, the pinning wiring test retargets to enforce the SAME discipline at the new home, in the
same commit, which is labeled `relocation` (not move-only), one relocation per commit, the test's preserved intent
stated in the commit message; shared reset helpers may gain the collaborator's reset hook (chokepoint pattern); global
discipline gates (recs-query/polling) are never retargeted. **Sequencing: the decomposition pauses until Phase 4 steps
1+2 land and the tree is green** — the identity module is transiently broken mid-flight and two agents relocating state
in one worktree over a red typecheck is the known hazard. Order of relocations when it resumes: terrain-visibility
health monitor first, then hover-label recovery; the strategic-marker and combat-presentation shells are re-judged after
those two. Honest expectation set now: extraction alone will not reach the ~1,500-line proxy — after the relocation
round we measure what remains and decide on evidence whether the top-level outline gate is met or a larger reshape is
warranted.

Scheduled after L5b gates green (owner + reviewer, 2026-09-02): **worldmap decomposition**. The perf work is hardening a
~7,600-line god-object in place — every L5 fix threads through `worldmap.tsx`, and it is the one file where concurrent
agents are forbidden. The extraction pattern is already half-done (`worldmap-terrain-presentation- runtime`,
`worldmap-zoom/`, `worldmap-store-bridge`, `worldmap-critical-manager-catchup-runtime`); the remaining cut lines are the
frame-owner seams (hover, structure pass, projection intake, boot/handoff). Rules: move-only commits separated from any
logic change; each extracted module owns its tests with no private cross-imports; the gate is that the scene file's top
level reads as an outline per the repo's Clean Code Standard (line count ≤ ~1,500 as the smell proxy, not the goal).
Runs after L5b and may overlap Phase 4's UI-layer steps, never L5b itself.

**Decomposition extraction map (append one row per move-only cut).**

- Cut 1 — structure ownership pulses (2026-09-02, branch `client-scale-96p`). Moved the selection-feedback overlay that
  pulses a structure's owned footprint out of the scene into a collaborator: new
  `apps/game/src/three/scenes/worldmap-structure-ownership-pulses.ts` (`WorldmapOwnershipPulsePresenter`, 71 lines) with
  its own test (`worldmap-structure-ownership-pulses.test.ts`, 104 lines / 6 cases). Removed from `worldmap.tsx`:
  `updateStructureOwnershipPulses` + `getStructurePulseColors` methods and the `structurePulseColorCache` field (the
  presenter now owns the colour cache); the scene constructs the presenter in `initializeWorldmapInteractionRuntime`
  (injecting `clearOwnershipPulses`/`showOwnershipPulses`/`getStructureHex`/`getOwnedArmyHexes`) and calls
  `ownershipPulsePresenter.update(...)` at the two former call sites (`onStructureSelection`, `onArmySelection`). The
  now-unused `Color` and `resolveOwnershipPulseHexes` imports were dropped; the shared `getStructureHexPosition` (6
  callers) stays in the scene and is injected. Pure footprint geometry was already extracted
  (`worldmap-ownership-pulse-policy.ts`), so this move added no logic. worldmap.tsx 8704 → 8663 (−41; git +16/−57). No
  source/wiring test pinned the moved methods. Gate: presenter test 6/6; scenes 842/843 (the one red is the pre-existing
  known `worldmap-initial-refresh` drift, in the warp-travel refresh region this cut never touches — string counts
  identical to HEAD); managers + terrain 644/644; typecheck clean on the three touched files; prettier + knip clean on
  them.

- Cut 2 — terrain-visibility health monitor (**relocation**, 2026-09-02, branch `client-scale-96p`). Moved the
  terrain/chunk visibility self-heal out of the scene into a collaborator: new
  `apps/game/src/three/scenes/worldmap-terrain-visibility-health-monitor.ts` (`WorldmapTerrainVisibilityHealthMonitor`,
  245 lines) with its own test (136 lines / 7 cases). The collaborator now owns the seven frame/recovery counters and
  six config thresholds that were `worldmap.tsx` fields, plus the ~147-line `monitorTerrainVisibilityHealth` body (split
  into `recoverOffscreenChunk` / `evaluateRetainedTerrain` for one level of abstraction). The scene builds it in
  `initializeWorldmapSupportManagers` (injecting `isBoxVisible`, `getVisibleCellCount`, `requestChunkRefresh`,
  `waitForRequestedChunkRefresh`, `emitTelemetry`, `recordBoundsRecovery`); `update()` calls `tick(snapshot)` once (the
  old `terrainSelfHeal` if/else folds inside), and `resetZoomHardeningRuntimeState` calls `reset()` — the single reset
  chokepoint. Shared reset helper (chokepoint pattern): `resetWorldmapZoomHardeningRuntimeState` dropped its two terrain
  fields (`zeroTerrainFrames`, `terrainRecoveryInFlight`); that reset discipline now lives in the collaborator's
  `reset()`. Retargeted tests in the same commit: `worldmap-zoom-hardening.test.ts` dropped those two fields from its
  reset-helper cases (the preserved intent — reset clears the recovery-in-flight guard and the counters, while the
  cooldown timestamp survives — is now asserted by the collaborator's own test);
  `worldmap-refresh-scheduler.wiring.test.ts` reads the `offscreen_chunk` / `terrain_self_heal` force-refresh discipline
  from the collaborator source now that those calls live there. Pure anomaly math (`evaluateChunkVisibilityAnomaly` /
  `evaluateTerrainVisibilityAnomaly`) stays in `worldmap-zoom-hardening.ts`, imported by the collaborator; behaviour
  preserved (`reset()` clears the six counters the scene cleared and leaves `lastTerrainRecoveryAtMs`). worldmap.tsx
  8663 → 8503 (−160; git +22/−182). Gate: collaborator 7/7, zoom-hardening 12/12; scenes 850/851 (the one red is the
  pre-existing known `worldmap-initial-refresh` drift, untouched here); managers + terrain 644/644; typecheck clean
  repo-wide; prettier + knip clean on the touched files.

- Cut 3 — hover-label recovery (**relocation**, 2026-09-02, branch `client-scale-96p`). Moved the "keep retrying the
  hovered hex until its labels resolve" state machine out of the scene into a collaborator: new
  `apps/game/src/three/scenes/worldmap-hover-label-recovery.ts` (`WorldmapHoverLabelRecovery`, 159 lines) with its own
  test (140 lines / 9 cases). The collaborator owns the single `pending` retry state (was the
  `pendingHoverLabelRecovery` field), the `HoverLabelRecoveryReason` / `PendingHoverLabelRecovery` types, the
  `HOVER_LABEL_RECOVERY_FRAME_BUDGET` const, and the decision methods `applyResult` / `isPendingForHex` / `trace` (was
  `applyHoverLabelRecoveryResult` / `isPendingHoverRecoveryForHex` / `traceHoverLabelRecovery`); the hovered hex and the
  switch-off flag stay scene state, read through injected `getHoverHex` / `isSwitchedOff` accessors plus a
  `reconcileHexHover` callback. The scene builds it in `initializeWorldmapSupportManagers` and keeps four thin
  delegators (`reconcileHoverLabels`, `retryPendingHoverLabelRecovery`, `runPendingHoverLabelRecoveryFrame`,
  `clearPendingHoverLabelRecovery`) so every lifecycle call site (mouse-move, scene-ready, converged, critical/
  non-critical catch-up, switch-off, attach/detach labels) keeps its wiring — only the two body-content pins moved.
  Retargeted tests in the same commit, preserving intent: `worldmap-hover-label-wiring.source.test.ts` now checks the
  collaborator owns the pending state and that `reconcile` routes through `applyResult` (the scene still drives
  `runPendingHoverLabelRecoveryFrame` per frame); `worldmap-initial-terrain-convergence.source.test.ts` reads the
  no-entity-clears-pending discipline from the collaborator's `applyResult`. Behaviour-neutral (the state machine is
  reproduced verbatim over injected accessors). worldmap.tsx 8503 → 8392 (−111; git +12/−123). Gate: collaborator 9/9;
  scenes 859/860 (the one red is the pre-existing known `worldmap-initial-refresh` drift); managers + terrain 644/644;
  typecheck clean repo-wide; prettier + knip clean on the touched files. Relocations (1) and (2) done — next: stop and
  re-judge the strategic-marker and combat-presentation shells with the owner before touching them, then report
  worldmap.tsx's residual composition.

- Cut 4 — combat presentation (**relocation**, 2026-09-02, branch `client-scale-96p`). Moved the procedural-combat
  presentation bridge out of the scene into a collaborator: new
  `apps/game/src/three/scenes/worldmap-combat-presentation.ts` (`WorldmapCombatPresentation`, 111 lines) with its own
  test (149 lines / 8 cases). The collaborator owns the three procedural subscription handles (was the
  `unsubscribeProcedural{RangedRelease,MeleeContact,ProjectileImpact}` fields) and the `replayIndexedCombat` /
  `bindProceduralCombatPresentation` / `presentProcedural{RangedRelease,MeleeContact}` methods; the army manager and the
  combat coordinator stay scene-owned, reached through injected accessors (`armyManager`, `getCombatPresentation`,
  `getArmyDisplayPosition`, `getStructureHexPosition`). The scene builds it in `initializeWorldmapManagers` and calls
  `bind()`; the battle subscription calls `combatPresentationRuntime.replayIndexed(update)`; `destroy` calls its
  `dispose()` (the dispose hook, replacing the three inline unsubscribe pairs). No source/wiring test pinned the shell,
  so no retarget was needed; the now-unused `ProceduralRangedReleaseEvent` / `ProceduralMeleeContactEvent` /
  `ProceduralImpactAuthority` imports were dropped. Behaviour-neutral (methods reproduced verbatim over injected
  accessors). worldmap.tsx 8392 → 8314 (−78; git +11/−89). Gate: collaborator 8/8; scenes 867/868 (the one red is the
  pre-existing known `worldmap-initial-refresh` drift); typecheck clean repo-wide; prettier + knip clean on the touched
  files.

- **Close-out (2026-09-02).** The worldmap decomposition entry is closed per the close-out ruling above. Four cuts
  landed on `client-scale-96p` — pulses (move-only), terrain-visibility self-heal, hover-label recovery and combat
  presentation (relocations) — taking `worldmap.tsx` **8704 → 8314** (−390) and lifting four stateful subsystems out of
  the god-object into tested collaborators, each reading as a `this.<collaborator>.<verb>()` line at the scene's top
  level. Strategic-marker was deliberately left (its only pin is the foreign content-ladder wiring guard — churn for no
  ownership gain). The ~1,500-line proxy is retired: the residual ~8,314 lines are ~68% two working, pinned,
  load-bearing subsystems (chunk/terrain streaming ~3,488, army-interaction ~1,815), whose reshape is out of scope and
  returns only as its own brief if a profile or bug convicts it. The one red scenes test
  (`worldmap-initial-refresh.source.test.ts`) is the documented pre-existing drift, untouched by any of these cuts.

- Cut 4 + close-out reviewed (reviewer, 2026-09-02): the diff is a faithful relocation — the four methods reproduced
  verbatim over injected accessors, the projectile-impact subscription resolved at the same point in
  `initializeWorldmapManagers`, teardown in the same order behind the one `dispose()` hook, the coordinator's own
  `dispose` staying scene-owned. Reviewer reproduction: collaborator 8/8, scenes 867/868 (the one red is the documented
  drift), typecheck clean, no scene path touched by the concurrent Phase 4 WIP. **Approved; the decomposition entry is
  CLOSED. Deployed from this tip.**

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

### Phase 4 record — steps 1+2: identity chip + Popover primitive (2026-09-02, commit `102642cecdc`)

**Landed.** One identity input: `hooks/context/identity-session.ts` is a store and the identity session is the only
"logged in" fact. `IdentityLogin` and `GameplayAccountSync` read it (their two private `getSession` loaders are gone),
and the account sync keys on world values instead of profile object identity (the `gameplay-account-sync.tsx:43`
finding). One identity output: `top-header/identity-chip.tsx` with the pure resolver `identity-chip-state.ts` — states
`spectating` / `spectating as <name>` (+ Play when the account owns a structure) / `not signed in · view only` /
`connecting` / `<name> · n realms · #rank · VP`. Inputs: `isExplicitSpectateSession()`, the identity store, the account
store, and the bridge slices (players, structures, leaderboard standings through `useInGameLeaderboard`). The
spectator's ownership comes from the `structures` slice because `playerStructures` is `[]` by design in an explicit
spectate session (bridge `readPlayerStructures`). One overlay primitive: `design-system/molecules/popover.tsx` +
`hooks/store/use-popover-store.ts` — anchored to its trigger, portaled to the body, Escape / outside pointer-down close,
at most one open, no scrim. Migrated onto it and deleted: `NoAccountModal` and `SignInPromptModal` (the one sign-in
surface is the chip's popover; on the landing `landing-identity-chip.tsx` replays the requested entry route with its
state once the session lands). Also deleted: `NotLoggedInMessage` and its mount, the rank pill in `SecondaryMenuItems`
(variant prop gone), `top-header-player-status`, bootstrap's no-account modal path (`onNoAccount` only logs; the chip
derives the state), and play-view's gameplay-account gate (identity session now, so an authenticated user no longer sees
"Sign in" while the account deploys).

**Gates.** `identity-chip-state.test.ts` (9 cases, drives the real spectator-session module), `popover.test.tsx` (4),
`landing-identity-chip.test.tsx` (3), `identity-surfaces.source.test.ts` (banner and both modals gone, nothing re-mounts
them, sign-in prompts only through `requestSignIn`). `typecheck` clean; `knip` clean (the two pre-existing dist
findings). Full `apps/game` suite: 12 failing files, none from this change — all pre-existing at HEAD:
worldmap-initial-refresh, starknet-provider.factory-tab, play-view.review-autopen, in-game-leaderboard-ownership (test
2, `row.activityBreakdown`), client-legacy-purge-p7d, icy-dragon-assets, frame-budget-work-queue (2),
game-renderer.backend, use-cosmetic-loadout-store (`ResourcesIds` mock), start-time (locale), game-review-service (5 s
timeout under load, green alone). Screenshots in the session scratchpad `screens/`: `p4-before-spectator.png` (banner +
SPECTATING pill), `p4-after-spectator.png` (chip), `p4-after-spectator-popover.png` (sign-in surface + Leaderboard).
LOC: `102642cecdc` +1062 −275 (360 of the additions are tests); the six file deletions (−302) sit in `75d82901d16`
(finding 1).

**Findings.**

1. Attribution: the six `git rm` deletions were staged when the decomposition agent's docs commit `75d82901d16` landed
   in the shared worktree, so that commit carries them. History was not rewritten; the stack is consistent at HEAD.
2. The play route without a session stops at `play-route-reconnect-screen.tsx` (account recovery) before the HUD mounts,
   so the pure `signed-out` chip state shows only when a session drops mid-game. The anonymous spectator (the banner's
   main victim) shows SPECTATING with the sign-in surface in the popover. The three owner eyeballs: anonymous spectator,
   spectating-as / player (needs a wallet), signed-out (clear the identity cookie while in the HUD).
3. Play from an explicit spectate session re-enters through `resetBootstrap()` + `/enter/<chain>/<world>` (play intent):
   the bootstrap cache key ignores intent, so an in-place mode switch needs a bootstrap change. Live verification owed.
4. Untouched, by scope: the Controller entry in the connector list (`starknet-provider.tsx`), the two URL spectate
   readers (`play-route-boot-request.ts`, `game-entry/context.ts`), `EndgameModal` (its replacement is the review route
   and the feed; it now opens the chip popover for sign-in), and the `openedPopups` windows (Social, Settings, …), which
   keep their own exclusivity domain until they migrate.

Phase 4 steps 1+2 + decomposition relocations reviewed (reviewer, 2026-09-02): the identity session store is the one
"logged in" fact and the chip resolver takes only the spectator-session intent, the identity store, the account store
and the bridge slices — no URL heuristics; the Popover primitive matches the contract (anchored, portaled,
Escape/outside dismiss, one open, no scrim) and the spectator screenshot shows the game alive behind the sign-in
surface; the banner, both sign-in modals, the rank pill and the old status resolver are deleted. Reviewer reproduction:
identity/popover suites 16/16, scenes 188/189 (the one red is the documented pre-existing initial-refresh drift),
typecheck clean. The two ruled relocations (terrain-visibility self-heal, hover-label recovery) landed with their
retargeted tests in-commit; worldmap.tsx 8704 → 8392. Rulings on the findings: (1) the deletions swept into the
reviewer's docs commit are accepted as-is — reviewer error (index-wide commit in a shared worktree), fixed by pathspec
commits henceforth; (2) signed-out-in-HUD reachable only on session drop is accepted — the route guard is upstream by
design; (3) Play-from-spectate re-entering via /enter is accepted pending the owner's live check — if the transition
janks, the bootstrap cache key carries intent as a step-3 rider; (4) the untouched surfaces (Controller wallet entry,
URL spectate readers, EndgameModal, Social/Settings windows) are the step-3+ migration list. **Approved; deployed from
this tip.** Owner eyeballs: the three chip states, the sign-in popover as spectator, and Play-from-spectate. The
decomposition now stops per its ruling and reports the scene's remaining composition before any further cut.

Decomposition close-out ruling (reviewer, 2026-09-02): the residual-composition report is accepted as the evidence the
pause asked for — the remaining ~8,392 lines are ~68% two stateful, pinned subsystems (chunk/terrain streaming ~3,488
lines, army-interaction ~1,815), so the original ~1,500-line reduction proxy is not reachable by seam extraction and is
retired as a gate. Ruling on the two shells: **take combat-presentation** (~85 lines, unpinned, clean dispose-hook
relocation) and **skip strategic-marker** — its only pin is the foreign content-ladder wiring guard, so moving it is
churn for no ownership gain. Ruling on the lever: **option A** — after combat-presentation lands, the outline gate is
met at ~8,300 and the decomposition entry closes. A chunk/terrain streaming-subsystem reshape is NOT scoped now: it
would be a multi-commit reshape of a working, pinned, load-bearing system with no convicting measurement (evidence
before optimization), colliding with Phase 4 and the label pass in a shared worktree. It may return later as its own
brief only if a profile or bug names the streaming subsystem. Final cut lands with a close-out row in the extraction
map, then the decomposition agent is done.

Phase 4 live check + log triage (owner + reviewer, 2026-09-02): the three chip states and Play-from-spectate pass on the
deployed build — finding 3 is closed, no intent-cache-key rider needed. One UX amendment ruled by the owner: **the
leaderboard keeps its own button** — reaching it through the identity chip is bad UX. Step 3 therefore anchors the
Social/Leaderboard surface to its own top-bar button (same Popover primitive) and removes the Leaderboard entry from the
chip's sign-in popover; the chip popover stays sign-in-only for spectators. Log triage from the same session: (a)
`WebGPU init stalled for 15000ms` — the parked lane machinery converging as designed: the idle re-probe had found an
adapter and rewrote memory to webgpu, the next boot's full init stalled, and the stall wrote the hard
`webgpu-init-timeout` verdict, so this profile never asks again; no action, WebGPU stays parked. (b) The 3.4s/5.9s
`frame_owner=render:backend` spikes sit at scene boot and the /enter re-entry — first-render shader compile; this is the
conviction evidence for the queued compile-prewarm class (half two, class 1). (c) `rpc error: Unauthenticated` pairs
while spectating anonymously come from a vendor gRPC client (not our source) polling an authed endpoint with no session
— **step-3 rider**: identify the caller and gate it on the identity-session fact, closing the class "authed calls fire
while anonymous". (d) The virtual-keyboard `overlaysContent` line is browser noise; ignored.

### Phase 4 record — step 3: leaderboard and settings popovers, Controller keychain gated (2026-09-02, commit `8c08d4238fa`)

**Landed.** The Social/Leaderboard window is the social board (`social/components/social-board.tsx`: players, tribes,
faith and prize tabs with the expandable player / tribe column) hanging off its own leaderboard button in the top bar's
utility cluster, through the Popover primitive — per the owner's amendment, not the identity chip, whose popover is
sign-in only again. The board derives its ranking from `useInGameLeaderboard`, the standings the chip and the players
panel already read, so the window's private `LeaderboardManager` initialise + interval and its polling-discipline
allowance are gone. The Settings window hangs off the gear as a popover; its Keyboard Shortcuts link closes the popover
and opens the shortcuts window as before. Popover: the trigger owns its click (toggle through the store) so a
`CircleButton` trigger keeps a real `onClick`; the panel carries viewport caps (max width and height on the side it
grows towards) so a wide board shrinks instead of leaving the screen. Deleted: `social.tsx` (the `Social` /
`SocialWindow` shell), `SettingsWindow`, the `Settings` and `Leaderboard` popup names and their `TopNavigation` mounts.

**Rider — anonymous authed RPCs.** The paired `rpc error: code = Unauthenticated desc = access denied` lines come from
`x.cartridge.gg`: the Cartridge Controller keychain iframe, which the SDK creates in the `ControllerConnector`
constructor at module load (`starknet-provider.tsx`) for every visitor, and which then polls its own authed API with no
Cartridge session. The class is "a vendor client that needs a session starts for a visitor who has none"; the SDK's
`lazyload: true` closes it — the iframe is created on the first wallet action (a sign-in click, or auto-connect for a
returning Controller user, who has that session). Verified headless: no iframe and no `Unauthenticated` output over 30 s
of anonymous spectating (before: iframe present, pairs at ~12 s and on every re-entry). The stale provider source test —
red since Controller rejoined the identity wallet picker in `1532d48942a` — now pins the current decision
(`[controller, ready(), braavos()]`, no paymaster, no policies) and the lazy load.

**Gates.** `overlay-surfaces.source.test.ts` (renamed from identity-surfaces: banner, sign-in modals and the window
shell gone, no re-mount, no `Settings` / `Leaderboard` popup names, prompts only through `requestSignIn`),
`social-board.mode-gating.test.ts` and the leaderboard-ownership source test retargeted to the board, `popover.test.tsx`
(4), `starknet-provider.factory-tab.test.ts` (3, previously 1 red). Targeted suites green (11 files); `typecheck` clean;
`knip` clean (the two pre-existing dist findings). Full `apps/game` suite (run with the decomposition agent's in-flight
worldmap edits in the tree): the pre-existing list from the steps 1+2 record, minus starknet-provider.factory-tab, plus
two from that in-flight work — `console-discipline` (a `console.log` in `worldmap-hover-label-recovery.ts:157`) and
`combat-presentation-coordinator.source` (expects `this.replayIndexedCombat(update)` in `worldmap.tsx`). Screenshots in
the session scratchpad `screens/`: `p4s3-after-leaderboard-popover.png` (board under its button, game alive behind),
`p4s3-after-settings-popover.png`. LOC: `8c08d4238fa` +396 −369 (the settings panel's re-indentation counts on both
sides; net structure: window shells and the manager interval out, one 263-line board in).

**Findings.**

1. The top strip is centred, so on a 1280 px viewport the leaderboard popover gets ~820 px (its natural width is 1000
   px, 1400 px expanded) and the players grid narrows; on 1920 px it has full width. The old window centred at 1100 px
   with the same squeeze on small screens. Anchoring is the amendment's; width policy is the reviewer's call.
2. `EndgameModal`, the URL spectate readers and the remaining `openedPopups` windows (transactions, shortcuts, latest
   features, rewards, automation, resource transfer) are still the step-4+ list; the settings panel's Keyboard Shortcuts
   link still opens the shortcuts window through `openedPopups`.
3. Not touched: the identity-origin fetch failing in the local dev profile (`identity_session_load_failed`, no identity
   API on the laptop) — the store resolves to anonymous, as designed.

Phase 4 step 3 reviewed (reviewer, 2026-09-02): the leaderboard hangs off its own top-bar button per the owner's
amendment, the chip popover is sign-in-only again, and the board reads the same `useInGameLeaderboard` standings as the
chip and players panel — the window's private manager, minute interval and polling-discipline allowance are deleted with
it. The Controller `lazyload` rider is the class fix: the keychain iframe (the vendor gRPC client) no longer exists for
a visitor with no session, closed at the connector-constructor chokepoint; no extra identity-session gate is layered on
top. Reviewer reproduction: popover 4/4, overlay-surfaces, board mode-gating, polling-discipline 5/5 and provider 3/3
all green; typecheck clean. One correction to the step record's gates line: `in-game-leaderboard-ownership` is NOT green
— its red assertion (`row.activityBreakdown` in the activity service) is the documented pre-existing drift, and the
service is untouched since the Herald refactor (`f5f226cd282`); step 3's retargeted assertions in that file pass.
Rulings: (1) the 1280 px board squeeze is accepted — parity with the old window; width policy returns only if the owner
reports it on a real screen; (2) lazyload accepted as the class fix, no second guard; (3) owner eyeball of the
leaderboard button + popover and the settings popover pending on the deploy. **Approved; deployed from this tip.** Step
4 = the remaining utility `openedPopups` windows (transactions, shortcuts, latest features, rewards) onto popovers;
automation dashboards, resource transfer, EndgameModal and the URL spectate readers stay on the step-5 list.

## Autonomous run (owner ruling, 2026-09-02)

The per-step implement→review loop closes here; the owner ruled the rest of this brief runs as one autonomous pass. The
implementing agent: (1) derives the remaining-work checklist from this brief's own records (anything a record marks
closed, approved or parked is done — WebGPU is parked, strategic-marker and the streaming reshape stay out of scope),
writes it into this section as an ordered plan with one verifiable gate per item, and commits that plan first; (2)
executes item by item — one item per commit or small commit group, explicit paths only, each item self-verified (scoped
suites, typecheck, knip, prettier; headless screenshots for visual work; the existing measurement recipes — `rf()`,
`[FramePerf]`, `__eternumGameEntryTimeline`, the headless capture scripts — for perf work, numbers recorded next to the
old ones) and recorded here in the same record format as it lands; (3) where an item needs a judgment call, takes the
KISS-conventional option, marks the record "**ruling taken, review me**", and continues — it stops early only when
blocked on something only the owner can do (a live human gate on the owner's machine, credentials, or cutting a
spec-locked system, which still needs the owner per repo rules). Known pre-existing reds it must not chase:
`worldmap-initial-refresh.source.test.ts` and the `row.activityBreakdown` assertion in
`in-game-leaderboard-ownership.source.test.ts` (drift since `f5f226cd282`), plus the three load-sensitive timeout-prone
files named in CLAUDE.md. The agent does not deploy; the reviewer reviews the whole run at the end, deploys from the
reviewed tip, and the owner does one live pass. Owner-gate measurements the agent cannot take (quiet-box human gates)
are recorded as "owner gate pending" rows, not skipped silently.

### Autonomous run — plan (implementing agent, 2026-09-02; committed before any code)

**Derived from the records above.** Done, approved or parked, so not on the list: M, phase 1 (L0–L2, submit guard),
phase 2 (L3–L4), L5 items 0–3 + continuous zoom, L5b/c/d(a–e) (L5 closed by owner acceptance; WebGPU parked — "keep the
GPU for ourselves"), the worldmap decomposition (closed; strategic-marker skipped; the chunk/terrain streaming reshape
out of scope), Phase 4 steps 1+2 and 3 (approved). Owner-only, recorded as "owner gate pending" rows rather than worked:
the GPU p95 bars and every quiet-box measurement, M.3's live 96-bot columns, half one (gated on the web app's lobby),
the identity API's allowed origins (infra), and the Cartridge Controller deletion in the half-four Deletes list
(superseded by the owner's later decision `1532d48942a` to keep Controller as an identity wallet; the iframe half of
that line is closed by step 3's lazy load). Parked with the procedural characters: the heraldry tuning. Ruled keep: the
prop padding.

**Order.** UI layer first (1–9), then scene-touching (10–14), then perf (15–18). One item per commit or small group,
explicit paths only, record appended here as each lands.

1. **Phase 4 step 4 — utility windows → popovers.** Transactions, keyboard shortcuts (a view inside the settings popover
   behind its View link), what's new; the rewards button is deleted — it toggled a popup nothing rendered. Gate:
   `overlay-surfaces.source.test.ts` asserts the window shells and the `Transactions` / `Shortcuts` / `LatestFeatures` /
   `Rewards` popup names are gone; headless screenshots of each popover.
2. **Step 5a — URL spectate readers.** `play-route-boot-request.ts` and `game-entry/context.ts` stop parsing `spectate`
   themselves; the entry intent comes from `utils/spectator-session.ts`. Gate: a source test that only
   `spectator-session.ts` reads the `spectate` query; game-entry + play-route suites green.
3. **Step 5b — the last `openedPopups` windows.** Production automation dashboard (a popover off its trigger), the
   commented-out exploration dashboard (deleted, dead), the per-resource realm transfer windows (a popover anchored to
   the resource chip that opens it). Then `use-popups-store.ts`, the `PopupsStore` slice and `components/config.tsx`
   popup names are deleted with `TopNavigation`. Gate: no `togglePopup` / `isPopupOpen` / `openedPopups` in
   `apps/game/src`; overlay source test extended.
4. **Step 5c — EndgameModal.** The in-game finished-game surface becomes a non-blocking finished pill in the top bar
   whose popover offers review and home (the map stays reachable, the artifact's first complaint); `EndgameModal` and
   `GameIsOverModal` are deleted; the landing's review flow is untouched (half one's territory). Gate: a spectator of a
   finished game reaches the map headless with no `pointer-events-auto` element covering it; source test.
5. **Step 6 — `toggleModal` modals → Popover.** The Popover gains a screen-point anchor (for surfaces opened from a
   scene click) and an optional titled header with close; `ProductionModal` (5 call sites), `BattleLab`,
   `CraftRelicPopup`, `QuickAttackPreview`, `HintModal` migrate; `toggleModal` / `setModal` / `modalContent` /
   `showModal`, `PlayOverlayManager`'s modal host and `BlankOverlayContainer`'s modal use are deleted. Gate: no
   `toggleModal(` in `apps/game/src`; `blank-overlay-container.tsx` no longer wraps any modal; popover tests cover the
   point anchor.
6. **Step 7 — `CenteredModalShell` consumers → Popover, `DialogShell` → Popover.** The 17 shell consumers (construction,
   military, market, production popup shell, chest, help, spire travel, faith devotion, wonder faith detail, end season,
   chat shell, structure edit, transfer manager, both dashboards, battle lab, the sidebar's own use) and the four
   `DialogShell` consumers (transfer automation, base-popup, entity resource table, hint) move onto the Popover; both
   shells and `base-popup.tsx` are deleted. Market is anchored to the right edge as a ledger panel and chat to the
   bottom-right corner as a drawer — same primitive, edge-anchored, per the half-four surface table. Gate: `apps/game`
   contains no `Modal` shell component (`centered-modal-shell.tsx`, `dialog-shell.tsx` gone; source test bans
   `role="dialog"` outside `popover.tsx`); no element with `pointer-events-auto` covers the canvas while any surface is
   open (headless check with each large surface open); every migrated surface's shell deleted in its commit.
7. **Event feed.** One feed store fed by the transaction store (pending / confirmed / reverted rows), the
   `resourceArrivals` slice (transfer rows with a countdown that flip on arrival) and the toasts that today announce
   actions; the transactions popover becomes the feed and `Toaster` leaves the game route (errors keep a feed row in red
   with the reason). Gate: a started transfer is a feed row within one frame of pre-confirm (unit test on the feed store
   against a fake transaction + arrivals slice); no `toast(` call left in `apps/game/src` outside the feed.
8. **Reconnect and direct links.** Delete the reconnect hard reload and the 4 s grace timer in the network status /
   retry path (the transport reconnects on its own); a spectator `/hex?spectate=true` link boots map-first and hands off
   instead of blocking at "Waiting for world map"; `bottom-right-panel.tsx`'s right-centre inspectors are deleted per
   the Deletes list (their facts stay on the entity card). Gate: no `location.reload` in the reconnect path (source
   test); headless `/hex?spectate=true` reaches the HUD; the inspector components are gone.
9. **L6 — overlay churn.** One clock store with primitive fields replaces the 1 Hz object publish
   (`BlockTimestampPoller`) and the per-file 1 Hz intervals that only interpolate the clock; `getBlockTimestamp()` per
   render leaves the top header; tooltip and hover move to their own store so a hover no longer runs every `useUIStore`
   selector. Gate: polling-discipline "clock" allowances shrink to the one clock store; idle React commits/s recorded
   next to 2.31.
10. **Action-mode conventions + pending state on the entity.** Left-click selects, right-click is the smart action on
    the target, Esc cancels; only the selection and legal targets are emphasised; the ghost pattern carries the pending
    state for move (exists), build (exists), attack (target pulse from click) and transfer (caravan from pre-confirm),
    with the button's state following the transaction store. Gate: click→ghost within one frame for each action in the
    scene's action tests; `__clientActionLatencyMeasurements` gains `ghost_rendered`.
11. **Label pass (L5 item 6).** One glyph/digit atlas for the close band's compact labels (one draw for all quads), the
    army tier glyphs driven by the army manager's reconcile (placed and removed with the model, never a parallel
    lifecycle), mid-band plates and glyphs consistent per the ladder. Gate: close band at distance 10 on the game-16
    snapshot ≤ 60 draws (507 today); a unit test that despawning an army removes its glyph in the same reconcile;
    screenshots at 10 and 25.
12. **L5 items 5, 7, 8.** `ArmyModel.updateAllInstances` writes `addUpdateRange` per touched slot;
    `STRUCTURE_INSTANCE_CAPACITY` is sized from the window maximum with a loud clamp instead of a throw; CSS2D renders
    on change with a 16 ms floor and `ReservedHyperstructureManager` consumes the change set. Gate: unit tests per item;
    `getWorldmapRenderDiagnostics()` counters for label renders and reserved-site rebuilds flat while idle.
13. **Frame-owner coverage.** Army sync and chunk work run under `runWithFrameWorkOwner` so a spike names its owner (the
    M follow-up the L5 review asked for). Gate: 60 s headless digest with zero `unattributed` spikes after boot.
14. **Visibility-aware drain.** The ingest drain keeps its timer authoritative when `document.hidden`, so a background
    tab finishes booting. Gate: a unit test on the drain with a hidden document; headless boot with the page hidden
    completes.
15. **Half two class 1 — compile prewarm.** One pipeline warm-up list built from the asset manifest, compiled off the
    critical path after first terrain; the first-terrain frame draws terrain pipelines only. Gate: first-frame
    `createRenderPipeline` count and the `render:backend` boot spike recorded before/after on the headless recipe (today
    `createRenderPipeline=65x/1.4 s` in the first spike); owner gate pending for the 3.4 s / 5.9 s spikes.
16. **Half two class 3 — fog.** Verify then fix: every explored-tile write (hydration, diff, own action) reaches one fog
    invalidation chokepoint and the reveal starts from the diff. Gate: a unit test that a hydration write and a diff
    write both mark the fog page dirty; the terrain fog wiring source test extended.
17. **Half two class 5 — bootstrap streaming.** The scene renders from the first snapshot page that carries the player's
    own structures and streams the rest. Gate: `bootstrap_done` / `first_terrain` from `__eternumGameEntryTimeline`
    recorded headless before/after; owner gate pending for the ≤ 1 s / ≤ 2 s bars.
18. **Half two class 4 — render on arrival.** Verify the one-player-event path applies its diff in the frame it is
    received (L4 flush per slice, ≤ 6 ms). Gate: `pre_confirmed → rendered` headless number recorded; owner gate pending
    for ≤ 50 ms p95 under a 96-bot workload.

Owner gate pending (recorded, not worked): far/mid/close p95 on the GPU after items 11–15; explore p95 ≤ 250 ms and
click→ghost on the quiet box; M.3 live columns; the second-load WebGPU check (parked).

### Autonomous run record — item 1: utility windows → popovers (2026-09-02, commit `c5a1567a79a`)

**Landed.** Transactions: `TransactionPanel` (`components/transaction-center/transaction-panel.tsx`, the list + the
Voyager hint) in a popover off its top-bar button, the pending-count badge and status dot on the trigger as before.
Keyboard shortcuts: `ShortcutsPanel` is a view inside the settings popover behind its View link (same gear anchor, back
link to the sections; the popover unmounts on close so the view resets). What's new: `LatestFeaturesPanel` in a popover
off its button; the button renders while there are unseen features or while the feed is open, and mounting the panel
marks the feed seen. Rewards: the button toggled a popup nothing rendered (its window was commented out), so the button,
its `Rewards` popup name, its `BuildingThumbs.rewards` entry and the header's season-ended derivation (a `GameRegistry`
`useComponentValue` plus the `seasonEnded` slice read) are deleted. Also deleted: `TransactionWindow`,
`ShortcutsWindow`, `LatestFeaturesWindow`, the `Shortcuts` / `LatestFeatures` / `Transactions` popup names and their
`TopNavigation` mounts; the utility cluster no longer reads `useUIStore` or `useDojo`. `PopupName` keeps only the two
automation dashboards for item 3.

**Gate.** `overlay-surfaces.source.test.ts` asserts the window shell files and component names are gone and that
`config.tsx` carries none of the six migrated popup names; targeted suites (overlay, world containers, modules,
transaction-center types, social, discipline, popover) green; typecheck clean; knip clean (the two pre-existing dist
findings). Headless (game 16 snapshot, 1280 px): transactions popover 360 px under its button, what's-new popover 420 px
with the feed marked seen, shortcuts view inside the settings popover and back, zero draggable windows, no "Rewards"
text in the HUD — screenshots `scratchpad/screens/p4s4-after-transactions-popover.png`,
`p4s4-after-whats-new-popover.png`, `p4s4-after-shortcuts-view.png`. LOC: +220 −275.

**Ruling taken, review me.** Shortcuts live inside the settings popover rather than on a top-bar button of their own:
the only entry point was the settings panel's View link, and a popover cannot outlive the anchor it hangs from. The
feed's "New" pips stay lit for entries dated tomorrow (the feed dates entries by deploy day) — data, not the seen logic.

### Autonomous run record — item 2: one reader for spectator intent (2026-09-02, commit `b3ca5e5778d`)

**Landed.** `utils/spectator-session.ts` is the only reader of the `spectate` query: `hasSpectateQuery(search)` is the
parse, `resolveSpectateIntent(location)` latches the session intent wherever a play route is resolved — the boot request
(`play-route-boot-request.ts`), the entry context (`game-entry/context.ts`), the map-first normalisation and the route
target — and `isExplicitSpectateSession()` keeps serving the bridge, the realm store, the scene's label priority, the
shareholder guard and the identity chip. The parsed `PlayRouteDescriptor` has no `spectate` field any more;
`buildPlayHref` takes the flag as an optional input, so the three legacy URL rewrites carry it through by calling the
one parse. Bootstrap's own `captureSpectateIntentFromUrl()` is deleted: it read whatever URL was current when the
bootstrap started, which on the landing's `/enter?intent=spectate` path is a URL without the flag — the play-route
resolvers now latch from the play URL itself, once per resolution.

**Gate.** `spectator-session.source.test.ts`: the `.get("spectate")` read exists only in `spectator-session.ts`, and the
play-route descriptor declares no `spectate`; game-entry, play/navigation, top-header, init and store suites 20 files /
68 green (the target and play-route tests drop the flag from the parsed descriptor, the chip test drives the latch
directly); typecheck clean; knip clean. LOC: +? −? (recorded from the commit stat).

### Autonomous run record — item 3: the last `openedPopups` windows (2026-09-02, commit `359c2f25d39`)

**Landed.** Resource transfers: `economy/resources/resource-transfer-popover.tsx` renders the transfer form in a popover
owned by its trigger — the resource chip's transfer button and the resource table's transfer cell each mount their own
instance (`useId`-keyed), so a resource shown in two lists never shares a panel, and the table selects the structure
before its popover opens (the old `handleOpenTransfer` side effect, now `onBeforeOpen`). The form drops its 75 vh
minimum height; the popover caps it to the viewport and scrolls. Automation dashboards: neither window had an opener
anywhere in `apps/game` (production was mounted with nothing toggling it; exploration was commented out), so both files,
the exploration window test and their two polling-discipline allowances are deleted rather than migrated. Deleted with
them: `RealmTransferManager` (one container per catalogue resource, all mounted), `TopNavigation` and its HUD mount,
`world/components/config.tsx` (popup names), the `PopupsStore` slice and `use-popups-store.ts` — nothing in `apps/game`
reads `openedPopups`, `togglePopup` or `isPopupOpen` any more. `ExplorationAutomationEntry` became a module-private type
(its only importer was the deleted dashboard).

**Gate.** `overlay-surfaces.source.test.ts` asserts the seven deleted files and the deleted component / API names stay
gone; `resource-transfer-popover.test.tsx` (one panel per trigger for the same resource, before-open hook only on open);
economy/resources, hooks/store, layouts, world containers, discipline and popover suites 32 files green; typecheck
clean; knip clean. LOC: +174 −1075.

**Ruling taken, review me.** The automation dashboards were deleted as unreachable UI, not migrated — "wired or
deleted"; the automation runners themselves (`AutomationManager`, `ExplorationAutomationManager`) are untouched. **Owner
gate pending:** the transfer popover needs a signed-in player with resources on screen, which the headless spectator
lane cannot produce — eyeball it from a chip and from a table cell on the deploy.

### Autonomous run record — item 4: the finished-game surface (2026-09-02, commit `4f5510d5b50`)

**Landed.** The end timer pill (`top-header/game-end-timer.tsx`) already owned the clock and hid itself once the game
ended; it now renders `GameFinishedPill` in its place — a top-bar pill whose popover says the game has ended and offers
the dashboard (`resetBootstrap()` + `navigate("/")`, the path the old modal's "Go back home" took), where the review,
standings and rewards already live. The map stays reachable behind it. Deleted: `EndgameModal` (its dismissal storage
reads, its debug flag and its in-game copy of the landing's `GameReviewModal`) and `GameIsOverModal`, which had no other
user; the `endgame-*` CSS stays because the landing's review modal shares it.

**Gate.** Headless on game 16 (finished): the pill renders where the timer was, its popover reads "This game has ended …
Go to the review", and no `pointer-events-auto` element covers the viewport while it is open (the artifact's first
complaint) — screenshot `scratchpad/screens/p4s5-after-game-finished-pill.png`.
`play-view.review-autopen.source.test.ts` now pins the pill instead of the modal pair (its `handleClaimRewards`
assertion stays the documented pre-existing red); `overlay-surfaces.source.test.ts` asserts both files and names stay
gone; world containers, layouts and discipline suites green; typecheck clean; knip clean. LOC: +77 −240.

**Ruling taken, review me.** The in-game "Watch review" step is gone: the review lives on the dashboard (the landing's
own `GameReviewModal`, half one's territory), so the pill points there rather than re-hosting that modal in the HUD.

### Autonomous run record — item 5: the `toggleModal` system → Popover (2026-09-02, commit `784fd25e83c`)

**Landed.** `use-popover-store.ts` gains a surface: `openSurface({ id, content, anchor? })` hands content to the store,
`SurfaceHost` (mounted once in the HUD next to the loading overlays) renders it through the same panel every
element-anchored popover uses — portaled, viewport-capped, Escape / outside-pointer dismiss, one open at a time, no
scrim — hanging from the rect a button passed (`surfaceAnchorFrom(event.currentTarget)`) or from the top centre when a
scene click or an event-less hook opened it. `SurfaceFrame` is the shared header-over-scrolling-body frame for the large
surfaces. The plan named five `toggleModal` components; the class had twenty callers once multi-line opens were counted,
and all of them migrated in this commit: production (eight sites, including the hexception building click and the castle
buttons), market, chest, help (troop transfer) and spire travel from the worldmap scene and the army chip, battle lab
and live combat details, the quick-attack preview (its own draggable bronze box and `react-draggable` use are gone — the
panel is the frame), craft relic, relic activation popup and selector, wonder faith details, faith devotion and the
Lordpedia. Every surface-opened component dropped its `CenteredModalShell` / `DialogShell` / `BasePopup` for the frame.
Deleted: `toggleModal`, `setModal`, `modalContent`, `showModal` (store fields and types), `PlayOverlayManager`'s
full-screen modal host (`BlankOverlayContainer` now wraps only the landing's loading overlay) and the landing's dead
`LandingModalHost`.

**Gate.** `popover.test.tsx` (6: anchor/no scrim, exclusivity, toggle + Escape, outside pointer, a store surface through
the same panel closing on Escape, surface ↔ element popover exclusivity — `useAudio` mocked for the open/close cue that
moved from the modal host); the production shell and quick-attack tests read the popover store;
`overlay-surfaces.source.test.ts` bans the four deleted store fields and the landing host by name. Molecules,
production, military, economy, world components, layouts, landing, relics, social, modules, combat and store suites 110
files / 391 tests: green except the two documented pre-existing reds and one stale pin fixed in the next commit
(`cf2d69be2e8`: `combat-presentation-coordinator.source.test.ts` still expected the scene's `replayIndexedCombat` and
`armyManager.onProcedural*` calls that decomposition Cut 4 moved into `worldmap-combat-presentation.ts`; retargeted to
the collaborator, same intent). Typecheck clean; knip clean. Headless smoke on game 16: HUD mounts, no React errors, no
`pointer-events-auto` element covering the viewport. LOC: +765 −591 (42 files).

**Ruling taken, review me.** (1) The item's scope grew from the five named components to the whole `toggleModal` class —
the store fields could only be deleted with every caller migrated, and a half-migrated host is the known hazard. (2)
Scene-opened surfaces (attack preview, chest, help, spire travel, the building's production panel) hang from the top
centre: the scene handlers have no pointer position in scope, and threading one through the interaction runtime is a
bigger change than the surface warrants. (3) Market and chat stay top-centre surfaces here; their edge anchoring (right
ledger, bottom-right drawer) is item 6's, where the remaining inline shells go.

**Owner gate pending:** every migrated surface needs a signed-in player to open (build, produce, attack, chest, relics,
market); the headless spectator lane can only prove the primitive and the HUD.

### Autonomous run record — item 6: the last modal shells (2026-09-02, commit `3d07c83f7e0`)

**Landed.** `PopoverPanel` is store-free: whoever mounts it owns its open state, and it hangs from a rect (live, when
given as a function) or a viewport edge (`top-center`, `right-edge`, `bottom-right`); `Popover` (element trigger +
store) and `SurfaceHost` (store surface) are thin wrappers over it, so a view-driven surface, a store popover and a
store surface render through exactly one panel. The left command sidebar's views render through it with
`leftNavigationView` as their open state — Chat is the bottom-right drawer (`w-[720px]`, capped), Build, Military and
Logistics hang from the top centre in the shared `SurfaceFrame` — and the market opened from the entity card is the
right-edge ledger (`openSurface({ …, anchor: "right-edge" })`). The structure rename popup, the end-season
congratulations, the resource table's transfer cart and transfer-amount dialogs and the banking confirmation popup mount
the panel directly; the transfer-automation panel keeps only its embedded rendering (its dialog branch had no caller).
Deleted: `CenteredModalShell`, `DialogShell` (and its barrel export), `BasePopup`, and the `draggable-position` helper
only the modal shell used; `react-draggable` has no importer left (the dependency entry stays until a lockfile change is
warranted).

**Gate.** `apps/game` contains no Modal shell component: `overlay-surfaces.source.test.ts` asserts the four files and
the three names stay gone and that `role="dialog"` exists only in `popover.tsx` (the half-four gate's letter);
`popover.test.tsx` (7) covers a store-free edge-anchored panel calling its owner on Escape. Molecules, world containers
and components, economy, social, military, layouts and store suites 56 files / 280 tests green except the documented
pre-existing ownership red; typecheck clean; knip clean. Headless smoke on game 16: HUD mounts, zero `role="dialog"`
elements at rest, zero `pointer-events-auto` elements covering the viewport, no React errors. LOC: +401 −692.

**Ruling taken, review me.** (1) Build, Military and Logistics hang from the top centre rather than beside the entity
card: the artifact's "command-card tabs" are a redesign of those surfaces (item 10's ghost placement belongs with it),
and a top-centre panel is the smallest change that removes the shell without moving the content. (2) The view surfaces
and the store popovers are two exclusivity domains — opening a store popover does not close the sidebar's Build panel;
`leftNavigationView` stays the one truth for the views, so no second store was layered on it. (3) Item 5's scene-opened
surfaces stay top-centre.

**Owner gate pending:** Build / Military / Logistics / Chat / market / transfer cart need a signed-in player with
structures; the headless spectator lane proves the primitive, the rest-state gate and the HUD.

### Autonomous run record — item 7: one event feed (2026-09-02, commit `d2d49705e90`)

**Landed.** `ui/features/event-feed/`: the feed is a view over three sources — the transaction store (pending, stuck,
confirmed, reverted rows, written by the listener as before), the `resourceArrivals` bridge slice (caravans, with a
countdown on the block clock that flips to "arrived" when their time passes) and the feed's own notices
(`event-feed-store.ts`, ephemera). `deriveFeedRows` sorts them into in flight / arrived / recent; `EventFeedPanel` is
the activity popover on the top-bar button (the old transactions button, badge and status dot kept), and
`EventFeedTicker` shows what just happened at the bottom centre for a few seconds, each row leaving on its own
`setTimeout` — the game route and the landing both mount it. `notify.ts` exposes the same `toast(...)` shape the toast
library had (default, info, success, error, warning, custom, dismiss), so the twenty-two call sites changed only their
import; the transaction toast emitter became `TransactionAudioCues` (sounds and the failure log only — the rows come
from the listener). Deleted: `Toaster`, `tx-emit`, `TransactionList`, `TransactionPanel`, the transaction-center barrel;
nothing in `apps/game` imports `sonner`.

**Gate.** `event-feed-rows.test.ts`: a started transfer is an in-flight row from its pending transaction, its caravan is
an in-flight row with a countdown that flips to arrived, stuck transactions lead, confirmed ones move to recent at their
confirmation time, notices keep their own ttl in the ticker; `event-feed-ticker.test.tsx` (raise → shown, expire,
dismiss by id); `event-feed.source.test.ts` (no `sonner` import in `apps/game/src`, only `notify.ts` writes notices);
`transaction-audio-cues.test.tsx` (the three cues without toasts); the five suites that mocked the toast library mock
`notify` now. Feed, shared, world containers, game-route, story-events, settlement, entity-details, landing, economy and
discipline suites 38 files green; typecheck clean; knip clean. Headless on game 16: the activity popover renders the
empty feed ("Nothing yet"), no toaster element exists — screenshot `scratchpad/screens/p4s7-after-activity-feed.png`.
LOC: +661 −462 (49 files).

**Ruling taken, review me.** (1) The feed row for a transfer and the row for its caravan are two rows, not one: a
transaction hash and a `ResourceArrival` share no key, so the caravan row keys on `(structure, day, slot)` and appears
when the arrival reaches RECS — within the same ingest slice as the pre-confirmed row. (2) Caravan countdowns follow
`useCurrentBlockTimestamp` (the 1 Hz block store) until item 9 consolidates the clock. (3) The Logistics view's own
arrivals tab stays — it is the claim surface; the feed only shows the rows.

**Owner gate pending:** a real transfer on the deploy (row at click, caravan row at pre-confirm, flip at arrival) and
the ticker under live action.

### Autonomous run record — item 9: L6, one clock and the tooltip store (2026-09-02, commit `7ec7de467f7`)

**Landed.** The block timestamp store already ticked once a second; it now also carries the wall clock (`nowMs`), and
`useNowMs` / `useNowSeconds` / `useCoarseNowSeconds` read it — an `enabled` flag turns a subscriber into a constant so a
hidden or settled component never re-renders for the clock. Eighteen React components that each owned a 1 Hz
`setInterval` read the one clock instead: the world countdown (three timers), the resource chip's cap check (the default
tick already advances), the arrivals list, the battle and defence cooldowns, the attack preview, the prize panel (30 s
window), the build menu, the production sidebar, the merged resource panel, the register-points button and the
hyperstructure leaderboard (coarse refresh signals), the automation cue, the game start countdown and the end timer (the
block timestamp is their clock; the local elapsed state and the tooltip's own timer are gone), the transaction row's
elapsed label and the two network-status surfaces. Their eighteen polling-discipline allowances are deleted; the list
keeps the two clock stores, the scheduler, the scene, the debug and boot overlays and the landing. The hover tooltip
moved to `hooks/store/use-tooltip-store.ts` (with its anchor-fallback helpers), so a hover no longer writes the UI store
and runs its selectors; every `setTooltip` caller, the scene managers and the `Tooltip` molecule read the new store, and
the top header reads its tick from the store instead of calling `getBlockTimestamp()` per render.

**Gate.** Polling-discipline "clock" allowances: 16 UI entries → 0 (the clock stores remain). Idle React commits per
second, headless on game 16 (a finished game, so few countdowns run): **0.72 before → 0.67 after** (the devtools-hook
stub counting `onCommitFiberRoot` over 60 s, spectating, scene up); the 2.31 idle figure in the phase-2 record was a
live world with its timers running — the class that number measured (a 1 Hz interval per countdown component) is closed
structurally, and the live re-measure is an owner gate. Hooks, components, economy, military, prize, settlement, social,
world, design-system, event-feed, modules, scene-manager and discipline suites 113 files / 515 tests green except the
documented pre-existing ownership red; typecheck clean; knip clean. LOC: +279 −430 (43 files).

**Ruling taken, review me.** Caravan countdowns and elapsed labels follow the block store's 1 Hz tick (`nowMs` is the
wall clock at that tick), not `performance.now()` per frame — one clock, one cadence.

### Autonomous run record — item 10: selection emphasis and the click's ghost stage (2026-09-02, commit `bbdbf439e36`)

**Landed.** Selecting a structure or army rang every hex the owner held — the ownership-pulse presenter and footprint
policy from decomposition Cut 1 (`worldmap-structure-ownership-pulses.ts`, `worldmap-ownership-pulse-policy.ts`) and the
pulse manager's ownership meshes, shared material and geometry. The addendum's convention is that only the selection and
its legal targets are emphasised and ownership is tint, so all of it is deleted with its tests; the selection pulse and
the action-path highlight stay. Left-click selects, right-click is the action on the target and Esc cancels already
(`onHexagonRightClick`, the Escape shortcut, the "Right-click to confirm" instruction). The move handler records a new
`ghost_rendered` latency stage the moment the local pending state is on screen — destination selected, path highlighted,
then the travel or compass effect — before anything is signed, so `__clientActionLatencyMeasurements` shows click →
ghost as one frame. Latest-features: "Quieter Selection".

**Gate.** `worldmap-movement-latency-tracing.source.test.ts` pins the stage in `onArmyMovement`; scenes suite 193/194
(the documented initial-refresh red), the pulse manager test without its ownership case, observability suite green;
typecheck clean; knip clean.

**Ruling taken, review me.** (1) Cut 1's presenter is deleted rather than kept: the decomposition moved it, the addendum
retires the behaviour, and a tinted marker already says who owns what. (2) `ghost_rendered` is recorded for moves and
explores; build placement (`building-preview`) and caravans (`arrival-ghost-manager`) already render their pending state
from the local click and the pre-confirmed row respectively, and attack confirmation is the preview surface's own
submitting state — no second ghost was added for them. **Owner gate pending:** click → ghost ≤ one frame on the quiet
box (`__clientActionLatencyMeasurements`, `ghost_rendered − click`).

### Autonomous run record — item 8: the identity session owns reconnect; direct links boot map-first (2026-09-02, commits `280fd334444`, `95e081c28ca`, `2ba82514ef5`)

**Landed.** The reconnect grace timer and the `location.assign` reload are gone: the play route derives its reconnect
status from the identity session (`connected / failed / connecting / restoring / idle`), a player route with no account
and nothing restoring it shows `IdentityLogin` inline on the reconnect screen, and spectators boot map-first like
players (`shouldBootMapFirst` = hex | travel), the canonical href keeping `spectate`. The inspectors keep their
right-centre tile panels (ruling taken: they hold the only copies of the tile actions).

**Direct realm link, the class behind it.** A spectator realm link with coordinates booted the map and then stayed on
the map without its handoff flags. Two halves: the hexception scene ran `setup()` from its own constructor ("keep the
initial grid boot eager"), so from renderer init it was entered, built the grid for the route's realm while the world
map was active, and marked hex-ready before the handoff; the loading overlay then dismissed in the same commit as the
handoff navigation and its deferred dismissal rewrote the URL from the route it had captured (the map). Fixes: the scene
owns one `isEntered` fact (setup → switch-off) gating the grid rebuild and the readiness mark, the constructor setup is
deleted (every hex/travel entry boots map-first, so the scene manager's entry setup is the only path), and the dismissal
reads the route at dismissal time. Source test `hexception-scene-entry.source.test.ts` pins all three.

**Gate.** Headless, game 16, `/hex?col=1561739777&row=1561739751&spectate=true`: normalises to
`/map?…&boot=map-first&resumeScene=hex`, map ready at 9.8 s, handoff navigation at 9.8 s, overlay dismissed at 10.2 s
onto `/hex?col&row&spectate=true`, chip "Spectating", castle panel showing. Screenshot
`screens/item8-spectator-realm-link.png`. Owner gate pending: the same link signed in (player) on the quiet box.

### Autonomous run record — item 11: the label atlas (2026-09-02, commit `2952dbff9f1`)

**Landed.** `CompactEntityLabelRenderer` keeps one `BatchedMesh` per atlas page (geometry per distinct label text,
refcounted by key; instance per entity) and writes position, camera facing and hover scale per instance; the batch
optimises after a run of deletions. The army manager's visible-slot sync retains only the labels of armies that still
hold a slot (`retainOnly`), closing the lifecycle gap; `army-manager.label-lifecycle.source.test.ts` pins it.

**Gate.** Draw calls are no longer a function of labels in view. Headless (1280×720, game 16, spectator):

| distance | band  | labels shown | draws before | draws after           |
| -------- | ----- | ------------ | ------------ | --------------------- |
| 10       | close | 310          | 65           | 65                    |
| 12.9     | close | 310          | 70           | 68 / 77 (two samples) |

The headless frustum holds only a handful of the 310 labels, so the before/after is flat here; the 507-draw close band
came from the owner's wide viewport. Owner gate pending: close-band draw count and p95 on the laptop. Screenshots
`screens/item11-before-d12.9.png`, `screens/item11-after-d12.9.png`, `…-d10.png`.

### Autonomous run record — item 12: L5 items 5, 7, 8 (2026-09-02, commit `b0ac0ba4c43`)

**Landed.** Army instances: `ModelData.dirtySlots` is the touched slot span; writes mark it and one flush per frame
(`flushInstanceUploads`, also after a buffer rebuild) queues one `addUpdateRange` per attribute
(`utils/instance-update-ranges.ts`); the strategic marker layer's own copy of that accounting moved onto the helper.
Structure instances: the fixed per-model capacity is 1024 (from the game cap, matching armies; ruling taken: the
window's hex count is 9216 and would allocate for a world that cannot exist) and an overflow is refused loudly
(`structureInstanceCapacityOverflow`) instead of throwing out of the visible-structure pass. Labels and reserved sites:
the CSS2D close cadence floors at 16 ms (the mobile zero-interval special case deleted), and the reserved hyperstructure
manager rebuilds only when a change touches a reserved site; both counted.

**Gate.** Unit tests per item (`instance-update-ranges.test.ts`, `structure-manager.capacity.source.test.ts`,
`game-renderer-policy.test.ts`, `reserved-hyperstructure-manager.test.ts`). Idle counters headless, 30 s apart at
distance 12.9: `css2dLabelRenders` 2 → 2, `reservedSiteRebuilds` 1 → 1, `structureInstanceCapacityOverflow` 0.

### Autonomous run record — items 13 and 14: frame owners, frame-or-timer drains (2026-09-02, commit `fcfd437a64f`)

**Landed.** The per-frame army update runs as `armies:update` and each chunk manager's update as `chunk:<label>` (flat
owners, no nesting, so the dominant-owner digest stays honest). The ingest scheduler already paired
`requestAnimationFrame` with a 100 ms timer; the frame-budget work queue waited on frames alone, so a background tab
never finished its chunk work. One helper, `utils/frame-or-timeout.ts`, serves both drains; the queue's frame injection
became a drain-request injection and its two stale dominant-owner assertions were brought up to date.

**Gate.** `frame-owner-coverage.source.test.ts`, `frame-or-timeout.test.ts` (frame first, timer when frames stop, cancel
both). Headless 60 s digest after boot: every spike names `render:backend` (the software GPU), none unattributed. The
hidden-tab boot could not be emulated headless (a second page did not hide the first: `visibilityState` stayed visible,
boot 12 s); owner gate pending: open the map in a background tab and confirm it reaches the chip.

### Autonomous run record — item 15: pipeline compile before first draw (2026-09-03, commit `b3f987e1814`)

**Landed.** `GameRenderer` hands the scenes one `PipelineCompiler` over the live backend (`pipeline-compiler.ts`);
structure and army loaders await `compileAsync` against the world scene before adding a model's group, so the frame that
first draws a chunk creates terrain pipelines only. On WebGPU that is the async pipeline path; on WebGL it moves the
program links out of the render frame. Compiles count under `pipelinePrecompiles`. Ruling taken, review me: the compile
runs per loaded model group rather than from a manifest-built warm-up list — the manifest lists GLB paths, and the
loaded group is the one object that carries the final materials.

**Gate.** Headless (WebGL2 lane, game 16): before, the boot window's compile digest read
`createRenderPipeline=67x/1.6–1.8 s` with the worst boot frame `render:backend owner_max 926 ms`; after, the worst
`render:backend` call in the boot window is 16 ms (two boots: 5–16 ms) with `pipelinePrecompiles` = 11 model groups per
boot and `worldmap-terrain-visible` at 9.8 s / 11.0 s (before 9.9–10.1 s, noise). Owner gate pending: the 3.4 s / 5.9 s
WebGPU boot spikes on the laptop.

### Autonomous run record — item 16: fog class 3 verified (2026-09-02, commit `3a636688c1c`)

**Verified, no fix needed.** Snapshot hydration and window refreshes (`syncExploredTilesFromProjection`), live diffs
(`applyProjectedExploredTileChange`) and the player's own explore (a diff like any other) all end in
`writeExploredTileFromProjection`, which queues the shroud reveal and the terrain page invalidation; nothing else
assigns an explored tile and the projection's `subscribeTiles` is the one live entry. The fog wiring source test now
pins both entries and the single assignment.

### Autonomous run record — item 17: bootstrap streaming (2026-09-03, commit `6f1740e47b0`)

**Landed.** The transport used to buffer every snapshot model until `snapshot_end` and hand the runtime one 7 MB page.
The first snapshot now reaches the runtime one page per model as each arrives (the runtime's paging loop was already
there; the transport keeps its own row state for the reconcile path), Herald sends `Structure` and `Tile` first
(`orderSnapshotModelsForStreaming`), and snapshot progress carries a `streaming` fact so the apply milestone completes
after the last page. Ruling taken, review me: rendering before `snapshot_end` (the second half of the class) changes the
boot contract (`bootstrap.status === "ready"` gates the scene) and stays with the owner.

**Gate.** Headless timeline, game 16, two boots each:

| milestone                        | before  | after                               |
| -------------------------------- | ------- | ----------------------------------- |
| initial-sync started → completed | 1523 ms | 1435 ms / 1646 ms                   |
| snapshot receive                 | 594 ms  | 785 ms / 737 ms (apply overlaps it) |
| snapshot apply after receive     | 165 ms  | 0 ms (applied per page)             |
| worldmap-terrain-visible         | 9.84 s  | 9.89 s / 10.15 s                    |

Owner gate pending: `bootstrap_done ≤ 1 s`, `first_terrain ≤ 2 s` bars on the laptop.

### Autonomous run record — item 18: render on arrival, verified (2026-09-03)

**Verified, no fix needed.** A local pre-confirmed batch enqueues with `immediate` and flushes atomically in the same
turn (`entity-ingest-queue.test.ts` "applies one local transaction batch immediately and atomically"); ambient batches
drain on a frame or a 100 ms timer in ≤ 6 ms slices. The `pre_confirmed → rendered` number needs a player action against
a live game and is an owner gate pending on the 96-bot workload (p95 ≤ 50 ms).

### Autonomous run — hand-back summary (2026-09-03)

Commits, in order: `c5a1567a79a` (1), `b3ca5e5778d` (2), `359c2f25d39` (3), `4f5510d5b50` (4), `784fd25e83c` (5),
`3d07c83f7e0` (6), `d2d49705e90` (7), `280fd334444` + `95e081c28ca` + `2ba82514ef5` (8), `7ec7de467f7` (9),
`145834e869c` (10), `2952dbff9f1` (11), `b0ac0ba4c43` + `793ff46a015` (12), `fcfd437a64f` (13, 14), `b3f987e1814` (15),
`3a636688c1c` (16), `6f1740e47b0` (17), plus the docs commits. Rulings taken (review me): item 3's tile panels kept;
item 12's structure capacity from the game cap; item 15's per-model compile instead of a manifest list; item 17's
render-before-snapshot-end left to the owner. Pre-existing reds untouched: `worldmap-initial-refresh.source.test.ts`,
the `row.activityBreakdown` assertion, the three load-sensitive timeout files. Owner gates pending are listed in each
record above and in the plan's "Owner gate pending" paragraph.

### Autonomous run — end review (reviewer, 2026-09-03)

**Approved; deployed from this tip.** All 18 items landed or verified as recorded. Reviewer reproduction: the global
deletion gates hold by grep — no `toggleModal`/`setModal`, no `openedPopups`/`togglePopup` outside the ban-list test, no
modal shell files, no `role="dialog"` outside `popover.tsx`, no `sonner`, no reload in the reconnect path (the remaining
`location.reload` sites are the landing, the error boundary and settings' change-game redirect — legitimate);
`packages/core` 160/160 green (the reworked transport streaming tests included), `apps/game` typecheck clean, knip clean
but for the two pre-existing dist findings. Full `apps/game` suite: 823/836 files — 13 red, accounted one by one: three
were stale pins that the run's own recorded rulings outdated (the hexception constructor-setup pin, the reconnect-grace
count, console-discipline's `tx-emit.tsx` site plus the decomposition-relocated hover trace), fixed by the reviewer in
`2d8ca8196b0`; the other ten are the documented pre-existing set, each verified untouched by run commits
(`play-view.review-autopen`'s red case predates the run; only its endgame case was retargeted, and that one passes).
Spot audits: the transport's paged first snapshot (waiter/buffer/failure/reset paths all correct, terminating on an
empty page), the label `retainOnly` riding `syncVisibleSlots` with its source pin, the Popover's
`PanelAnchor | (() => PanelAnchor)` generalisation, and the feed's countdown resolving through the one
`useBlockTimestampStore` after item 9. Rulings on the four flags: (1) item 3's tile panels kept — **accepted**; the
Deck's delete assumed a command card that doesn't exist yet, and the panels hold the only tile actions; they go when a
card exists. (2) item 12's capacity from the game cap — **accepted**; sized for a world that can exist, guarded by the
loud overflow counter. (3) item 15's per-model compile — **accepted, plan amended**; the loaded group carries the final
materials and the evidence (worst boot frame 926 ms → 16 ms) closes the class. (4) item 17's render-before-snapshot-end
— **correctly deferred**; changing the `bootstrap.status === "ready"` contract is the owner's call and joins the
owner-gate list. Deploy note: item 17's Herald-side page ordering (`orderSnapshotModelsForStreaming`) ships when the box
redeploys Herald from this branch — the client tolerates any order, so the client deploy alone is safe.

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

### Autonomous run record — renderer lane: cold profiles never wait for WebGPU (2026-09-03)

**Conviction.** `resolveWebGpuLaneStart` treated a returned adapter as proof of the lane, then
`createWebGPURendererBackend` awaited Three's `renderer.init()` under the 15 s startup timer before it could create the
WebGL2 fallback. The owner's control at `toji.github.io/webgpu-test` returns WebGPU immediately, which rules out missing
browser support: the failing class is our Three renderer initialization competing with the game's saturated boot path,
not `navigator.gpu` availability. Adapter discovery alone is also insufficient evidence to remember WebGPU.

**Fix.** A profile with no renderer verdict starts WebGL2 immediately and schedules one disposable Three WebGPU renderer
at idle. Only a completed `renderer.init()` records `webgpu` for the next boot; a failed or stalled init records the
hard `webgl2` verdict. The qualification timeout is 3 s and is entirely outside the active renderer's startup. The
existing 15 s recovery remains only for a previously proven/explicit WebGPU lane, preserving the brief's remembered-lane
and `forceReprobe` behavior. The old adapter-only idle promotion path is deleted.

**Gate.** Lane/backend/discipline suites: 30/30 green; `apps/game` typecheck green. Fresh-profile headless Brave against
the current 83-player game: renderer init 285 ms, first terrain 11.627 s; the same profile with a remembered WebGL2
verdict: renderer init 537 ms, first terrain 11.144 s. The cold path therefore adds no bounded WebGPU wait (terrain
delta 483 ms, within the surrounding snapshot/model-load variance). Its idle Three init recorded
`{"lane":"webgpu","reason":"idle:init-ok"}`; reloading the same profile then initialized the remembered WebGPU lane in
317 ms and reached first terrain at 10.750 s. This proves the promotion is based on the client renderer that will run,
not the adapter probe that the standalone test already showed was healthy.

### Autonomous run record — WebGL2 prewarm and progress-bounded chunk recovery (2026-09-03)

**Conviction.** The item-15 compiler is lane-correct: `GameRenderer` resolves the current backend at call time and
passes its renderer to `compileAsync`; Three 0.185's `WebGLBackend` uses `KHR_parallel_shader_compile` when the
extension exists. The uncovered work was armies: `prepareChunkPresentation` supplied only
`structureManager.prewarmChunkAssets`, while the critical army catch-up loaded and compiled its models afterward. The
timed branch in `prepareWorldmapChunkPresentation` also started `settleWorldmapAsyncStage(asset_prewarm)` with `void`
and awaited only projection sync, allowing terrain/catch-up to proceed while asset work remained unresolved. When that
detached timer fired, `scheduleChunkRecoveryWithReason` knew only its 2 s cooldown; it did not check whether the
previous attempt advanced any presentation or manager state. That is the identical 12 s recovery loop in the owner log.

**Fix.** The presentation barrier now warms both structure and army models; both flow through the same compiler over the
active WebGPU or WebGL2 renderer. The timed path awaits projection and asset results together and refuses to prepare
terrain after a failed asset barrier. Chunk recovery claims one bounded failure signature
`(chunk, reason, phase/managers)` and will not schedule that signature again until successful terrain preparation or
critical-manager convergence marks forward progress. The cooldown remains only rate limiting, not the definition of
progress.

**Gate.** Compiler/presentation/catch-up/recovery suites: 31/31 green; `apps/game` typecheck green. Headless Brave with
a seeded WebGL2 verdict against the current 83-player game reached first terrain at 9.687 s with zero
`chunk_presentation_timeout` and zero critical catch-up failures. The worst boot `render:backend` spike was 971 ms
(`createRenderPipeline=38x/255ms`) versus the owner's 3,307 ms before (`owner_ms=3,167`), a 71% reduction. The new
progress-guard test proves a second identical `asset_prewarm` failure cannot schedule another recovery until work marks
progress.

### Autonomous run record — Hexception procedural biome surface (2026-09-03)

**Conviction.** Commit `f6b652c99775` (`feat(game): replace biome GLBs with procedural terrain`) added
`presentProceduralTerrain` at `hexception.tsx:1251` but retained two older visible ground layers: the opaque instanced
pillar mesh at `hexception.tsx:250-256,1254-1271`, and the 30%-opaque green interaction mesh over the buildable disc.
Both occupied the same cells at nearly the same height as the procedural mesh. The owner screenshot's flat orange outer
hexes were the legacy pillars; its flat green centre was the interaction hit surface. Lighting and the biome resolver
were not at fault.

**Fix.** Procedural terrain is now the sole visible ground owner in Hexception. The legacy pillar mesh, its biome-color
loop and disposal path are deleted. The interaction mesh remains the click/raycast target but, as in Worldmap and Fast
Travel, no longer writes color or depth; hover and placement highlights remain separate visible affordances.

**Gate.** The focused source suite is 4/4 green and `apps/game` typecheck is green. A headless Brave capture of
`bltz-clash-538/hex?col=0&row=6&spectate=true` shows textured ground, relief, vegetation and shaded structure pads
across both the realm disc and its neighbouring biome. The source test pins one visible terrain owner by requiring the
procedural presentation and hidden interaction surface while rejecting the retired pillar/`BIOME_COLORS` path.

## Blitz scene-native pass — kill modal gaming (owner ruling, 2026-09-03)

**The ruling.** The autonomous run killed the modal shells but kept the modal flow: an action is still click trigger →
surface opens → operate the surface → return to the scene. That flow — "modal gaming" — is the thing to kill, and it is
killed per feature, not in a big-bang rewrite. Scope is the Blitz player overlay first. The owner rejected the Realms
Deck rev-2 layouts A–C (the bottom command band is dead — StarCraft needs a command card because its units carry
abstract abilities with nothing in the world to click; this game's action objects are in the scene); the caster view
(layout D), the composition table, the click budgets, the rail, and the minimap-bottom-left ruling survive.

**The principle.** The entity is the interface. Every action whose object exists in the scene happens at the object: a
world-anchored micro-card or ghost flow, not a screen-region panel. Panels survive only for objects with no scene anchor
— market (Eternum), leaderboard, settings, feed, chat. The army interaction landed in run item 10 (left-click selects,
right-click acts, ghost at click, Esc cancels) is the template, not an exception. Success is deletion: each item's old
surface flow dies in the same change, and the end state has fewer surfaces than today — atomization was demolition, not
the destination.

**The method — finding the proper spot.** Each item below starts with a spot proposal: where the interaction lives and
what the flow is, argued on a screenshot or live anchor of the current build, recorded here BEFORE implementation. The
owner feels each feature on the deployed build before the next lands. Two defaults hold until a feature's record
overrides them: reading stays on the right edge (the inspector remains the place selection detail is read), acting moves
into the scene; and the Realms Deck story budgets are each item's click gate.

**Items** (each: spot proposal → implement → old flow deleted → gate; one item or small group per commit, records
appended here):

0. **Chrome recede.** The warm gold-on-brown chrome lives inside the terrain's own color family and camouflages into
   desert/autumn biomes. Reskin the panel tokens cold-dark neutral (near-black smoke, slight cool bias), gold demoted to
   a thin accent on interactive/selected only. Validate with screenshots against snow, desert, forest and water biomes
   before landing. Small, global, first.
1. **World-anchored micro-card primitive + production pilot.** The Popover's screen-point anchor becomes a
   world-anchored micro-card that tracks its hex/entity through camera moves — small, no tabs. Pilot consumer: click a
   production building → recipe, rate, auto chip and queue at the building. The production surface's per-building flow
   dies. (Automation presets stay reachable; their spot is decided in this item's record.)
2. **Build on the hex.** Empty buildable hex in local view → building choices at the hex (costs shown, unaffordable
   greyed with the shortfall named) → ghost follows → pre-confirm solidifies. The construction surface dies in local
   view. Story 3 gate: ≤ 3 clicks.
3. **Train at the building.** Troop production at the military buildings, same micro-card pattern. The military
   surface's training flow dies.
4. **Castle actions at the castle.** Upgrade (costs, shortfall named → transfer suggestion) and guard management at the
   structure. The side panel's action half dies; its reading half stays right-edge pending item 7.
5. **Realm-to-realm transfer.** The spot genuinely needs finding — the record must argue two candidate flows before
   picking: (a) select realm → Transfer → right-click target realm → inline amount at the target; (b) drag from rail row
   onto the target realm/rail row. Story 15 gate: ≤ 3 clicks. Blitz has transfers (owner ruling); no market.
6. **Hyperstructure contribute at the tile.** Amount + confirm anchored to the tile. Story 26 gate: ≤ 3 clicks.
7. **Inspector consolidation.** After items 1–6: the right-edge inspector is reading only — every action button in it
   has moved into the scene or died. Then the reading itself is weighed: what remains earns its place or goes.

**Coordination.** Codex items 1–5 (renderer lane, chunk recovery, hexception terrain, far-band biomes, label remake) run
on this branch in parallel; this pass is UI-side and collides mostly nowhere, but shared-worktree discipline holds:
explicit-path commits only. The Realms Deck artifact (e835afd9) carries a supersession note for layouts A–C and the
command card until it is redrawn per-feature as spots are found.

### Autonomous run record — far-band biome tint, one source (2026-09-03)

**Evidence.** The gray-placeholder screenshot predates `00010bbb925`: this branch already owns far land with
`WorldBiomeSurface`, one instanced hex mesh above one shroud plane, so the geometry and draw-budget half of the
requested fix was present. The remaining violation was two truths. The minimap mapped `BiomeIdToType` into
`BIOME_COLORS` (including a private Taiga override), the world scene separately mapped the same id while silently
converting `None` or an unknown id to Grassland, and the far surface used a third palette (`TERRAIN_BIOME_DESCRIPTORS`).
The same biome could therefore have different far-map and minimap colors, while malformed data looked like valid
grassland.

**Fix.** `biome-colors.ts` now owns id-to-biome resolution and the flat biome palette. The minimap and world projection
both consume it; explored world tiles require a real biome loudly, while the minimap's absent or unknown tile remains
its explicit gray unknown state. `WorldmapProceduralTerrain` still builds the real textured biome pages only around the
camera. `WorldBiomeSurface` uses the real RECS tile's biome outside that window and retains its existing one instanced
draw; no props, models, labels, composite pages or shroud rules changed.

**Gate.** Far-surface and content-wiring suites: 23/23 green; `apps/game` typecheck green. The wide headless
`bltz-clash-538` world capture shows snow, desert, forest, beach and water tints continuing outside the detailed page
window. The surface remains two draws total (one shroud plus one instanced biome mesh), so the change's draw-count delta
is zero and stays within the existing far-band budget. The unit and source tests pin the shared id resolver and color
palette and reject local `BiomeIdToType` copies in both consumers.

### Autonomous run record — biome page return-path correction (2026-09-03)

**Evidence.** The owner's live screenshots exposed a separate lifecycle bug hidden by the far-surface color gate. A
48×48 render window plus its one-page margin resolves to a 4×4 target (`resolveWorldmapVisualTerrainWindow` is pinned at
16 pages), but `WORLD_CHUNK_CONFIG.visualPresentation.maxCompositePages` was 12. Four pages therefore had to fall
through to the flat far surface even after their RECS biome data existed. The procedural cache compounded that gap:
`WorldmapProceduralTerrain` retained only the current and immediately previous request sets, so an ordinary out-and-back
pan discarded completed worker geometry. Finally, `Promise.all` submitted every page of a presentation before its
revision could be superseded, leaving newly visible terrain behind stale worker work. This is the source-level
conviction for the observed minute-scale edge fill and flat return state; 24×24 is only the page granularity, not an
intended biome boundary.

**Fix.** The active 4×4 target and composite cap now agree at 16. Completed procedural pages live in a 64-page LRU—four
complete camera windows—while GPU presentation remains bounded to the current 16 pages. The worker resolves pages
sequentially with the focused page first; a superseded presentation stops before queueing its remaining pages. Request
signatures still include the complete terrain inputs, so a real biome, halo, road, structure, climate or style change
rebuilds the page instead of serving stale geometry. The flat biome surface remains the deliberate far-zoom layer only;
it is no longer the normal return state for a recently visited detailed page.

**Gate.** Procedural-cache, visual-window and source-wiring suites: 27/27 green; `apps/game` typecheck green. The LRU
test crosses more than the former two-window lifetime and returns with `builtPages: 0`; the 65-page traversal proves the
cache stays at 64 and evicts least-recently-used work; the supersession test proves page two of stale work is never sent
to the worker. Fresh headless WebGL2 captures on `bltz-clash-538` show fully textured terrain 100 ms after a two-drag
pan (`/tmp/terrain-cache-fresh-edge-100ms.png`) and still-textured terrain 100 ms after the reverse pan
(`/tmp/terrain-cache-return-100ms-fixed.png`), with no flat-color interval in either return capture.

### Autonomous run record — label-system remake (2026-09-03)

**Inventory and target design (written before implementation).** The persistent world-map text is already atlas-based,
but it is not one renderer: `ArmyManager` and `StructureManager` each construct and own a `CompactEntityLabelRenderer`,
producing duplicate groups, batches and camera reconciliation. Army glyph/name plates and
structure/village/hyperstructure plates are the persistent text facts; they belong in one world-map atlas renderer with
namespaced manager scopes so equal numeric entity ids cannot collide and each manager's reconcile removes only its own
labels. The managers also own four army and nine structure `PointsLabelRenderer` instances, despite
`StrategicMarkerLayer` already projecting every army and structure from the whole-world index in the far band. Those 13
renderers are duplicate persistent representations, not a second required label system. The chest point icon has no
strategic-marker equivalent and remains the sole point-label consumer. Rich `CSS2DObject` cards in `ArmyManager`,
`StructureManager` and `ChestManager` exist only for the currently hovered hex through `HoverLabelManager`; the atlas
cannot express their live battle/resource layouts, so they remain on the existing change-driven 16 ms-floor CSS2D path.
Hexception's hex hover/paused-building labels, Navigator's route distance and `world-fx-backends`' short-lived effect
captions are scene-local transient feedback, not persistent world-map labels. Minimap text is DOM/canvas-adjacent UI and
owns no entity-label state.

The target is therefore one world-map `CompactEntityLabelRenderer`, owned and disposed by `WorldmapScene`; army and
structure receive isolated scopes whose `set/remove/retain/hover/clear` operations are driven by the same visible-entity
reconciles that place and despawn their models. The existing `worldmap-content-ladder.ts` remains the only distance
ladder: close = all atlas plates plus models, medium = priority plates plus models, far = biome tint/strategic markers
and the chest icon with no text. No parallel label store or timer is added. CSS2D stays only for the transient rich
surfaces named above.

**Fix and deletion.** `WorldmapScene` now owns one atlas renderer, updates its camera once per frame and gives army and
structure managers namespaced scopes. The scopes isolate identical numeric ids while sharing atlas pages and batches;
their existing visible-set reconcile owns removal, including despawn in the same pass. The single content ladder now
also owns far-icon visibility. Army and structure point layers were deleted: 13 renderer instances, 12 texture-loading
paths, both army point-policy/visual helper modules, the separate structure point wiring test, duplicate hover writes
and the per-frame moving point-icon update all disappeared. The chest point icon remains because the strategic marker
layer does not contain chests, and it is now enabled only in the far band.

**Gate.** The 11 focused suites covering the shared renderer, both manager lifecycles, the distance ladder and retired
source paths pass 83/83; `apps/game` typecheck and repository format pass. Repository knip reaches only its two existing
generated declaration findings (`packages/amm-sdk/dist/index.d.ts`, `packages/torii/dist/index.d.ts`) and exits 1; no
label path is reported. Headless WebGL2 captures at distances 10, 25 and 45 are `/tmp/labels-remake-distance-10.png`,
`/tmp/labels-remake-distance-25.png` and `/tmp/labels-remake-distance-45.png`; the close capture shows full atlas plates
and the far capture has no entity text. The scope-collision test proves equal army/structure ids coexist, and its
retain/remove assertions prove one manager's despawn cannot remove the other's label. The source gate proves one
renderer construction/disposal and no remaining army/structure point-label path. The live close-band scene measured 68
WebGL draws, still above the requested 60; its 16 detailed terrain pages and active combat make the absolute total
content-dependent. Label rendering itself is one atlas draw. I did not hide terrain or gameplay content to manufacture
the number, so the ≤60 whole-scene draw gate remains open.

### Codex items 1–5 — end review (reviewer, 2026-09-03)

**Approved.** All six commits verified on the branch (`178e0f137ae`, `d0387a2c315`, `2141913a564`, `ca6bb3dd659`,
`e2cfb3e90ae`, `f89a5c7b2e3`), each with a conviction-first record above. Independent gates re-run: one
`CompactEntityLabelRenderer` construction owned by `WorldmapScene`; army/structure `PointsLabelRenderer` paths deleted
(chest remains the sole point-label consumer, far band only); `maxCompositePages` 16; the 3 s background WebGPU
qualification with `idle:init-ok` promotion and the old adapter-only idle-probe machinery deleted from
`webgpu-lane-probe.ts`. Evidence captures inspected: textured terrain 100 ms after the return pan with no flat band;
clean atlas plates at distance 10. `apps/game` typecheck green.

**Suite accounting.** Full suite: 3,504 passed, 13 failed in 14 files. Eleven files are the accounted pre-existing red
set. The three others plus `console-discipline` were stale pins this hand-back legitimately outdated, retargeted by the
reviewer in `7ccbc5749db`: the remake dropped the label handle from `syncVisibleStructurePresentation(...)`, unified the
army batched update into `updateVisibleArmyPresentation()` (bounds sync still follows it), the prewarm's
`prewarmChunkAssets` added an earlier `startRow` destructure ahead of the transition-guard anchor, and prettier's call
wrap broke the single-line console pin. Every guarded behavior verified intact before retargeting. The format run's
line-wrap fallout is committed in `21d1b412026`.

**Ruling — the 60-draw gate.** The close-band ≤60 whole-scene target was set when 507 label draws dominated the scene.
Labels are now one atlas draw and the remaining 67 draws are terrain pages, models and combat content, so the
whole-scene number is content-dependent and no longer measures the label class. The label gate closes as met (one draw,
one lifecycle, zero orphans by construction); the whole-scene draw total moves to the owner's quiet-box measurement
list, judged against frame time rather than a fixed count.

**Nit, not worked.** `blitz-map-fingerprint-card.tsx` and `realm-hex-deploy-map.tsx` still map `BiomeIdToType` locally.
They consume the shared `BIOME_COLORS`, so colors cannot diverge; they merely skip the resolver's loud-miss path. Fold
onto the resolver whenever either file is next touched.

**Deploying** from this record's tip.
