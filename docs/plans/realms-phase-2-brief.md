# Realms phase 2 — own the data plane, take value seriously

**Status: ready for kickoff 2026-08-27.** Entry criteria were: the D.5 human gate passed (wallet login → settle → play →
reload keeps the address; one human + 95 bots to a result — passed 27 Aug) and the D.4.1 headroom shapes reported (16 s
max game-legal cadence; two concurrent games pass, four hit the wall — reported 27 Aug). Facts below were re-checked
against the tree on 2026-08-27. **Phase 2 runs on the lab laptop; no hardware is rented until section A has deleted
Torii and the stack has its final form** (owner decision 2026-08-27) — measuring a stack we are deleting sizes the wrong
thing.

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
  Scope discipline: decode the models the client actually renders — 40 distinct RECS components are referenced across
  `apps/game/src` and `packages/core/src` on 2026-08-27 — not the whole world schema.
- **State model:** confirmed base + replaceable pre-confirmed overlay (Madara may replace the pre-confirmed block; the
  overlay rebuilds from the last confirmed root). Sequence-numbered diffs over WSS; snapshot on connect; resume by
  sequence on reconnect. The stream is an accelerator; the snapshot is the truth (guardrail 2).
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

**Gate:** a full Blitz game played end to end with Torii stopped; explore reveal p95 ≤ 250 ms measured by the harness
against the new read path; client optimistic-channel code deleted (diff shows net deletion in the sync runtime);
reconnect mid-game resumes by sequence with zero missed diffs.

## B. Value plane — L2 contracts for entry, MMR, and prizes

Principle (decided): value and reputation live where identity lives (Starknet L2); the gameplay chain stays fee-free and
disposable. The gameplay burner never holds anything worth stealing.

- **`MMRToken` moves to L2**, keyed by the owner address (the identity wallet). The existing `contracts/mmr` already has
  the right shape (verified 2026-08-27): `update_mmr_batch(updates: Array<(ContractAddress, u256)>)` behind "Caller is
  not authorized game contract" — so `blitz_ledger` simply becomes the authorized updater, and no MMR contract change is
  needed for stage 1. The world's `mmr` system stays on L3 and computes; results are **posted** to L2, not called.
- **`blitz_ledger` (new, L2):** `register(game_id)` pulls the LORDS entry fee and emits the registration; `buy_sword()`
  / `buy_shield()` pull LORDS and set a one-game modifier flag on the owner's MMR record (double gains / halve losses —
  flags, not NFTs; tradability is a later decision that can be added without redesign);
  `apply_results(game_id, ranked owners…)` applies MMR deltas (consuming modifier flags) and pays prizes to
  `registry.owner_of` — never the caller.
- **Result transport, two stages, one interface:** stage 1 (this phase) an operator signer posts results — zero new
  trust, we already run the sequencer; stage 2 (phase 3) the post becomes an L3→L2 message proven by settlement, and
  `assert_only_operator` swaps for `consume_message_from_l3`. Build the L2 side with that swap in mind from day one.
- **Registration relay L2→L3:** stage 1, the authority server watches L2 registrations and writes them on L3 (same trust
  and machinery as `bind`); stage 2, native L2→L3 messaging. `obtain_entry_token` and the entry-token ERC721 are deleted
  from the L3 — the fee path changed chains (the deletion that proves the design).
- **The two protections land before any real value moves** (carried from phase-1 C.3): prizes pay `registry.owner_of`;
  `RealmsPlayerAccount.__execute__` refuses any target that is not a registered game system. Proven by the adversarial
  test: rotate a key from the authority, then attempt ERC20/ERC721 `transfer`/`approve` from the account — every attempt
  reverts. No operator-run value bridge in the interim: value crosses chains only when proofs carry it (phase 3).

**Gate:** on a Starknet testnet + the lab: register with a fee → relay → play → operator posts results → MMR moves on L2
(sword/shield modifiers consumed correctly) → prize paid to the owner wallet; the adversarial rotate-and-steal test
passes; the L3 tree no longer contains the entry-token path.

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

**E.2 Redundancy, drilled.** Madara is a single-writer sequencer; nothing makes it highly available, so redundancy is
layered, cheapest first, and all three layers are proven on the laptop:

1. **Hot replica** — a second Madara container in `--full --gateway-url <sequencer feeder gateway>` mode (the :5062 port
   already exposed) following the sequencer one block behind. It serves every read (RPC, the section-A WS stream, the
   indexer) so the sequencer only ever sees writes and status polls, and it is the promotion target: restart it with
   `--sequencer` and the sequencer key. **Gate:** kill the sequencer mid-game, promote the replica, the harness
   completes the game; RPO one block, RTO recorded in the README.
2. **Backups** — Madara's own `--backup-dir` + `--backup-every-n-blocks`, shipped incrementally to object storage (R2/S3
   later; a second disk on the laptop now), restored with `--restore-from-latest-backup` onto a fresh data volume.
   **Gate:** restore drill from an empty volume to a serving node, RTO recorded.
3. **Settlement** — the layer that actually protects money. Section B keeps MMR and the ledger on L2 and leaves only
   entry tokens on L3, so a lost L3 costs game state, not funds — provided results reach L2 promptly: `apply_results`
   posts per game end, never batched. Phase 3's L3→L2 messaging/DA makes the L3 recoverable from L2 instead of from our
   backups; until then layers 1 and 2 are mandatory for any chain holding a live game with a prize.

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
