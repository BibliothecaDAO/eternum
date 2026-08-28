# Realms phase 2 — own the data plane, take value seriously

**Status: ready for kickoff 2026-08-27.** Entry criteria were: the D.5 human gate passed (wallet login → settle → play →
reload keeps the address; one human + 95 bots to a result — passed 27 Aug) and the D.4.1 headroom shapes reported (16 s
max game-legal cadence; two concurrent games pass the capacity bars — their manifests read `passed: false` on 3 and 2
game-rule failures — four hit the wall; reported 27 Aug). Facts below were re-checked against the tree on 2026-08-28
(A.3 human gate, second attempt, recorded under A; PR #4903 merged the same day). **Phase 2 runs on the lab laptop; no
hardware is rented until section A has deleted Torii and the stack has its final form** (owner decision 2026-08-27) —
measuring a stack we are deleting sizes the wrong thing.

Phase 1 proved the platform: 96 players on our own Madara, zero Cartridge in gameplay, pre-confirmation in 50–77 ms, one
wallet identity bound to one permanent gameplay account. Phase 2 makes the two remaining rented or missing layers ours:
the **read path** (Torii) and the **value path** (entry fees, MMR, prizes — currently absent because the lab holds
nothing worth anything). Phase 3 (not this brief) then removes the last training wheels: Dojo exit, hosted cutover, L3
settlement and the LORDS/resource bridge.

## Decisions this brief inherits (all owner-decided, recorded in the phase-1 brief)

- Owned data plane direction pinned 2026-08-26: pre-confirmed WS stream is the authoritative real-time source; client
  optimism and the Torii canary are deleted when it lands.
- Client guest path deleted; guests are core/harness-only. Agents play as the owner's account via key rotation.
- Controller is an identity connector beside Ready/Braavos; gameplay stays Cartridge-free.
- MMR and value live on L2 where identity lives; the L3 stays fee-free and disposable (design session 2026-08-26,
  summarized in section B).

## Order and owners

One Codex stream, one Claude stream, in this order — each item lands with its gate before the next starts:

| #   | Item                                                                                                                                                      | Owner                                                                 | Depends on                                         |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------- |
| 0   | **A.0 pin bump** to the WS-capable build; N=2 harness rerun on the new pin as the regression gate                                                         | Claude (pin, digest, compose); Codex (rerun + WS-vs-poll comparison)  | —                                                  |
| 1   | **A** in four slices: A.1 herald decode + snapshot, A.2 stream + overlay, **A.3 client** (consumer, optimism deleted, nonce dispenser), A.4 Torii deleted | Codex                                                                 | 0 (A.1 can start before it)                        |
| 2   | **E.2** replica and backup/restore drills in the lab compose                                                                                              | Claude                                                                | 0 (runs beside 1)                                  |
| 3   | **E.1** batch-size sweep on the laptop; the driver-off-box rerun the day a second machine is on the LAN                                                   | Codex (harness); Claude (second machine, host state)                  | 0                                                  |
| 4   | **B** value plane — L2 contracts, relay, operator poster, adversarial test                                                                                | Codex (contracts, authority server); Claude (adversarial-test review) | 1 (the relay writes L3 through the same read path) |
| 5   | **C** agent grant surface                                                                                                                                 | Codex                                                                 | 4                                                  |
| 6   | **E.3** Eternum-scale shape (c)                                                                                                                           | Codex                                                                 | 1 (measured on the new read path)                  |
| 7   | **D** revivals                                                                                                                                            | parked until 1 and 4 land                                             | —                                                  |

Existing apps that this brief does **not** touch: `apps/realtime-server` (the chat WebSocket server) and `apps/indexer`
(the apibara L2 indexer for realms-world). Herald is neither; whether chat later rides herald's socket is a KISS
question asked after herald is stable, not before.

## A. Owned data plane — herald becomes the game's real-time source

**Fold, not index** (decided 2026-08-27). Madara has no "all entities of model X": Dojo entity keys are hashes and
current state exists only as a fold of the world's store events (`StoreSetRecord`, `StoreUpdateRecord`,
`StoreUpdateMember`, `StoreDelRecord`, raw felt payloads that decode only with the model layout). Without a held fold
every client would replay every event since the game started, against the sequencer's socket. So herald holds the fold
for one game and hands out a snapshot plus diffs — and nothing else. SQL, GraphQL, arbitrary queries, ERC tracking —
Torii's surface — are not rebuilt. If a query need appears, it is a read model over herald's fold, asked for with
evidence.

**Replay is free.** The fold is a pure function of the event log, and the log is permanent: every confirmed block and
event stays in Madara's DB (and in the E.2 backups; `--db-max-saved-trie-logs` limits storage proofs, not blocks). A
match replay is herald running the same fold from the game's first block, streaming diffs at any speed to the same
consumer spectator uses. Only confirmed blocks are history — a replaced pre-confirmed block is not, correctly.

What phase 1 measured: the chain answers in 50–77 ms; the player sees results in ~1–1.5 s because Torii polls,
processes, and republishes. The indexer is the latency budget and the EOL dependency; both go together.

- **A.0 — the pin moves first.** WebSocket subscriptions are verified working on `nightly-e674321` at `/rpc/v0_10_2`
  (`subscribeNewHeads`, `subscribeEvents`, `subscribeTransactionStatus`, `subscribeNewTransactions`). As of 2026-08-27
  the `nightly` tag _is_ that build (index digest `sha256:fa82a29f…`; no newer image since 20 Aug) and no `v0.11.0` past
  alpha.9 is published. Claude bumps the lab pin to that digest and re-verifies the alpha.9 facts that matter (native
  on, concurrency on, pre-confirmed semantics); Codex reruns the N=2 shape (b) harness on it — same pre-confirmed and L2
  numbers or the bump is a finding — then adds the WS-vs-poll comparison to the harness. **Done 2026-08-27 (Claude
  half):** pin is `nightly-e674321` (index `sha256:ec30298d…`), no DB migration, all flags present, concurrency default
  unchanged in source, WS heads in 19 ms, pre-confirmed probe 77–104 ms. Known cost: Torii 1.8.16 cannot parse this
  build's pre-confirmed block when it holds transactions, so Torii-indexed p95 went from 1.9 s to 7.5 s (README "Pin
  bump"). Not fixed — Torii leaves in A.4; the `indexedP95` harness check is excluded from the A.0 rerun gate.
- **One service per chain: `apps/herald`** (it announces what happened in the world; not "indexer", the generic thing it
  replaces). Subscribes to Madara's pre-confirmed stream over WebSocket at `/rpc/v0_10_2` — the only client the
  sequencer's socket ever has; sozo and the harness stay on `/rpc/v0_9_0`, which the build still serves. Clients hold
  **one WSS socket, to herald**: snapshot on connect, sequence-numbered diffs, transaction status as the diff carrying
  the hash. The write path stays one HTTPS `add_invoke_transaction` per action; chat keeps its socket on
  `realtime-server`.
- **Decodes world events against the manifest ABIs into typed models** — the one real engineering cost of leaving Torii.
  Scope discipline: decode the models the client actually syncs — the executable list is `GAME_SYNC_MODEL_MANIFEST` in
  `packages/core` (39 on 2026-08-27: 35 persistent, 4 event-message; herald imports it and carries no second list) — not
  the world schema's 88 models and 24 events.
