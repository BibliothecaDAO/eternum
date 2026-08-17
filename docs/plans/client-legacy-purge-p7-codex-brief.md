# P7 — the legacy purge: timers, fallbacks, one optimistic channel, one truth — Codex brief

Motto: **KISS, always. Systemic fixes over point patches. Success is deletion. Evidence before optimization.**

Context. Sync is consolidated: one `GameSyncRuntime` → RECS, one ingest chokepoint (`queries.ts:37` →
`applyAuthoritativeEntities`), a derived spatial projection, a fast self-hosted appchain, and — since P6A — army
rendering on honest authoritative signals. The remaining player-felt jank does not come from that stack. It comes from
the layers built before it was trustworthy: timers standing in for data signals, recovery loops fighting healthy
streams, optimistic side-channels that never migrated, and second copies of facts RECS already owns. Four full-code
audit sweeps (Aug 17: wall-clock gates, fallback paths, optimistic census, side stores) convicted everything below with
file:line evidence. This brief is the purge, organized by class. Runs **after P6 completes**. Rendered version with the
full tables: https://claude.ai/code/artifact/081b9bc1-ae5e-47a9-8217-55a3bcc65dc2

## Doctrine (each slice is these rules applied to one subsystem)

1. **Timers animate, budget, or alarm — they never decide.** A wall-clock threshold may drive FX, spread ambient work,
   or log a warning. It may not choose state or flow where a data signal exists. Genuine last-resort recovery may keep
   its timer but must log every time it fires.
2. **One optimistic channel.** Every provisional write flows through `ProvisionalWriteManager`. Every parallel channel
   is migrated onto it or deleted.
3. **One truth per fact.** Live entity state has exactly one read path: RECS (and its projection). Second copies are
   deleted or demoted to pure render caches written only from RECS subscriptions.
4. **Wired or deleted.** Exported-but-unused surface found by the audit goes.

Items marked **MEASURE** land their log line first; their deletion lands only once a session log shows the evidence.
Everything else is already convicted — cite the line, make the change.

---

## P7A — transport: stop fighting a healthy stream (biggest feel win)

| Finding | Evidence | Verdict |
| --- | --- | --- |
| 60s event-stream lease tears down a **healthy** stream every minute, reopens it, and runs a backward gap-fill replay — torii-wasm returns cancel-only handles so the lease is always armed | `recovering-torii-event-subscription.ts:8,191`; proof in any session log: `[Sync] event gap-fill replayed 0 events` once a minute (`gamewide-sync-adapter.ts:266`) | DELETE |
| Gap-fill baseline blocks game entry: a backward fetch of 100 historical events awaited inside `start()`, purely to arm the lease watermark | `torii-event-gap-fill.ts:61-64` awaited at `recovering-torii-event-subscription.ts:81` | DELETE (keep the failure-path replay for real reconnects) |
| Entity-stream asymmetry: the **authoritative** feed has no lease, no backoff, no self-recovery (lifecycle observer is a documented no-op); the ephemeral event feed got all three | `gamewide-sync-adapter.ts:248-254,276-278` | FIX — one recovery owner |
| 120s quiet-stream refresh silently runs a **full game re-snapshot** (re-subscribe + full paginated snapshot + absence diff + replay); success path deliberately unlogged | `connection-health-monitor.ts:310-348`, `env.ts:215` | MEASURE — add the log, then lengthen drastically or delete |
| One 8s knob bounds five latency profiles (initial subscribe, updates, every snapshot page, every gap-fill page, reopen); one slow page rejects an entire boot or recovery | `env.ts:175`, `runWithTimeout` at `gamewide-sync-adapter.ts:170-202,286-310` | FIX — split by operation; a failed page retries the page, not the session |
| Two independent reconnect backoff schedules for the same failure | `recovering-torii-event-subscription.ts:24-25` vs `connection-health-monitor.ts:438-445` | FIX — the monitor owns backoff |
| Stalled-overlay tripwire is `undefined` in production — a stuck overlay holds until the tab closes, invisibly; this is the one signal that would prove a missed echo | `gamewide-sync-adapter.ts:238-240` | FIX — route to telemetry in prod |
| 2.5s reconciliation hold after a **proven** match, re-armed on every observation, so a chatty entity holds its overlay indefinitely; built against slow-mainnet stale echoes | `provisional-write-manager.ts:43,206-209` | MEASURE — see the P7B latency instrumentation |

