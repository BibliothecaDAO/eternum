# Realms phase 3 — value plane and settlement (backend)

Brief for Codex. Structural and backend only: contracts (L2 and L3), settlement, deployer, harness. The web app has its
own brief (`realms-webapp-brief.md`, a second Fable agent) and the game client its own (`realms-client-brief.md`). The
design this brief implements is `realms-value-plane-design.md`; its §9 decisions are settled and are not reopened here.

Owners: **Codex** — every line of code in this brief. **Claude** — lab infrastructure (Piltover on Sepolia, the
orchestrator in the lab compose, Sepolia keys and RPC), reviews of each slice, the adversarial-test review. **Owner** —
the human gates and the numbers.

Rules carried over unchanged: KISS; systemic fixes; success is deletion; evidence before optimization; one truth per
fact; wired or deleted; commit explicit paths; never touch lab containers, compose, or the Caddyfile (Claude's); Torii
stays deleted.

## Decisions this brief inherits (design §9, 2026-08-29)

Value on L2, state on L3; every crossing is an entitlement (L2→L3) or an outcome (L3→L2). One `game_ledger` for both
formats. Withdrawals are **proven only** — no operator-authorized release ever ships. Passes are burned. The web app
owns every L2 action and is the lobby. Prediction market kept, fixed odds, treasury-backed up to a liability cap. Swords
and shields are flags on the registration row. One Blitz preset (`official-60`, cap 96, no registration delay), a
battle-royale preset later, Eternum. Entry 500 LORDS, sword 500, shield 500 — preset values.

## The transport: native messaging, operator as fallback

The pinned Madara supports `--settlement-layer STARKNET --l1-endpoint <sepolia rpc>`; with L1 sync on it produces
transactions for settlement→appchain messages and emits appchain→settlement messages for the orchestrator
(`madara --help`, `--l1-sync-disabled` and `--l1-endpoint`). Piltover is the core contract:
`send_message_to_appchain(to_address, selector, payload)`, `consume_message_from_appchain(from_address, payload)`,
`update_state(snos_output, layout_bridge_output)`; the orchestrator runs `--prover mock` ("in-tree mock prover, dev /
mocknet only") or `atlantic` / `sharp`, `--settle-on-starknet`.

So the two rows of the primitive map onto syscalls, not onto a process:

| Row         | L2 side                                                                                  | L3 side                                                                             |
| ----------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| entitlement | the ledger/vault calls `piltover.send_message_to_appchain(l3_system, selector, payload)` | an `#[l1_handler]` on the game system, asserting `from_address` is the ledger/vault |
| outcome     | the ledger/vault calls `piltover.consume_message_from_appchain(l3_system, payload)`      | the game system calls `send_message_to_l1_syscall(ledger_or_vault, payload)`        |

`apps/operator` (phase-2 decision 4) — see the addendum below: with the measured gas per action it **is built** as stage
1, and native messaging is stage 3's transport. Original text: the same entrypoints behind `assert_only_operator`
instead of the message consumption — build every inbound entrypoint with the guard as its first line so the swap is one
function.

Sepolia gas is free; the prover is the cost. `mock` until the first real season is scheduled; the prover choice is the
owner's, made with a price.

## Order and gates

| #   | Slice                                             | Owner                | Depends on                   |
| --- | ------------------------------------------------- | -------------------- | ---------------------------- |
| S.0 | Settlement shape on the lab (spike)               | Claude               | —                            |
| B.1 | `game_ledger`, `MMRToken`, presets, registrar CLI | Codex                | — (interfaces first, week 1) |
| B.2 | L3: relayed entry, results message, Eternum entry | Codex                | B.1 interfaces, S.0          |
| B.3 | Collectibles: grants at `apply_results`, loadout  | Codex                | B.1, B.2                     |
| B.4 | `vault`: deposits, proven withdrawals             | Codex                | S.0, B.2                     |
| B.5 | Pools (fixed-odds prediction market)              | Codex                | B.1                          |
| C   | Account class v2 + adversarial test               | Codex; Claude review | B.1                          |
| G   | Full gates on Sepolia + lab                       | Owner                | all                          |

B.1's **interfaces are frozen and deployed on Sepolia in week 1** — ABI, addresses in `deploy/madara-lab/.env` and
`contracts/common/addresses/sepolia.json` — so the web agent builds against real contracts while the bodies land.

### S.0 — settlement shape (Claude, spike, ≤ 3 days)

Piltover deployed on Sepolia with the lab chain's program info; the lab Madara restarted with
`--settlement-layer STARKNET --l1-endpoint <sepolia>` and `eth_core_contract_address` → Piltover (chain-config); the
orchestrator in the lab compose with `--prover mock --settle-on-starknet` and its dependencies (MongoDB, localstack for
SQS/S3/SNS/EventBridge, an RPC with storage proofs for SNOS). **Gate:** one `update_state` for a lab block lands on
Sepolia; a `send_message_to_appchain` from a Sepolia test contract executes an `#[l1_handler]` on the lab; a
`send_message_to_l1` from the lab is consumable on Sepolia after the state update. The cost of S (orchestrator + mongo +
localstack) is recorded with the result; if the shape does not hold on the pinned nightly, the fallback is the operator
relay and this brief says so in an amendment, not silently.

### B.1 — `game_ledger` (L2), `MMRToken`, presets

- `game_ledger` (`contracts/ledger`, plain Cairo, OZ AccessControl): roles `ADMIN` (cold), `OPERATOR` (opens games,
  cancels unstarted ones), `GUARDIAN` (vault only, below).
  - `register_preset(preset_id, Preset{entry_fee, protocol_cut_bps, payout_bps: Array<u16>, sword_price, shield_price, mmr: MmrParams{enabled, mean, spread, max_delta, k, regression_bps, min_players}, pm: PmParams{fee_bps, liability_cap}})`
    — admin, write-once, `sum(payout_bps) == 10_000`.
  - `open_game(game_id, preset_id, start, end)` — operator; called by the registrar CLI right after the L3 `create_game`
    (`config/deployer/clean/registrar/calls.ts`, one flow, L3 first).
  - `register(game_id, sword: bool, shield: bool)` — pulls `entry_fee + sword_price·sword + shield_price·shield` into
    `pool[game]`, records `paid[game][owner]`, `flags[game][owner]`, sends the entitlement
    `register_from_l2(game_id, owner, realm_id = 0)` to the L3. `register_with_pass(game_id, pass_id)` burns the season
    pass (`season_pass.burn`, caller-owned) and sends `realm_id = pass_id`; `register_village(game_id, village_pass_id)`
    likewise. Before `start`; one registration per owner per game.
  - `fund(game_id, amount)` — anyone; sponsorship into `pool[game]`.
  - `cancel_game(game_id)` — operator, before `start`; refunds `paid` by pull (`refund(game_id)` per owner), no loop.
  - `apply_results(game_id, ranked: Array<(owner, rank, chests)>)` — consumes the outcome message from the L3
    `prize_distribution_systems` (payload = the same array); reverts unless `!finalized`, roster count and membership
    equal the registered set; then MMR (below), payouts `pool × payout_bps[rank-1] / 10_000` to the owner, protocol cut
    and integer dust to `treasury`, loot chests and elite invites minted (B.3), pools resolved (B.5), `finalized`. One
    call; paging only if a 96-roster call **measures** over the Sepolia limit.
  - MMR: the formula from `contracts/game/src/systems/utils/mmr.cairo` ported with the preset's parameters; the
    lobby-split term deleted; ties use the tied group's average position over `N − 1`; sword doubles a positive delta,
    shield halves a negative one, flags consumed. Result written through `MMRToken.update_mmr_batch`.
- `MMRToken`: delete `IMMRFactoryContract`, `IWorldFactoryMMR`, the `factory` storage, `set_factory_details`,
  `is_factory_mmr_contract`; add `UPDATER_ROLE`; admin grants it to the ledger at deploy.
- Registrar CLI: `createRegistrarGame` gains the L2 `open_game` call with the operator key (`--ledger` target); presets
  registered on both chains by one command (`register-preset` writes the L3 balance preset and the L2 economic preset).
- Preset values for the lab and Sepolia: Blitz = `official-60` with `registration_count_max = 96`,
  `registration_delay_seconds = 0`; economics `entry_fee 500e18`, `protocol_cut_bps 2000`, `payout_bps` per the owner's
  pass (placeholder: top 20 % geometric, rank 1 ≈ 5× entry), `sword_price 500e18`, `shield_price 500e18`, MMR μ 1500 D
  450 Δmax 45 K 50 λ 150 bps min 6. Eternum preset: `entry_fee 0`, `mmr.enabled false`, `points_for_win` set (owner).

**Gate B.1:** Sepolia deployment with frozen ABI; unit tests for every revert path (double registration, register after
start, second `apply_results`, roster mismatch, `sum(payout_bps) ≠ 10_000`, cancel after start); an `apply_results` with
a 96-row roster measured for gas on Sepolia; the MMR port reproduces the existing fixtures from
`systems/utils/mmr.cairo` tests except where the tie rule changes, with the new expectations written down.

### B.2 — L3: relayed entry, results outcome, Eternum entry

- `register_from_l2(from_address, game_id, owner, account, realm_id)` as an `#[l1_handler]` on a new `entry_systems`
  contract (or on `blitz_realm_systems` — pick the one that deletes more), asserting `from_address == ledger`; writes
  `LedgerRegistration{game_id, owner, account, realm_id}`; idempotent by `(game_id, owner)`. `account` is
  `PlayerRegistry.account_of(owner)` read on the L3 at consumption, not sent from L2.
- `settle` (Blitz) asserts a `LedgerRegistration` for `(game_id, caller)` unless `dev_mode_on`; `entry_token_id` and the
  entry-token path are already gone. `realm_systems::create` (Eternum) reads `realm_id` from the registration instead of
  custodying the pass; the pass `transfer_from` and metadata read move to a read of the pass metadata by id (the pass
  contract stays on L2 — realm traits come with the entitlement payload, sent by the ledger from
  `season_pass.get_realm_traits(pass_id)` at registration, so the L3 never calls L2).
- Results: at game end, `prize_distribution_systems` computes ranks and chest allocations as today, then
  `send_message_to_l1_syscall(ledger, [game_id, n, (owner, rank, chests)…])` where
  `owner = PlayerRegistry.owner_of (account)`. Every ERC20 transfer, the escrow fields on `GameRegistry`
  (`fees_collected`, `fees_paid_out`), `fee_recipient`, `VELORDS_BURNER_ADDRESS`, `blitz_get_winner` and the sponsorship
  placeholder are deleted. The `mmr` system, `MMRGameMeta`, `MMRClaimed`, `systems/utils/mmr.cairo`, `mmr_config` in
  `ChainConfig` and the provider's `commit_and_claim_game_mmr` are deleted.
- Eternum: `points_for_win` becomes a preset value the owner sets (non-zero); `season_close` stays; `dev_mode_on`
  semantics unchanged. In-game LORDS is a game resource seeded at deploy as on the appchain today.
- The 96-bot harness registers through the ledger on Sepolia in a `--ledger` mode (test LORDS minted to the bots) and
  keeps the fee-free dev-mode path for lab load runs.

**Gate B.2:** a lab Blitz game whose registrations came only through Sepolia; results consumed on Sepolia by
`apply_results`; a dev-mode harness run unchanged (3,840/3,840); an Eternum lab game settled through a burned pass on
Sepolia; the L3 tree contains no `mmr` system and no ERC20 transfer in `prize_distribution`.

### B.3 — collectibles

- The ledger holds `MINTER_ROLE` on the loot-chest and elite-invite collections (Sepolia instances deployed from
  `contracts/collectibles`); `apply_results` mints `chests` per row and an elite invite by the existing rank rule
  (`models/rank.cairo:53-70`, moved to the ledger). The world's `ICollectible` calls, the `is_non_zero` guards and the
  `grant_role(MINTER_ROLE, prize_distribution_systems)` deploy step are deleted.
- Loadout: `set_loadout(game_id, attrs: Array<u128>)` on the ledger verifies ownership and the timelock against the
  cosmetics collection on L2 and sends the entitlement `loadout_from_l2(game_id, owner, attrs)`; the L3 handler writes
  `BlitzCosmeticAttrsRegister{game_id, player: account, attrs}`. `utils/collectibles.cairo` and the `cosmetic_token_ids`
  registration calldata are deleted; the render path is untouched.
- `collectibles_claim` (chest opening) stays as is on L2.

**Gate B.3:** a Sepolia game whose winners receive chests and an elite invite from `apply_results`; a loadout set on
Sepolia renders in the lab game; the L3 contains no collectible interface.

### B.4 — `vault` (L2): deposits, proven withdrawals

- `vault` (`contracts/vault`): `deposit(game_id, token, amount)` pulls the ERC20 and sends
  `deposit_from_l2(game_id, owner, resource, amount)`; the L3 handler credits the owner's realm through
  `portal_to_structure_arrivals_instant` (the existing whitelist and inefficiency policy from `resource_bridge_systems`
  stay as the L3 policy layer; `transfer_or_mint`, `lp_withdraw`, `velords_claim`, the three-way fee split and every
  `MINTER_ROLE` grant to the world are deleted).
- `withdraw(game_id, resource, amount)` on the L3 burns and sends `release(owner, token, amount)`; `vault.release`
  consumes the proven message, applies `fee_bps` to `treasury`, and queues the remainder: claimable by the owner after
  `delay` (24 h) via `claim(release_id)`, bounded by a per-token daily `cap`; the `GUARDIAN` can cancel a queued release
  during the delay. Delay and cap are circuit breakers against a proof bug and stay after a real prover. The vault pays
  resource ERC20s from its balance first and mints only the shortfall (it holds `MINTER_ROLE` on `season_resources`);
  LORDS is never minted.
- Eternum sequencing: E-1 (B.2, no vault) → E-2 deposits → E-3 withdrawals; E-3 ships only on a real prover.

**Gate B.4:** deposit on Sepolia → resource credited in the lab game; withdraw in the lab → release claimable on Sepolia
after the delay; a release over the daily cap is refused; the guardian cancels a queued release; the L3 tree contains no
`transfer_or_mint`.

### B.5 — pools (fixed-odds prediction market, inside the ledger)

`bet(game_id, outcome, amount)` before `start`, outcomes = registered owners plus `field`; the quoted odds are
`total_pool / outcome_pool` at buy time and are **locked for that bet**; `liability[game]` tracks the worst-case payout
and a bet that would push it past `pool + pm.liability_cap` is refused. `apply_results` resolves the pool to the rank-1
owner (ties → `field`); `claim_bet(game_id)` pays the locked amount from the pool first and the treasury for the
shortfall; `fee_bps` to `treasury`; cancelled games refund stakes. Reference: the locked-odds mode of
`cagecalls/cairo/src/fight_factory.cairo`, without CTF, ERC1155, VRF rounding or tickets.

**Gate B.5:** bets on a Sepolia game paid at locked odds after `apply_results`; a bet over the liability cap refused; a
cancelled game refunds.

### C — account class v2 and the adversarial test (carried from phase 2)

`PlayerRegistry` gains `set_game_system(addr, allowed)` / `is_game_system(addr)` under a `DEPLOYER_ROLE`, written by
`deploy-gameplay-contracts.ts` after the world deploy; `__execute__` asserts `is_game_system(call.to)` for every call;
`upgrade` is binding-authority only. The lab is redeployed on v2 (accounts re-bound from the authority's records).
**Gate:** rotate a key from the authority, attempt ERC20/ERC721 `transfer`/`approve` and a call to a non-system contract
from the account — every attempt reverts; `upgrade` without the authority reverts. Claude reviews the test before the
gate.

### G — full gates (owner)

1. **Blitz on Sepolia + lab:** 96 bots register with 500 test LORDS each on Sepolia, some with swords/shields → play on
   the lab → results message consumed → MMR moved on Sepolia (modifiers consumed correctly), prizes paid by
   `payout_bps`, chests and elite invites minted, pools resolved; a second `apply_results` and a roster that differs
   from the registered set both revert; `cancel_game` refunds.
2. **Eternum E-1 on the lab:** entry by burned pass, a season with `points_for_win` reached, `season_close`, prizes from
   a funded pool through `apply_results`. E-2 deposits credited. E-3 only with a real prover.
3. **C** passes on the redeployed lab.
4. **Deletions verified by the tree:** no `mmr` system, no ERC20 transfer in `prize_distribution`, no collectible
   interface, no `transfer_or_mint`, no pass custody, no `apps/operator`.

## Cost

Added: `contracts/ledger`, `contracts/vault`, Piltover + orchestrator + MongoDB + localstack in the lab compose
(Claude), Sepolia deployments of ledger, vault, MMR, collectibles, test LORDS, season pass. Deleted: the L3 `mmr` system
and its math, the L3 prize transfers and escrow, direct collectible minting, pass custody, `transfer_or_mint` and the
resource bridge's fee split, `lp_withdraw`, `velords_claim`, the entry-token remnants, the MMR factory hook, and the
operator process before it existed. Net: two L2 contracts and one settlement stack replace an L3 that moved value.

## Addendum 2026-08-29 (evening) — settlement economics, and what it changes

**The fact:** on the old mainnet games the median action cost **~340M L2 gas**; a 96-player Blitz (~4,000 actions) is
~1.4T gas, an Eternum season far more. Proving cost is proportional to gas on every path — SNOS through a prover, or
SNIP-36 chunks (1.1B cap per transaction, 75M gas verification each) — so at the quoted ≈ 10–15 ¢ per 1B gas a Blitz
game costs ≈ $150–200 to prove, and SNIP-36 would need ~1,300 chunks per game. Validity settlement is not affordable at
this gas per action; SNIP-36 today proves one Starknet transaction (not an appchain state transition) and does not
change that.

**What it changes in this brief:**

1. **Stage 1 is operator attestation, not a fallback.** `apply_results` and every other inbound L2 entrypoint ship
   behind `assert_only_operator` (idempotent by `game_id`, evented, with each game's result commitment posted).
   `apps/ operator` is built as the phase-2 brief decided (two loops, Postgres cursor). Deposits and registrations may
   still ride `piltover.send_message_to_appchain` → `#[l1_handler]` — that direction needs no proof — but that is an S.1
   choice, not a dependency for B.1–B.3.
2. **S.0 is now the gas-per-action measurement**: the current game contracts deployed on Sepolia, a harness game
   replayed there, gas per action by system recorded (median, p95, the top offenders). This is the baseline for the Dojo
   exit and the number that decides when stage 3 is affordable. One week, no infrastructure.
3. **S.1 (was S.0) — the Piltover/orchestrator shape** moves behind S.0 and behind B.3; it is built with the mock prover
   for the messaging shape, and validity settlement (stage 3) is scheduled only when S.0's number × a quoted prover
   price is a small fraction of a game's pool. Aggregation: one `update_state` per day for all finished games (the
   orchestrator batches; the measured ~242M gas per update amortizes).
4. **Decision 1 reopened for the owner.** "Proven-only withdrawals" now means no Eternum cash-out until stage 3. The
   choices are (A) the capped + delayed operator release with a guardian as the stage-1 mechanism, or (B) no withdrawals
   in season one. B.4 stays last in the order either way; the vault's deposit side is unaffected.

Everything else in B.1–B.3, B.5 and C stands: the ledger economics, the MMR port, presets, collectibles at
`apply_results`, pools, and account class v2 are needed in every settlement stage.

## Out of this brief

The web app (its brief), the game client (its brief), a real prover contract and its cost, mainnet, the battle-royale
preset (a later preset registration, no code), ERC1155 swords/shields (only if chests should drop them), the marketplace
port (folds into the web app).