- **State model:** confirmed base + replaceable pre-confirmed overlay. The WS spec lets pre-confirmed events repeat or
  be omitted, and Madara replaces a pre-confirmed block without an explicit reset notification, so **events are hints,
  the re-read is truth**: on every new confirmed head herald applies the closed block's events to the base, drops the
  overlay, and rebuilds it from one `getBlockWithReceipts(pre_confirmed)` read (one RPC per 2 s block), deduplicating by
  `(transaction_hash, event_index)`; between heads, pre-confirmed events extend the overlay. Clients see that as an
  `overlay_reset` followed by a fresh pre-confirmed diff. Sequence-numbered diffs over WSS; snapshot on connect; resume
  by sequence on reconnect. The stream is an accelerator; the snapshot is the truth (guardrail 2). **A.0 gate, run
  2026-08-27 (README "Forced pre-confirmed replacement"):** with transactions pre-confirmed, the sequencer was stopped
  with SIGTERM and, separately, SIGKILL. Neither replaced the block: on SIGTERM Madara closes the pre-confirmed block
  before exiting; on SIGKILL it restores the saved pre-confirmed block (default `save-preconfirmed`) and closes it with
  the same hashes. What subscribers _do_ see is **repeats** — pre-confirmed events emitted twice on a fresh
  subscription, the last block's events re-sent on reconnect — and `block_number: null` on pre-confirmed events. So the
  rule above is the design: dedup by `(transaction_hash, event_index)`, rebuild the overlay from the `pre_confirmed`
  read on each head. The one replacement path not yet exercised is failover to the replica (E.2), whose drill records
  how much pre-confirmed content dies with a sequencer; A.2's replacement test replays that drill's transcript through
  herald. Tool: `pnpm lab:probe-ws`.
- **The client becomes a consumer.** Because pre-confirmation is the shared optimistic layer, the per-client optimistic
  machinery (guardrail 5's pending records, TTLs, reconciliation) is deleted, keeping at most a local echo of the acting
  player's own click. The AGENTS.md guardrails that describe that machinery (1, 2, 5) are rewritten in the same change
  to describe herald's snapshot + stream contract — a rule that describes deleted code is a trap for the next agent.
  Success is measured in deletion: the client's optimistic channels and the Torii canary both go, and the explore-reveal
  latency drops from ~1–1.5 s to a target ≤ 250 ms end-to-end.
- **A.3 — the client, spelled out** (the part that decides whether this phase was worth doing; sized on the tree
  2026-08-27):
  - _Read path._ `packages/core/src/sync/game-sync-runtime.ts` becomes the herald consumer: snapshot on connect,
    sequence-numbered diffs into RECS, resume by sequence. RECS stays the single store, so scenes and UI do not change.
    Torii-specific code goes with Torii: `packages/torii` (6,142 lines), `apps/game/src/dojo` (3,601 lines),
    `model-stream-clause.ts`, and the Torii lanes of `entity-ingest-queue.ts`. `packages/dojo` (137 lines) waits for the
    phase-3 Dojo exit.
  - _Optimism._ `provisional-write-manager.ts` and the 23 files that mention "optimistic" are deleted. The acting
    player's own click keeps a UI-only pending indicator — never a RECS write; pre-confirmation is the shared optimistic
    layer, and it arrives through herald like every other fact.
  - _Write path — today a race._ `apps/game/src/account/gameplay-account-submit.ts` reads `getNonce(PRE_CONFIRMED)` per
    submit and retries once on a nonce rejection; two fast actions from one client can read the same nonce. Replace with
    one per-account **nonce dispenser**: seeded once from the pre-confirmed nonce, incremented per submit, submissions
    serialized per account, resynced on any nonce rejection (phase-1 measured 3 pipelined txs in 43 ms all pre-confirmed
    before block close — the chain supports it; the client does not use it yet). Confirmation comes from herald's stream
    (the diff carrying the transaction hash, or a relayed `subscribeTransactionStatus`) — the `waitForTransaction`
    polling in `packages/provider/src/index.ts` (`:82-92`) is deleted.
  - _RPC versions._ `apps/game` is on starknet.js 8.9.2 (RPC 0.8/0.9): the write path stays on `/rpc/v0_9_0`, served by
    the same node, until a starknet.js release speaks 0.10. Herald is the only `v0_10_2` consumer in this phase; after
    Torii's deletion the remaining `v0_9_0` dependents are sozo (phase 3) and starknet.js (bumped when a release
    allows).
  - _Reconnect and spectator_ ride the same consumer: spectator is a consumer with no account; a reload mid-game is a
    snapshot plus resume, not a Torii re-sync.
  - _Polling — the ledger._ Inventoried 2026-08-27: 62 timer-driven re-reads in `apps/game`, `packages/*`, `apps/web`
    (three UI-only timers dismissed). The rule after A: **a timer that re-reads a fact the stream delivers is a bug**;
    what survives is either clock-derived (a value that changes with time, recomputed on the clock — points accruing per
    tick, automation schedulers that _act_ on a cadence) or EXTERNAL (a source outside the game chain that cannot push),
    and each carries its reason in an allowlist. By class:
    - **TX-STATUS (7)** — all funnel into one 200 ms receipt loop, `packages/provider/src/index.ts:1434`
      (`waitForTransaction`, 5 RPC/s per in-flight tx: the client's largest sustained RPC load), plus the 50 ms deploy
      poll in `packages/core/src/account/gameplay-account.ts:83`. Deleted; confirmation is the herald diff carrying the
      hash. `apps/web`'s server-side `waitForTransaction` (authority calls) may keep a one-shot wait with its reason.
    - **FACTS over Torii (14)** — story events every 6 s for the whole session (`use-story-events-store.ts:68`), faith
      leaderboard/wonder/devotion ×4 at 30 s, the entry modal's three settlement scans at 15 s plus two planner queries,
      the world directory at 30 s × N worlds × 3 requests (`use-world-availability.ts:300`, `use-worlds-summary.ts:31`,
      `use-player-world-registrations.ts:121`). All become herald: story events are an event channel on the stream; the
      directory is a fold of `GameRegistry`. Two have no callers today and are deleted first, not migrated:
      `packages/react/src/hooks/use-entry-token-balance.ts` (5 s `balance_of`; the entry token itself goes in B) and
      `services/leaderboard/use-score-to-beat.ts`.
    - **FACTS re-read from RECS on a timer (11)** — leaderboard points (10–30 s), automation runners and the arrival
      auto-claim loop (1 s boundary), explorer positions every 5 s (`exploration-automation-dashboard.tsx:309`),
      resource chips per tick. Points and production are clock-derived: they stay, on the chain clock. Runners are
      schedulers, not polls: they stay, ticking from the chain clock. Anything that changes only with state (explorer
      positions) subscribes to the store — RECS already has subscriptions.
    - **CHAIN-TIME (4)** — `chain-time-poller.tsx:114` fetches `getBlock("latest")` every 10 s; every herald diff
      carries block number and timestamp, so the fetch is deleted and the three 1 s local interpolation ticks stay (no
      network).
    - **HEALTH (2)** — the Torii `/health` probe (10 s) and the 3 s heartbeat watchdog with its 120 s stream re-open go
      with Torii; herald liveness is WS ping/pong plus sequence-gap detection, one reconnect path.
    - **EXTERNAL (20)** — L2 `watch: true` reads in `apps/web` (per mainnet block), the factory worker's run polls (5 s,
      1.5 s × 8, 3 s × 40), the marketplace (3 s / 60 s), bridge and inventory lists (10–15 s). Not this phase's
      sources; recorded, untouched, except dead config: the season/village pass inventories accept a refetch interval
      that their only call sites set to `0` — the option is deleted (wired or deleted).
    - **The chokepoint:** `apps/game/src/polling-discipline.source.test.ts`, modelled on the existing
      `console-discipline.source.test.ts`, fails on any `setInterval` / recursive `setTimeout` / `refetchInterval` /
      `waitForTransaction` outside an allowlist whose entries each carry the class and the reason. The inventory above
      is the initial allowlist minus everything A deletes; a poll cannot come back without a written reason.
  - _Instrumentation._ `observed-client-transaction.ts` records click → submitted → pre-confirmed → rendered per action,
    so the latency gate is measured in the client, not only by the harness.

  **Gate (A.3):** explore reveal p95 ≤ 250 ms click→rendered, measured client-side over one full game; zero nonce
  rejections in a 20-action burst from one client; reload and reconnect mid-game resume by sequence; spectator works
  with Torii stopped; the diff records the line count deleted (`packages/torii` gone, `apps/game/src/dojo` shrunk); the
  polling source test passes with zero TX-STATUS, Torii-FACTS, network CHAIN-TIME, or HEALTH entries left in its
  allowlist, and the in-game steady-state RPC rate from one idle client is measured at zero requests per second.