**Design after the purge:** recovery has one owner — the connection health monitor (3s heartbeat watchdog, 10s health
probe, error-driven backoff, dead-end re-bootstrap) — covering both streams via `recoverGameSyncSession()`. Streams are
opened once and trusted until an error or the monitor says otherwise. Every recovery path that fires, logs.

**Gate:** a full session log contains zero periodic `gap-fill replayed` lines; restarting torii mid-session recovers via
the monitor with the path named in the log; entry no longer awaits any event-history fetch; a stalled overlay in a
production build produces a telemetry event.

## P7B — one optimistic channel

**The census verdict (this answers "what does it hold and is it necessary"):** the manager has exactly five producer
sites in two files — building lifecycle in `tile-manager.ts` (place/destroy/pause/resume) and army movement in
`worldmap.tsx` (stamina overlay + input lock until hash; the coord overlay died with P6A) — and one input-lock consumer.
That core is sound and earns its keep. **Keep the manager. The problem is the seven channels beside it and the dead
surface inside it.**

Parallel channels — migrate onto the manager or delete:

| Channel | Evidence | Verdict |
| --- | --- | --- |
| `ResourceManager` direct overrides: 15+ call sites (explore/travel food, troop spends, swaps, trades, transfers, upgrades, automation) with caller-owned `try/finally` and 180s/55s TTL cleanups; no settle detection, no lock | `resource-manager.ts:151-166` + sites in `army-action-manager.ts:408,440`, `army-manager.ts:79-117`, economy/automation UI | MIGRATE — patch math is already shared (`resolveOptimisticResourceChangesPatch`); move the lifecycle |
| Build-reservation store: a full second optimistic state machine for building occupancy with 3s/90s TTLs and a hand-rolled settle detector, for ops `tile-manager` already covers with intents | `build-reservation-store.ts` (whole file) | DELETE |
| React pending maps for buildings — a third channel gating the same submissions; the intents' input lock is never queried for buildings | `select-preview-building.tsx:186-188` | DELETE — consume `hasInputLock` |
| Realm-upgrade pending store: zustand near-duplicate of `ProvisionalIntentStatus` + hand-rolled settle + a 30×1s poll of RECS | `use-realm-upgrade-store.ts:38`, `use-structure-upgrade.ts:75` | DELETE — intent + component subscription |
| Pending-worldmap-FX bus: attack + army-creation optimism over window `CustomEvent`s with its own settle-evidence detector, stale timeouts, synthetic negative ghost IDs | `pending-worldmap-fx.ts`, `worldmap-pending-attack-evidence.ts` | MIGRATE — intents for these actions; FX subscribe to intent outcomes |
| Arrival-ghost lifecycle: 10-reason taxonomy, 90s max lifetime, settle is tween-driven so ghost and intent resolve on independent clocks | `arrival-ghost-manager.ts:35` | MIGRATE — clears couple to intent outcomes; delete independent timers |
| Component-local optimistic scalars, incl. a double (scalar + override for the same balance) and a store mutation that hides a relic forever if its tx fails | `craft-relic-popup.tsx:192`, `game-review-modal.tsx:94`, `use-realm-store.ts:251` | MIGRATE |
| Triplicated transaction waiter — two byte-equivalent copies of the manager's `resolveTransactionWaiter`/`extractTransactionHash` | `transaction-cleanup.ts:58-85`, `automation-resource-cleanup.ts:65-92` | DELETE with the ResourceManager migration |

