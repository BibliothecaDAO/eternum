# Realms phase 2 — own the data plane, take value seriously (DRAFT)

**Status: draft, opens when phase 1 closes.** Entry criteria: the D.5 human gate passed (wallet login → settle → play →
reload keeps the address; one human + 95 bots to a result) and the D.4.1 headroom shapes reported (max game-legal
cadence; games-per-Madara). Facts below marked _verify_ are re-checked against the tree at kickoff — phase 1 is still
landing changes.

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

## A. Owned data plane — the indexer becomes the game's real-time source

What phase 1 measured: the chain answers in 50–77 ms; the player sees results in ~1–1.5 s because Torii polls,
processes, and republishes. The indexer is the latency budget and the EOL dependency; both go together.

- **One service per chain** (start in `apps/`, name it at kickoff — not "indexer", the generic thing it replaces):
  subscribes to Madara's pre-confirmed stream over WebSocket (`starknet_subscribeNewHeads`, `subscribeEvents`,
  `subscribeTransactionStatus` — verified working on `nightly-e674321` at `/rpc/v0_10_2`; the lab pin must move past it,
  digest recorded, harness re-run on the new pin as the comparison gate).
- **Decodes world events against the manifest ABIs into typed models** — the one real engineering cost of leaving Torii.
  Scope discipline: decode the models the client actually renders (grep the RECS component set), not the whole world
  schema.
- **State model:** confirmed base + replaceable pre-confirmed overlay (Madara may replace the pre-confirmed block; the
  overlay rebuilds from the last confirmed root). Sequence-numbered diffs over WSS; snapshot on connect; resume by
  sequence on reconnect. The stream is an accelerator; the snapshot is the truth (guardrail 2).
- **The client becomes a consumer.** Because pre-confirmation is the shared optimistic layer, the per-client optimistic
  machinery (guardrail 5's pending records, TTLs, reconciliation) is deleted, keeping at most a local echo of the acting
  player's own click. Success is measured in deletion: the client's optimistic channels and the Torii canary both go,
  and the explore-reveal latency drops from ~1–1.5 s to a target ≤ 250 ms end-to-end.
- **Throughput is a non-problem** at target scale (~100 tx/s ≈ ~100 KB/s decoded diffs; realtime-server-class fan-out).
  The hard parts are decoding, overlay rebuild, and snapshot/replay — plan the gates around those.

**Gate:** a full Blitz game played end to end with Torii stopped; explore reveal p95 ≤ 250 ms measured by the harness
against the new read path; client optimistic-channel code deleted (diff shows net deletion in the sync runtime);
reconnect mid-game resumes by sequence with zero missed diffs.

## B. Value plane — L2 contracts for entry, MMR, and prizes

Principle (decided): value and reputation live where identity lives (Starknet L2); the gameplay chain stays fee-free and
disposable. The gameplay burner never holds anything worth stealing.

- **`MMRToken` moves to L2**, keyed by the owner address (the identity wallet). The existing contract already has the
  right shape (`update_mmr_batch`, authorized-updater model — _verify_ against `contracts/mmr`). The world's `mmr`
  system stays on L3 and computes; results are **posted** to L2, not called.
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

## D. Revivals and consolidations (parked in phase 1, unchanged)

`apps/mobile` on the identity + gameplay-account stack; the marketplace port onto our stack; the
`realms.json`/`full-realms.json` merge (asked with a diff); web stays React 19 / starknet 9.

## Out of phase 2 (deliberately)

Dojo exit (enabled by A — once the client consumes our stream, dojo.js has nothing left to do; the world contracts
follow); hosted Madara, DNS, cutover; L3 settlement, the orchestrator/Piltover stack, and the LORDS/resource bridge
(withdrawals gated by proof cadence — Eternum's long format tolerates it). If you find yourself writing one of them
here, stop.

## Cost

Added: one indexer service, one L2 contract pair (`MMRToken` move + `blitz_ledger`), the operator result-poster, the
agent grant surface. Deleted: Torii and its canary config, the client optimistic machinery, the L3 entry-token path, the
client's Torii read paths. Net deletion in the client; one owned service replaces one rented one.

## Validation

Every gate above is a measured run or an adversarial test, not a demo. Owners are assigned at kickoff against whoever
holds the neighbouring phase-1 code; each section lands with its gate or reports what blocked it.