- **Throughput is a non-problem** at target scale (~100 tx/s ≈ ~100 KB/s decoded diffs; realtime-server-class fan-out).
  The hard parts are decoding, overlay rebuild, and snapshot/replay — plan the gates around those.

- **A.1 / A.2 / A.4 — the protocol, so the slices are executable** (decided 2026-08-27; numbers are tuned, shapes are
  not):
  - _Wire._ One WSS endpoint per game, `wss://<herald>/<chain>/games/<game_id>`. JSON messages (a binary encoding is a
    measured change later): `hello{epoch, seq, confirmed_block, preconfirmed_block}`;
    `snapshot{epoch, seq, model, rows[]}` chunked per model, closed by `snapshot_end{seq}`;
    `diff{epoch, seq, block, preconfirmed, set[{model, key, value}], del[{model, key}]}`;
    `overlay_reset{epoch, seq, confirmed_block}`; `tx{hash, status, block, revert_reason?}`; `head{block, timestamp}`.
    Every message carries `epoch` and `seq`.
  - _Epoch and sequence._ `epoch` is the herald process generation for that game (new on every herald restart or fold
    rebuild); `seq` is a per-game monotonic counter within the epoch. A client that observes a gap or a new epoch
    resyncs; there is no "best effort" path.
  - _Atomic snapshot boundary._ The fold is single-threaded per game. On connect herald registers the subscriber at fold
    sequence `s`, sends the snapshot as of `s`, then every diff with `seq > s` — the subscriber is attached before the
    snapshot is taken, so nothing is lost or duplicated.
  - _Resume._ `resume{epoch, seq}` replays from a per-game ring of the last 10 minutes or 10,000 diffs (whichever is
    larger) when the epoch matches; otherwise herald answers with a fresh snapshot. Retention is measured against real
    reconnect gaps and tuned.
  - _Restart._ Herald checkpoints the fold (state + last confirmed block) to Postgres every N blocks; on start it loads
    the checkpoint, replays confirmed events from that block to head with `getEvents`, then subscribes — a new epoch. A
    herald restart mid-game is a client resync, never a client-visible rollback of confirmed state.
  - _Transaction status is its own channel._ A reverted transaction emits no store event, and a successful one may touch
    no rendered model, so a diff cannot confirm a transaction. Herald subscribes to `subscribeNewTransactionReceipts`
    (pre-confirmed and confirmed) and pushes `tx` for every hash sent from a gameplay account settled in that game (the
    sender set is known from the fold); the client's submit path resolves on `tx`, and A.3's nonce dispenser resyncs on
    `REVERTED` the same way it does on a rejection.
  - _Multi-game lifecycle._ One fold per **chain** (A.1 landed it that way, and it is simpler: the world's store events
    are one stream, and game scoping is a filter on the `game_id` key at snapshot time); per-game state is what
    subscribers and snapshots see. A finished game's snapshot is checkpointed at game end and kept for replay (section A
    "Replay is free"); rows of games past a configured age are evicted from the in-memory fold — the chain remains the
    replay source.
  - _A.1 landed 2026-08-27_ (`7714278250` dead paths deleted, `05ba899589` `apps/herald`): manifest-driven decoder (Dojo
    store layout normalized, then starknet.js `CallData.parse` through synthetic ABI functions — no hand-written
    parsers), a per-chain fold, per-game HTTP snapshots, and the parity gate `pnpm --dir apps/herald parity`. Reviewed
    and reproduced by Claude on game 53: all 35 persistent models match Torii row-for-row, 2,933,882 events, 229,254
    rows, Torii boundary stable — and the replay from genesis took **147 s**, which is why A.2's checkpoint is a
    requirement, not an optimization: herald must start from a checkpoint in seconds, and its startup time is a gate
    number.
  - _A.2 landed 2026-08-27_ (`27c945e42c`): Postgres checkpoint (18.4 MB gz, every 100 blocks and on SIGTERM), live
    overlay from the three subscriptions, per-game WSS with the protocol above. Reviewed live by Claude on game 54 with
    a one-bot harness run (`pnpm lab:probe-herald` is the client used): 646 messages, zero sequence gaps; resume from
    `(epoch, seq)` replays with no snapshot; a Madara SIGKILL mid-stream is survived (reconnect in the 200 ms retry,
    reconcile, heads continue); herald SIGTERM checkpoints in 3.8 s and the restart is ready in 3.0 s (1.96 s from
    checkpoint), a client with the old epoch gets a fresh snapshot; the subscription's `event_index` is the
    per-transaction position, so the dedup key matches the `getBlockWithReceipts` read. **Three findings, fixed before
    A.3 consumes the stream (the gate for starting A.3):**
    1. **Pre-confirmed hints are broadcast one event per `diff`** — 475 diffs for 7 transactions, ~150 for one `settle`,
       so a client renders a transaction partially (a `Structure` before its `Resource`s). Guardrail 3: one player
       action becomes visible in one step. Coalesce hints per transaction — flush on transaction-hash change and at the
       end of the current macrotask — so one action is one `diff` (confirmed diffs are already one per block).
    2. **`ACCEPTED_ON_L2` copies are re-applied to the fresh overlay.** The events subscription re-delivers each event
       with `ACCEPTED_ON_L2` after the head; herald applies them as hints after `overlay_reset`, so 214 of the 475
       pre-confirmed diffs (45 % of the stream) re-set already-confirmed rows and label them overlay. Ignore subscribed
       events whose `finality_status` is not `PRE_CONFIRMED` (or whose block is ≤ confirmed).
    3. **A reconnect emits `overlay_reset`+`head` three times for the same block** — reconcile plus the head Madara
       re-sends on subscribe are both treated as new. Reconcile handles the equal-block case; subscription heads at or
       below the confirmed block are ignored. Also noted, not gating: `acceptReceipt` resolves every chain transaction's
       sender with a `getTransactionByHash` (one RPC per transaction at any load); `subscribeNewTransactions` carries
       `sender_address` and would replace it.
  - _A.2 fixes landed 2026-08-27_ (`ab6e72d746`, `871506390b`): verified from the evidence file — one diff per
    transaction (4 pre-confirmed + 4 confirmed for 4 transactions), 120 unique reset/head pairs, no gaps.
  - _Snapshot is the confirmed base, the overlay is a diff_ (decided 2026-08-27, from Codex's A.3 finding). A fresh
    snapshot today is the overlay state, so a client connecting while an overlay-only row exists cannot roll it back on
    the next `overlay_reset`. Fix in herald's attach path, not the client: `snapshot` chunks come from the **confirmed**
    fold, followed — before any live message — by the current overlay as pre-confirmed `diff`s (herald already coalesces
    them per transaction; keep that list per game and clear it on reset). The client transport then marks those rows
    pending exactly as it does live ones, and `overlay_reset` rolls them back. Gate: connect while a transaction is
    pre-confirmed, force a same-epoch reset, the client's state equals a fresh snapshot.
  - _A.3 started 2026-08-27_ (`26b41d30b0` nonce dispenser + dead entry-token poll deleted; `930712cbcc` herald consumer
    in `packages/core/src/sync/herald-game-sync-transport.ts`, RECS wiring, `waitForTransaction` on the tx channel).
    Herald is selected by `VITE_PUBLIC_HERALD_URL`; Torii stays the transport otherwise — a transitional switch that A.4
    deletes together with Torii, never a fallback that survives.
  - _A.3 human gate, first attempt 2026-08-28 (Claude):_ herald + both dev servers up behind Caddy, an 8-bot game (56)
    for the human to join. Two classes surfaced before anyone could play, both fixed at their chokepoints:
    1. **Non-stream consumers lost their wait.** `3d071ee69b` deleted the deploy wait in `ensureGameplayAccount` with
       the client's polling; starknet.js reads nonces at `latest`, so the harness's settle right after a deploy was
       rejected (`Account nonce: 1; got: 0`, three times). Restored as one bounded wait to `ACCEPTED_ON_L2` at the only
       place a gameplay account is created (`2a270f430c`). Harness follow-up: read nonces pre-confirmed
       (`RpcProvider({ blockIdentifier: PRE_CONFIRMED })`) so setup does not depend on it.
    2. **Event messages are Cairo serde, store records are Dojo layout.** Herald decoded both with the one-based store
       rule; the first `StoryEvent` with `owner = Some(...)` (selector `0x0`) was fatal and herald exited, taking the
       client read path down for two hours; the next start died on a `GuardAddStory` (selector `0xc`, zero-based).
       Decoder now picks the encoding by event kind (herald README "Herald encodings"), with tests; replay from
       checkpoint through both blocks and the parity gate pass. **A.2 follow-up (Codex): an undecodable event must not
       exit the process** — log it with model and transaction, count it in `/health`, keep serving; a client on stale
       state beats no client, and the log is the loud part. The 8-bot run itself: 799/800 actions, pre-confirmed p95 154
       ms, L2 p95 1.98 s, one stamina-rule miss; nobody joined — the human gate is still open.
  - _A.3 human gate, second attempt 2026-08-28 (human played game 57, 8 bots):_ the owner settled, explored, built and
    reloaded on herald with Torii still running but unused by the client. Findings, in the order they surfaced:
    1. **The s2 rulebook was never in the fold.** Every balance number on an s2 world (stamina max and costs, population
       capacity, tick, combat, travel) is read by `config-manager` from `PresetConfig[preset_id]`, plus chain tuning
       from `ChainConfig`; under Torii those two rows came from a side query, and the sync manifest herald folds from
       never listed them. Symptoms: no stamina bar, explore sent at 20/30 and rejected by the chain, "need more
       capacity" at 6/12 — every one a `config lookup returned empty after sync — using default` line. Fixed at the
       manifest (`0f14d1c152`): both models are chain-scoped s2-only entities; `game-scope`'s hand list drops them. Same
       commit: herald **discards a checkpoint folded from a different model set** (`herald_checkpoint_discarded`) and
       replays from genesis (193 s on the lab) instead of crashing at start — adding a model never needs a hand-cleared
       table again. Class to keep in mind for A.4: any row the Torii config query fetched (`getConfigFromTorii`) must be
       in the manifest before that query is deleted.
    2. **Build modal always places at direction 1.** Four reverted `create_building` calls (`0x4d6fdf…`, `0x1bbdae…`,
       `0x33f743…`, `0x5a02ac…`, blocks 126483–126485) carry `directions = [1]` with only the category changing, so the
       top-bar Build modal collides with whatever was built first ("space is occupied"); building from the hexception
       view works. Herald's `Building` rows for the realm match the chain, so this is the modal, not sync. **Codex.**
    3. **"You are not logged in / view-only" while playing.** `not-logged-in-message.tsx` reads
       `useAccount().isConnected` from the starknet-react connector; play now runs on the identity gameplay account
       (`useDojo().account`), which is where every other consumer already looks. Same class as any remaining
       `useAccount()` reader in play (`use-world-preview-entry`, cosmetics hooks): one account truth. **Codex.**
    4. **Automation reported "not running" — resolved 2026-08-28 evening.** The persisted store said it all: every realm
       `skipped: "Realm no longer owned"`. `isEntityOwnedByAccount` compared addresses as strings — a bigint RECS owner
       rendered unpadded (`0x7ef0b…`) against the gameplay account's `addAddressPadding` form (`0x07ef0b…`). Fixed by
       comparing through `ContractAddress()` (numeric) like every other site; the same string compare in
       `prize-panel.tsx` (decimal `String(bigint)` vs hex) went with it. Class: address equality is numeric, never
       textual — any new `owner === address` / `.toLowerCase() ===` on an address is this bug again. Original text: not
       yet diagnosed — the runners read the account from `useDojo()` and tick every 60 s; exploration also gates on
       stamina, which was zero until fix 1. Needs the `[Automation]` console lines and which runner (production /
       exploration / transfer). **Open, Codex once the owner reports.**
    5. **Latency: p50 812 ms / p95 1441 ms click→rendered (`explore_reveal`, 12 samples) — fails the 250 ms bar, and the
       number is not trusted.** Herald's own share, measured the same hour by timestamping 27 tx hashes on Madara's
       pre-confirmed subscription and on the game-57 stream, is **43 ms p50 / 81 ms p95**. The box was running the
       owner's other simulation, herald's genesis replay, and a full tsc + test pass at the time, and the harness's own
       pre-confirmed p95 for the same game was 857 ms (154 ms in game 56, quiet box). Re-measure on a quiet box before
       drawing any conclusion; if it still fails, instrument the client side (`__clientActionLatencyMeasurements` per
       stage: sign → submit → herald `diff` → RECS apply → render) — the data plane is not where the time goes.
  - _Merged on top (2026-08-28):_ PR #4903 (procedural terrain and armies, `e4524ccc668` + `d3a5f4b36a1`). One seam for
    A.3: the PR built its procedural combat on a provisional _and_ an indexed path; this branch deleted client optimism,
    so only the indexed path is kept (`replayIndexedCombat` + procedural ranged/melee presentation; the provisional-FX
    renderer, the coordinator's dedup queue, and the battle-lab/quick-attack provisional calls are gone). The nested
    `apps/game/.gitattributes` was a stale copy that normalized two `.ktx2` textures as text — one attributes file now.
  - _Review of the 2026-08-28 Codex commits (Claude):_ `d38000feea4` (tests), `fefb400fd2f` (undecodable events are
    logged with model + tx, counted as `undecodable_events` in `/health`, herald keeps serving — closes the A.2
    follow-up), `ab125610e8c` (senders from `subscribeNewTransactions`; the two per-tx maps drop entries on the final
    receipt, so a transaction that never gets one leaks an entry — bound them or expire them, not a blocker), and
    `8d2b3b0c0e4` (one account truth; the five unreachable chest-opening prototype files knip now names are dead code —
    delete them, do not ignore them) are accepted. **`1c14be4d50d` is rejected.** It adds a module-level
    `pendingBuildingPlacements` map with a 30 s TTL inside `TileManager` — a parallel optimistic channel with its own
    expiry, which guardrail 5 forbids — and it treats the wrong cause. The chain shows the success and the first two
    reverts in the same block (126483, all within 4 s of the last one); herald's `Building` row for that slot carries
    exactly the RECS key `buildingEntityKey` computes (`0xc17d04c…`) and the transport applies pre-confirmed diffs on
    arrival. The real class: `realm-build-actions.ts` resolves `availableSpots` at click time, then awaits
    `placeBuilding`, which queues behind the serialized gameplay account; the modal's in-flight lock is per building
    card (`pendingAction` in `select-preview-building.tsx`), so four clicks on four categories each passed their own
    lock, each chose the same free slot, and the dispenser drained them over four seconds. **Fix:** one build lock per
    realm, held until `placeBuilding` returns (it already waits for the pre-confirmed receipt), and the slot resolved at
    submission time inside that lock; the map, the TTL and the per-card lock are deleted. The regression test is the
    four-quick-clicks sequence, not east-then-north-east.
  - _Quiet-box measurement, 2026-08-28 evening (game 58, 8 bots, load average 0.83, herald on `ab125610e8c`):_
    - **Data plane: 6 ms p50 / 21 ms p95** — herald's `tx` status timestamped against Madara's own pre-confirmed
      subscription for 63 transactions. Under load earlier it was 43 / 81 ms. The read path is not where any time goes;
      nothing in section A needs to get faster.
    - **Per-stage client timings** (`__clientActionLatencyMeasurements`, three `explore_reveal` and three
      `provision_realm` actions): click→submitted **390–650 ms for explore** but 30–115 ms for provision;
      submitted→pre-confirmed 1–106 ms (the chain); pre-confirmed→rendered **106–345 ms**. Totals p50 761 / p95 1051 ms;
      the bar is 250. Two client-side classes, both Codex, both measured before touched:
      1. Explore spends ~0.5 s before the send that provision does not ("2 transactions" — the path builds two calls;
         pathing / calldata / signing happen on the click). Instrument the sub-phases (build → sign → send), then remove
         what the numbers name; the harness signs and submits in 25 ms p50, so the account is not it.
      2. Pre-confirmed→rendered runs through the rAF ingest lane, the sliced manager catch-up ("converged after 189 ms
         of sliced wall time") and a terrain page rebuild. A player's own action is one logical event (guardrail 3): its
         rows apply and render on arrival, not on the ambient lane. Bar for this stage: ≤ 100 ms.
    - **Fog of war does not clear on provision or army creation, and clears late on explore** (owner, game 58). Herald
      holds the `TileOpt` rows for every tile around the new realm; the client's reveal path (`worldmap.tsx` ~1253–1261:
      `queueShroudReveal` + `invalidateVisualTerrainPageForLiveTile`) only runs for a live tile change **inside the
      retained render area** and only takes effect on the next page rebuild. Provisioning and army creation land their
      rows while the worldmap is not watching that page; chunk hydration then writes `exploredTiles` without
      invalidating the fog page, so the fog stays until a later explore in the same page forces a rebuild. A
      hyperstructure is placed on the worldmap, so it takes the live path — that is why it "works". Class: the fog mask
      is a projection of `exploredTiles` but is only invalidated from one of the two writers. Fix at the chokepoint:
      every write to `exploredTiles` (live or hydrate) invalidates its fog page; the reveal starts on the pre-confirmed
      diff, not on the page rebuild; the 0.9 s reveal animation is a number to tune down (≤ 0.3 s). Gate: provision →
      fog gone on the realm's tiles before the settlement screen closes; explore → fog gone within the same ≤ 100 ms
      render budget as the tile.
    - Build modal: reworked by Codex after the review, confirmed by the owner in game 58.
  - _A.3 gate result, 2026-08-28 evening:_ on herald with Torii running but unused by the live path — settle, play,
    build (after the placement rework), reload mid-game, automation (after the address fix): **pass**. Latency:
    measured, fails the bar for client reasons named above (not a data-plane finding). **Spectator with Torii stopped:
    blocked, not failed.** With the container stopped the landing page lists no games and the play route cannot boot any
    game, because `apps/game/src/runtime/world/profile-builder.ts` resolves chain config, the world address and the
    `GameRegistry` row over Torii SQL before herald is ever contacted (the "world directory" and "pre-session reads"
    rows of the table below). Nothing herald-side broke; the boot path is simply still Torii's. **Torii stays stopped on
    the lab from here (owner decision 2026-08-28) — it is not restarted for convenience.** A.4 starts with that boot
    path: herald serves `GET /<chain>/games` (directory: the `GameRegistry` fold, with counts) and
    `GET /<chain>/games/<id>/snapshot?models=…` (already exists), `profile-builder` and the landing lists read those,
    and the spectator gate is re-run with the container stopped — that rerun is A.4's first checkpoint, before the
    deletions.
  - _Next steps for Codex, in order (rewritten 2026-08-28 evening; Torii is stopped on the lab and stays stopped):_
    1. **A.4, the boot path first.** Herald serves `GET /<chain>/games` — the `GameRegistry` fold as a directory
       (status, clock, player count per game) — next to the existing `GET /<chain>/games/<id>/snapshot?models=…`.
       `profile-builder.ts` (chain config, world address, registry row), the landing Open/Played lists and the entry
       modal's pre-session reads move onto those two endpoints; world address comes from the manifest. Checkpoint: a
       fresh 8-bot game boots, one human settles, and a private-window spectator watches it, all with the container off.
       Nothing else in this list is worth more than this while no game can boot.
    2. **The two client latency classes and the fog chokepoint** (measured above): instrument explore's submit path
       (build → sign → send) and delete what the numbers name; a player's own action renders on arrival (≤ 100 ms
       pre-confirmed→rendered), not on the ambient lane; every `exploredTiles` write invalidates its fog page, reveal
       starts on the pre-confirmed diff, animation ≤ 0.3 s. Re-measure the 20-click burst; bar p95 ≤ 250 ms.
    3. **A.4, the deletions.** Every remaining row of the disposition table below (history sink for story / battle /
       swaps / review; `LastBattle` aggregate; faith and leaderboard onto the stream), then the Torii container,
       `torii.toml.template`, `packages/torii`, `apps/game/src/dojo`, the `VITE_PUBLIC_HERALD_URL` switch (herald is the
       transport, full stop), the harness's `toriiSqlUrl`, and every `getConfigFromTorii` row already in the manifest.
       Gate unchanged: a full Blitz game end to end with no Torii process anywhere; net deletion in the sync runtime;
       reconnect resumes by `seq` with zero gaps.
    4. **Build-modal placement, still open** (corrected 2026-08-28 late: the brief briefly listed it as done on the
       owner's "fixed" report from game 58 — that was the rejected 30 s reservation masking the double-send; no rework
       commit exists after `1c14be4d50d`). Do it per the review: one build lock per realm held until `placeBuilding`
       returns, slot resolved at submission time inside the lock, the TTL map and the per-card lock deleted, regression
       = four quick clicks. Codex sequences it after the boot checkpoint and before declaring the pass complete —
       accepted. Riding along: the five unreachable chest-opening prototype files knip names are deleted, not ignored;
       the two per-transaction maps in herald's live world are bounded or expire.
    - Done since the first list: stale wiring tests (`d38000feea4`), degrade-not-die (`fefb400fd2f`), harness
      pre-confirmed nonces and stream senders (`ab125610e8c`), one account truth (`8d2b3b0c0e4`), automation address
      equality (`93da2d4592a`), rulebook in the fold (`0f14d1c152`), quiet-box measurement (above), PR #4903 merged.
  - _Gates per slice._ **A.1** — snapshot of a lab game matches Torii row-for-row for every decoded component (Torii is
    the oracle until A.4). **A.2** — the forced-replacement transcript from A.0 is handled: after `overlay_reset` the
    client's state equals a fresh snapshot; a killed socket resumes by `seq` with zero gaps; a herald restart mid-game
    yields a new epoch and a client state equal to a fresh snapshot; a reverted action resolves through `tx`. **A.3** —
    its own gate above. **A.4** — every row of the Torii disposition table below is resolved, the Torii container,
    `torii.toml.template`, `packages/torii`, and `apps/game/src/dojo` are deleted, and the game plays.

- **A.4 — Torii disposition table** (inventoried 2026-08-27: 27 `SqlApi` methods, 26 app-level SQL readers, 26
  stream/import paths). Herald gains one more output for this: the **history sink** — the same fold appends immutable
  rows (story events, battle events, swaps and trades, final ranks and prizes) to Postgres, served by herald over HTTP
  with pagination. That is the only "read model over the fold" this phase builds, and it exists because these features
  are history, which guardrail 1 already allows as SQL read models. Every row below has one disposition; nothing keeps
  Torii.

  | Feature (today)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Torii source                                                                                                                          | Disposition                                                                                                                                                                          |
  | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
  | Live world sync: gamewide entity + event-message streams, `getEntities` snapshot and gap-fill (`apps/game/src/dojo/*`, `packages/core/src/sync/*`, `packages/dojo`)                                                                                                                                                                                                                                                                                                                                | gRPC subscriptions                                                                                                                    | **herald stream** (A.2/A.3); the 41-model manifest becomes herald's decode list                                                                                                      |
  | Pre-session reads — entry modal settlements, village slots, player structures, planner snapshot and tiles, settlement status, owned-structure count, `AddressName`, factory series (`game-entry-modal`, `use-settlement-planner-data`, `use-player-world-registrations`, `use-world-availability`, `use-factory-series`)                                                                                                                                                                           | SQL over current models                                                                                                               | **herald snapshot over HTTP** (`GET /games/<id>/snapshot?models=…`), no socket needed before play                                                                                    |
  | World directory — games list with counts, availability, world/game id resolution, world address (`appchain-worlds-summary`, `use-worlds-summary`, `game-registry.ts`, `profile-builder.ts`)                                                                                                                                                                                                                                                                                                        | SQL over `GameRegistry` + `contracts` meta                                                                                            | **herald directory** — a fold of `GameRegistry` per chain, served over HTTP; world address comes from the manifest                                                                   |
  | Faith leaderboard, wonder faith detail, devotion status                                                                                                                                                                                                                                                                                                                                                                                                                                            | SQL over `Structure`/`WonderFaith`/`FaithfulStructure`                                                                                | **herald stream** — current models; sorted client-side                                                                                                                               |
  | Map data: all structures / all armies with latest attacker/defender                                                                                                                                                                                                                                                                                                                                                                                                                                | current models + `BattleEvent` window CTEs                                                                                            | **herald stream** for the rows; the latest-battle columns become a fold-maintained `LastBattle` aggregate (read model over the fold)                                                 |
  | Player leaderboard, activity breakdown, landing/review leaderboard (`fetchPlayerLeaderboard*`)                                                                                                                                                                                                                                                                                                                                                                                                     | pivot over `StoryEvent(PointsRegistered)` + live shareholder term                                                                     | registered points from the fold's `PlayerRegisteredPoints` model (**stream**); the live term is already computed client-side from RECS; activity breakdown from the **history sink** |
  | Story events feed, by entity, by owner, count                                                                                                                                                                                                                                                                                                                                                                                                                                                      | `StoryEvent` history                                                                                                                  | **history sink**, paginated over HTTP; new events also ride the stream as an event channel (A.3 polling ledger)                                                                      |
  | Game review (22 queries), claim summary, finalize/claim flows                                                                                                                                                                                                                                                                                                                                                                                                                                      | `StoryEvent`, `PlayersRankFinal`, `MMRGameMeta`, `PlayerRank`, `RankPrize`, `GameChestReward`, `SeasonPrize`, `transactions`, configs | frozen end-of-game **snapshot** from herald + **history sink**; transaction counts from herald's `tx` channel tallies                                                                |
  | Winners table, prize panel                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | `GameChestReward`, `SeasonPrize`, `ChainConfig`                                                                                       | **snapshot** (current models)                                                                                                                                                        |
  | Swaps (`fetchSwapEvents`), market trading history (`TradeEvent`)                                                                                                                                                                                                                                                                                                                                                                                                                                   | `SwapEvent`/trade events                                                                                                              | **history sink**                                                                                                                                                                     |
  | Marketplace cosmetics/chests (`chest-opening/services/queries.ts`, `VITE_PUBLIC_MARKETPLACE_URL`)                                                                                                                                                                                                                                                                                                                                                                                                  | the **marketplace's** Torii on L2                                                                                                     | not the game chain — **untouched**, EXTERNAL until the marketplace port (D)                                                                                                          |
  | Headless `packages/client` (`EternumClient.sql`, 25 call sites, `RESOURCE_BALANCE_COLUMNS`)                                                                                                                                                                                                                                                                                                                                                                                                        | SQL polling                                                                                                                           | **herald HTTP + stream** through the same consumer as the game; its local structural `SqlApi` interface goes                                                                         |
  | Dead today — `fetchTokenTransfers`, `fetchResourceBalancesWithProduction`, `fetchBuildingsByStructures`, `fetchStoryEventsSince`, `fetchRegisteredPlayerPoints`, `fetchBattleLogs`, `useScoreToBeat` + `fetchScoreToBeatAcrossEndpoints` + its static tables, `buildSettledBlitzPlayersWithNamesQuery`, the banned `packages/torii` gRPC helpers and their five parsers, the package-internal utils with no consumer, the stale `@bibliothecadao/torii` dependency in `packages/core/package.json` | —                                                                                                                                     | **deleted first**, before any migration (A.1 starts with this commit)                                                                                                                |

**Gate:** a full Blitz game played end to end with Torii stopped; explore reveal p95 ≤ 250 ms measured by the harness
against the new read path; client optimistic-channel code deleted (diff shows net deletion in the sync runtime);
reconnect mid-game resumes by sequence with zero missed diffs.

## B. Value plane — L2 contracts for entry, MMR, and prizes

**Correction (2026-08-27):** identity is the L2 _wallet_; the `PlayerRegistry` that maps wallet ↔ gameplay account lives
on the **gameplay chain** (`deploy-gameplay-contracts.ts`, read through `GAME_RPC_URL`). An L2 contract cannot call it.
So the L2 ledger's owner is **the L2 caller of `register`** — the identity wallet itself, recorded as `(game_id, owner)`
at registration — and the L3 registry is used only by the operator, off-chain, to map each ranked gameplay account back
to its owner when posting results. The ledger accepts a result row only for an owner registered in that game.

Principle (decided): value and reputation live where identity lives (Starknet L2); the gameplay chain stays fee-free and
disposable. The gameplay burner never holds anything worth stealing.

- **`MMRToken` moves to L2**, keyed by the owner address (the identity wallet). The existing `contracts/mmr` already has
  the right shape (verified 2026-08-27): `update_mmr_batch(updates: Array<(ContractAddress, u256)>)` behind "Caller is
  not authorized game contract" — so `blitz_ledger` simply becomes the authorized updater, and no MMR contract change is
  needed for stage 1. The world's `mmr` system stays on L3 and computes; results are **posted** to L2, not called.
- **`blitz_ledger` (new, L2):** `register(game_id)` pulls the LORDS entry fee and emits the registration; `buy_sword()`
  / `buy_shield()` pull LORDS and set a one-game modifier flag on the owner's MMR record (double gains / halve losses —
  flags, not NFTs; tradability is a later decision that can be added without redesign);
  `apply_results(game_id, ranked: Array<(owner, rank)>)` applies MMR deltas (consuming modifier flags) and pays prizes
  to the registered owner — never the caller.