Manager slimming (dead surface): the unused `ProvisionalIntent` handle members (`id`/`status`/`transactionHash`/
`isInputLocked()` — zero production callers, `provisional-write-manager.ts:140-167`); four test-only constructor
options; `ResourceArrivalManager.optimisticOffload` (zero callers, leaks by construction,
`resource-arrivals-manager.ts:18-93`); `TileOpt` + `Structure` overridable wrapping (zero override producers ever,
`create-client-components.ts:11,13` — the same wrapper class that caused the P6A regression); the orphaned
`army-stamina-source.ts` arbitration (client narrowed to `"live"`-only); the four never-emitted
`optimistic_animation_*` latency phases + `explore_authoritative_reconcile_complete` and their uncomputable spans; the
`"optimistic_aborted"` ghost reason.

**Measurement that rides this slice:** log intent created → tx hash → first matching authoritative echo per intent (DEV
console + prod telemetry). If echo p95 is sub-second and stale echoes don't occur, settle collapses to
"first authoritative write wins" and P7A's 2.5s hold goes with confidence.

**Gate:** `addOverride` appears only in the sync adapter (grep); exactly one transaction-waiter implementation survives;
the PR carries the census — every channel above named as migrated or deleted, nothing "kept for now".

## P7C — second truths of live state

| Finding | Evidence | Verdict |
| --- | --- | --- |
| Chokepoint-bypass fetch pair: live `ExplorerTroops`/`Structure`/`Resource` fetched straight into React state at 9 call sites, never through RECS | `packages/torii/src/queries/torii-client/army.ts:6-53`, `structure.ts:8-60` | DELETE the read path; consumers move to RECS |
| Army detail panel: `liveRECS ?? toriiSQL` fallback; troops/owner/position come only from the bypass fetch. The correct pattern is next door in `use-structure-entity-detail.ts:44-46` | `use-army-entity-detail.ts:74` | FIX |
| Battle preview reads target troops/guards/resources from fetch-once React state — no subscription, no staleness bound; exactly the numbers a combat preview must not get wrong | `use-attack-target.ts:102-236` | FIX |
| Transfer panels submit against torii-fetched balances/weights/troops with TTL-only freshness | `transfer-resources-container.tsx:88,113,562,573`, `transfer-troops-container.tsx:100,121,825` | FIX |
| `exploredTiles` scene map is a drift-capable copy of `TileOpt`, and the pathfinding worker's rehydrate reads **tiles from the scene map** while armies and structures read the projection — inside one function | `worldmap.tsx:804`, `worldmap.tsx:6853` vs `:6847-6849` | FIX — tiles read `worldSpatialProjection.getTilesInBounds` like their siblings; demote `exploredTiles` to a pure render window |
| Hexception latches a stale structure list: `if (playerStructures.length > 0)` drops the empty transition | `hexception.tsx:296-303` | FIX — remove the guard |
| Leaderboard singleton: mutable point maps, multiple writers, TTL-based optimistic claim overlay | `leaderboard-manager.ts:35-46` | DOCUMENT now, restructure when touched |

Straight deletions: `ArmyData.matrixIndex` + its `?? armyData.matrixIndex` fallback (`army-manager.ts:1821` — the
comment already names the model slot as the single truth); `SelectableArmy.position` (fallback-only);
`useSettlementStore.availableLocations/settledLocations` (never written); the `["guards", …]` query invalidations with
no matching query (`army-management-card.tsx:216`, `unified-army-creation-modal.tsx:525`); the avatar call to
`eternum-production.up.railway.app` (mainnet-era external service, 404s every appchain session).

**Gate:** grep for `getEntities` outside the chokepoint returns only the sync adapter; in a live session, battle preview
and transfer panels update with RECS against a concurrent state change.

## P7D — polls over push, and dead waits

