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

| Measurement (game 11, spectate, software WebGL2) | Before (phase M)                   | After phase 1                                                        |
| ------------------------------------------------ | ---------------------------------- | -------------------------------------------------------------------- |
| snapshot receive / apply (7,217 rows)            | 878 / 154 ms (reviewer: 903 / 219) | 749 / 148 ms                                                         |
| store writes for the snapshot, max batch apply   | 3, 91 ms (reviewer 102)            | 5, 44 ms                                                             |
| sync-owned spike digests over 150 s              | 0 of 187                           | 0 of 311 (`render:backend` 310, terrain 1)                           |
| `frameBudgetLongTasks` at boot, then over 60 s   | 3 (max 47 ms), +0                  | 3 (max 54 ms, terrain commit), +0                                    |
| heap after boot, then over 60 s                  | 376 → 378 MB                       | 309 → 310 MB                                                         |
| live rows received / component writes applied    | 0 / 0 (finished game)              | 0 / 0 — the 1.0 ratio is owed to the live game                       |
| calls_built → sign_send_started p95              | not measured                       | owed to a joinable live game (unit-proven below)                     |
| herald rows received per head / rows changed     | not measured                       | owed: box runs the old herald; `lab:probe-herald` after the redeploy |

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