- **Invariants and economics (so the ledger is specifiable):** `apply_results` runs **once** per `game_id` — a
  `finalized` flag, a second call reverts; the ranked roster must equal the registered set for that game in count and
  membership, or the call reverts; MMR deltas are **computed on-chain** from ranks and current MMR with immutable
  per-season parameters — never supplied by the poster; modifier flags are consumed in the same call and can only be
  bought before the game's start time. Fees: entry fees form the game's prize pool; `protocol_cut_bps` and the payout
  table by rank are preset values fixed at game creation; `cancel_game(game_id)` by the operator before start refunds
  every registration in full, and nothing refunds after start. `sword_price` / `shield_price` are preset values — tuned
  inside the system, not designed here. The operator signer is a hot key that can only post results and cancel unstarted
  games; it can never move funds.
- **Result transport, two stages, one interface:** stage 1 (this phase) an operator signer posts results — zero new
  trust, we already run the sequencer; stage 2 (phase 3) the post becomes an L3→L2 message proven by settlement, and
  `assert_only_operator` swaps for `consume_message_from_l3`. Build the L2 side with that swap in mind from day one.
- **Registration relay L2→L3:** stage 1, the authority server watches the ledger's `Registered(game_id, owner)` events,
  waits for `ACCEPTED_ON_L2` plus one block, and writes `register_relayed(game_id, owner, gameplay_account)` on L3 — a
  new authority-gated system entrypoint, **idempotent** by `(game_id, owner)` so retries and restarts are harmless;
  stage 2, native L2→L3 messaging behind the same entrypoint. Today `settle` takes `entry_token_id` and calls
  `resolve_and_consume_entry_token` (`blitz/contracts.cairo`); it loses that parameter and instead asserts the relayed
  registration for `(game_id, caller)`. `obtain_entry_token`, the entry-token mint/consume internals, the issuance
  config, and the entry-token ERC721 are deleted from the L3 — the fee path changed chains (the deletion that proves the
  design). If the relay fails after a fee is paid, the L2 registration is the receipt and the relay retries; nothing on
  L3 needs undoing.