| Finding | Evidence | Verdict |
| --- | --- | --- |
| Realm-upgrade sync: 30 polls at 1s against RECS, a push store | `use-structure-upgrade.ts:16-17,75` | FIX (absorbed by P7B's migration) |
| Dead entry-wait family — "wait for scene-ready event, else proceed anyway"; zero production callers, superseded by `play-route-readiness-store` | `game-loading-overlay.utils.ts` (whole file) | DELETE |
| Perpetual 1Hz `setTimeout` chain polling `getBlockTimestamp()` for tick advance — chain time is already published reactively | `army-manager.ts:502,523` | FIX — derive from `use-chain-time-store` |
| Entry-modal poll loops: settlement progress at 1s under 30/90s deadlines; village reveal at 1.5s for 45s then thrown — the awaited facts are entity state | `game-entry-modal.tsx:84-86,3269,3605-3619,3825-3845` | FIX — subscribe; the deadline only logs |
| Blind 2s sleep after fee top-up, no balance check | `use-world-registration.ts:345` | FIX — check the balance |
| Chunk-refresh wait busy-polls state fields the completion path already mutates | `worldmap-chunk-refresh-runtime.ts:91-116` | FIX — resolve from the completion path |
| `PLAY_ROUTE_RECONNECT_GRACE_MS = 4000` defined twice, two timers deciding one flow | `play-route-boot.ts:21`, `use-unified-onboarding.ts:31` | FIX — one owner |
| Orphans: `playerStructuresMs` referenced nowhere; four refresh reasons never passed to any refresh | `config/polling.ts:7`, `worldmap-render-diagnostics.ts:86-98` | DELETE |
| Automation's 15s stale planning cache deliberately plans against a superseded world picture | `use-exploration-automation-runner.ts:54,352` | DOCUMENT the trade-off, or gate on projection change instead of wall-clock |

**Gate:** the greps for the rows above come back empty; entry-modal waits resolve from entity subscriptions in a live
provisioning run, and deadlines only ever log.

## Login-stack findings (Aug 17 — recorded so nobody re-litigates them)

- **Passkey login failures ("publickey-credentials-get is not enabled in this document") are upstream, not ours.**
  Frame-chain probe on the deployed client: `play.jcndata.com` ✓ delegated → `x.cartridge.gg` keychain ✓ delegated →
  nested `auth.turnkey.com` iframe **not delegated** (`allow="clipboard-write"` only). Any account whose passkey
  assertion runs through the Turnkey frame fails on every OS. The classic keychain passkey path was verified working
  end-to-end on Linux Chrome. Fix belongs to Cartridge's keychain; nothing in this repo to change.
- **Do not bump `@cartridge/controller`/`connector` to 0.14.0.** It is the starknet 8→10 migration release; verified
  Aug 17 that the bump fails typecheck at four sites (the connector returns a starknet-10 `WalletAccount`,
  structurally incompatible with our starknet-8 `AccountInterface` paths), and the surrounding stack cannot follow —
  `@starknet-react/core` ≤5.0.3 and all `@dojoengine/*` 1.7.0-preview.3 peer on starknet ^8. Revisit only when
  dojo.js and starknet-react publish starknet-10 support. Stay on 0.13.16 until then.
- **`ControllerConnector` is instantiated per-render.** `starknet-provider.tsx:125` builds it in a `useMemo` inside the
  component; the package logs `ControllerConnector was instantiated multiple times` in live sessions and re-instantiates
  on chain-config changes. Move construction to module level per the package's own guidance. Verdict: FIX (rides P7D).

## What survives, on purpose

Frame budgets and work slicing; UX/FX timing (animations, debounces, countdowns); alarms and telemetry windows (dedupe
TTLs, diagnostic buffers, tripwires — now also prod telemetry); the connection health monitor, promoted to the only
recovery owner; `ProvisionalWriteManager`, kept, slimmed, and made the only optimistic channel; genuine wallet-latency
guards (e.g. the 30s realm-action submit race) — each must log when it fires.

## Order and rules

P6 finishes first, as written. P7 then runs as four separate slices in order: **A** (transport), **B** (one channel),
**C** (one truth), **D** (polls & dead waits). Do not combine slices in one change; each PR carries its own gates. The
two MEASURE items land their log line in the same slice, and their deletion only lands once a session log shows the
evidence. Expect every slice to be net-negative LOC — a slice that grows the codebase is prima facie off-doctrine and
needs to say why.

## Validation

Per-slice focused tests, typecheck, `pnpm run format`, `pnpm run knip` — claims come from running the actual commands.
Known load-flakes verified in isolation. P7A and P7C additionally require the live-session gates above, with the console
lines cited in the PR.