- **The two protections land before any real value moves** (carried from phase-1 C.3): prizes pay the registered L2
  owner; `RealmsPlayerAccount.__execute__` refuses any target that is not a registered game system. Proven by the
  adversarial test: rotate a key from the authority, then attempt ERC20/ERC721 `transfer`/`approve` from the account —
  every attempt reverts. No operator-run value bridge in the interim: value crosses chains only when proofs carry it
  (phase 3).
- **Account class v2, and why no migration is needed.** The lab class is stock OpenZeppelin `AccountComponent`
  (unrestricted SRC6, no upgrade path) and `bind` refuses rebinding — so the lab's "permanent" accounts cannot be
  restricted in place. They do not need to be: the L3 is disposable and holds nothing, and the binding's source of truth
  is the authority server's record of wallet ↔ derived account — the on-chain registry is a mirror the authority writes.
  Phase 2 ships **class v2**: the target restriction, `rotate_public_key` as today, and `upgrade(new_class_hash)`
  requiring both the owner's signature and the binding authority; the lab is redeployed on v2 (accounts re-bound from
  the authority's records, which is also the rehearsal for a chain move); production only ever deploys v2. No value
  moves on any chain whose account class lacks the restriction.

**Gate:** on a Starknet testnet + the lab: register with a fee → relay → play → operator posts results → MMR moves on L2
(sword/shield modifiers consumed correctly) → prize paid to the owner wallet; a second `apply_results` and a roster that
differs from the registered set both revert; `cancel_game` refunds; the adversarial rotate-and-steal test passes on
class v2 and `upgrade` without the authority reverts; the L3 tree no longer contains the entry-token path.

## C. Agents (small, mostly product)

Delegation is already built: an agent plays as the owner's gameplay account via the session-gated `rotate` (the recovery
mechanism is the delegation primitive; MMR and prizes stay the owner's; take-back is another rotate). Phase-2 scope is
only: an "agent plays for me" grant/revoke surface on the authority server + audit log, and the client UX for "session
moved to another device/agent — reconnect". The agent runtime itself (what the bots become) can start as the harness
driver behind that grant.

**Gate:** the harness driver plays one game as a wallet-owned account through a grant; the owner revokes mid-game and
the driver's next action fails while the owner's client reconnects and continues; both events are in the audit log.

## D. Revivals and consolidations (parked in phase 1, unchanged)

`apps/mobile` on the identity + gameplay-account stack; the marketplace port onto our stack; the
`realms.json`/`full-realms.json` merge (asked with a diff); web stays React 19 / starknet 9.

## E. Sequencer capacity and infra shape — measured on the laptop, decided on paper

The phase-1 headroom result (phase-1 brief, D.4.1 "Headroom result") named the wall: on the lab laptop, shared with the
bot driver, Torii, Postgres and swap, four concurrent 96-player Blitz games (25.6 tx/s) break the close-cost bar; two
pass. Execution there was contention-bound (66 ms/tx vs 25 ms/tx quiet, intra-batch parallelism capped at
`execution_batch_size: 4`); merklization is the serial, hardware-independent cost at ~10 ms/tx. Every gate in this
section runs on the laptop; the box is bought in phase 3, after section A, sized by these numbers.

**E.1 The true sequencer cap.** Rerun shape (b) with the harness driver on any other machine — a second laptop on the
LAN or a throwaway VM; it is stateless and needs only RPC — so the sequencer's host state is the sequencer's alone. Then
sweep `execution_batch_size` (4 → 8 → 16) on the same host state; it is both flush granularity and the parallelism cap,
so the trade is measured, never assumed. **Gate:** the N at which close p95 first exceeds 300 ms, with the driver
off-box, and the batch size that carries it, in a manifest pair with `host-state.sh` — the first number a box is ever
sized from.

**E.2 Redundancy, drilled.** _Status 2026-08-27: compose scaffolding landed (identity-gated sequencer, `madara-replica`,
`madara-promoted`, `promote-replica.sh`); replica sync and the identity gate proven; the promotion and restore drills
wait for a quiet lab — they run inside Codex's next harness game so RPO/RTO are measured once._ Madara is a
single-writer sequencer; nothing makes it highly available, so redundancy is layered, cheapest first, and all three
layers are proven on the laptop:

1. **Hot replica** — a second Madara container in `--full --gateway-url <sequencer feeder gateway>` mode (the :5062 port
   already exposed) following the sequencer. It serves confirmed reads (client RPC, herald's restart replay, snapshot
   and history reads) and is the promotion target. It is **not** herald's live source: the follower refreshes its
   pre-confirmed block on a 500 ms throttled poll (`client/sync/src/gateway/blocks.rs:602` at e674321), which alone
   would eat A's 250 ms budget — herald subscribes to the **sequencer's** WebSocket directly, and is the only client
   that socket has. **Fencing:** the sequencer identity is one file that lives in exactly one place; promotion is a
   script that stops the old container, verifies its RPC and gateway ports are closed, moves the identity, and starts
   the replica with `--sequencer`; herald reconnects to the new address. **Gate:** kill the sequencer mid-game, promote
   the replica, the harness completes the game; starting the old container afterwards fails for lack of the identity;
   RPO one block, RTO recorded in the README.
2. **Backups** — volume snapshots of the _stopped replica_ (tar of its data volume: consistent, provider-agnostic),
   shipped incrementally to object storage (R2/S3 later; a second disk on the laptop now), restored by untarring into a
   fresh volume and starting a node. Madara's own `--backup-dir` / `--restore-from-latest-backup` is **not** used: at
   `nightly-e674321` the restore happens after the database is opened, so the node starts from genesis (README "E.2
   redundancy", reproduced twice; fix is upstream). **Gate:** restore drill from an empty volume to a serving node at
   the snapshot's head, RTO recorded.
3. **Settlement** — the layer that actually protects money. Section B keeps MMR, fees and the ledger on L2 and leaves
   nothing of value on L3 (registration is a relayed record; the entry token is deleted), so a lost L3 costs game state,
   not funds — provided results reach L2 promptly: `apply_results` posts per game end, never batched. Phase 3's L3→L2
   messaging/DA makes the L3 recoverable from L2 instead of from our backups; until then layers 1 and 2 are mandatory
   for any chain holding a live game with a prize.

**E.3 Eternum scale.** 2,000 players at one action per 2–5 minutes is 7–17 tx/s — inside what N=2 carried on the laptop
with the driver on-box. Throughput is not the risk; two other things are: **bursts** (day start, war ticks — spec a
burst tolerance of 4× average for 60 s and let the mempool and pre-confirmation absorb it, which `n_txs: 256` exists
for) and **state growth** (2k realms of entities deepen the tries; merklization per tx rises with world size and does
not parallelize). **Gate:** shape (c) — a large world, 2,000 bots at Eternum cadence with one scripted burst, tracking
`merklizationMs`/tx against block height and state size; the report says whether merklization stays under the close bar
at Eternum's world size, and at what size it would not.

**E.4 One sequencer, one player base** (decided 2026-08-27). A sequencer is single-writer: writes land where it sits and
no replica changes that — a far-region player pays the RTT (~150–250 ms) on top of pre-confirmation for their own
actions, and near-local latency for everyone else's diffs if a herald is near them. One Blitz chain per region would
remove that RTT but split the lobby, and Europe never playing America is the worse game; rejected. So: **one sequencer,
in the region the player distribution names** (the web app's edge analytics answer that when phase 3 buys); herald per
region is an optional read lever, not a plan. **Gate (laptop):** `tc netem` 200 ms on the driver and the browser, then
the A.3 explore-reveal gate measured with that RTT included — the number is honest for the worst-placed player, and it
decides whether regional heralds are worth their ops.

**E.5 Infra shape (recorded, not purchased).** What the numbers so far say the production shape is, to be confirmed by
E.1–E.3 and bought in phase 3:

| Role         | Shape                                                                                                                                                                    | Why                                                                                                                                      |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Sequencer    | One bare-metal box, 16 high-clock cores (Ryzen 9 7950X3D / EPYC Genoa class), 128 GB ECC, 2× NVMe RAID1, **no swap**, governor `performance`; runs Madara sequencer only | Merklization is serial — single-thread clock (~2× this laptop) buys more than cores; RocksDB wants local NVMe; the N=8 collapse was swap |
| Read / index | A smaller box: Madara full node following the gateway + herald + Postgres; serves client RPC/WS and the identity web app; the promotion target                           | Reads never touch the sequencer; replica for free                                                                                        |
| Front        | Cloudflare: DNS, TLS, WAF and rate limiting on `add_invoke_transaction`, WS passthrough, `cloudflared` tunnels so no port is public, R2 for backups                      | It cannot host the chain; it is the right front for it                                                                                   |
| Staging      | One cheap box, same layout; the harness driver on a separate throwaway VM                                                                                                | Releases are measured before prod, with the driver off-box as E.1 requires                                                               |
| Lab          | This laptop                                                                                                                                                              | Unchanged                                                                                                                                |

Bare metal (Hetzner AX / OVH / Latitude class) is the recommendation for the sequencer: the hardware is what the
workload wants and the cost is ~€250–300/mo for the whole shape versus ~$1.2–1.5k/mo for the AWS equivalent (c7a/m7a
with instance-store NVMe). Cloud's advantage — replacing a box in minutes — is what E.2 buys at the chain layer instead.
Prices are list prices at the time of writing; the decision is re-checked, not re-argued, when phase 3 buys.

## Out of phase 2 (deliberately)

Dojo exit (enabled by A — once the client consumes our stream, dojo.js has nothing left to do; the world contracts
follow); renting or cutting over to hosted Madara, DNS, and the E.4 shape (measured and decided here, bought in phase
3); L3 settlement, the orchestrator/Piltover stack, and the LORDS/resource bridge (withdrawals gated by proof cadence —
Eternum's long format tolerates it). If you find yourself writing one of them here, stop.

## Cost

Added: herald, one L2 contract pair (`MMRToken` move + `blitz_ledger`), the operator result-poster, the agent grant
surface, a replica container and a backup job in the lab compose (E.2), three harness shapes (E.1, E.3). Deleted: Torii
and its canary config, the client optimistic machinery, the L3 entry-token path, the client's Torii read paths. Net
deletion in the client; one owned service replaces one rented one. No hardware cost in this phase.

## Validation

Every gate above is a measured run or an adversarial test, not a demo. Owners and order are in "Order and owners"; each
item lands with its gate or reports what blocked it, and the README records the numbers the same day.
