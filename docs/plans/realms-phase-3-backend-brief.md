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

**Settlement is postponed (owner, 2026-08-29 evening).** Stage 1 — operator attestation — is the only transport in this
brief; nothing below depends on Piltover, the orchestrator, or Sepolia messaging. When settlement returns, the mock
prover is enough for its shape, and every inbound entrypoint already has the one-line guard to swap.

| #   | Slice                                                     | Owner                | Depends on                     |
| --- | --------------------------------------------------------- | -------------------- | ------------------------------ |
| B.1 | `game_ledger`, `MMRToken`, pass upgrades, presets, CLI    | Codex                | — (interfaces first, week 1)   |
| B.2 | L3: relayed entry, results post, Eternum entry            | Codex                | B.1 interfaces                 |
| B.3 | Collectibles: grants at `apply_results`, loadout          | Codex                | B.1, B.2                       |
| B.5 | Pools (fixed-odds prediction market)                      | Codex                | B.1                            |
| C   | Account class v2 + adversarial test                       | Codex; Claude review | B.1                            |
| B.4 | `vault`: deposits; withdrawals per the owner's decision 1 | Codex                | B.2, owner's decision 1        |
| G   | Full gates on Sepolia + lab                               | Owner                | all                            |
| S.0 | Gas per action measured on Sepolia (for the Dojo exit)    | Claude               | — (runs beside, gates nothing) |

B.1's **interfaces are frozen and deployed on Sepolia in week 1** — ABI, addresses in `deploy/madara-lab/.env` and
`contracts/common/addresses/sepolia.json` — so the web agent builds against real contracts while the bodies land.

### S.0 — gas per action (Claude, beside the rest, gates nothing)

The current game contracts deployed on Sepolia, a harness game replayed there, gas per action by system recorded
(median, p95, top offenders). It is the Dojo-exit baseline and the number that decides when validity settlement is
affordable; it does not block any B slice. The settlement shape (Piltover, orchestrator with `--prover mock`, in-tree at
the Madara commit behind the pinned image digest) is **out of this brief** until the owner brings it back.

- `game_ledger` (`contracts/ledger`, plain Cairo, OZ AccessControl): roles `ADMIN` (cold), `OPERATOR` (opens games,
  cancels unstarted ones), `GUARDIAN` (vault only, below).
  - `register_preset(preset_id, Preset{entry_fee, protocol_cut_bps, paid_fraction_bps, decay_bps, sword_price, shield_price, mmr: MmrParams{enabled, mean, spread, max_delta, k, regression_bps, min_players}, pm: PmParams{fee_bps, liability_cap, seed}})`
    — admin, write-once. Payouts are parametric so one preset serves any roster size:
    `W = ceil(N × paid_fraction_bps / 10_000)` winners, weight of position `k` is `decay^(k−1)`
    (`decay = decay_bps / 10_000`), normalized over `1..W`. Lab values: `protocol_cut_bps 2000`,
    `paid_fraction_bps 2000`, `decay_bps 9600` → at N = 96, entry 500: 20 paid, rank 1 ≈ 2,780 (5.6× entry), rank 20 ≈
    1,280 (2.6×). Owner-tunable.
  - `open_game(game_id, preset_id, start, end)` — operator; called by the registrar CLI right after the L3 `create_game`
    (`config/deployer/clean/registrar/calls.ts`, one flow, L3 first).
  - `register(game_id, sword: bool, shield: bool)` — pulls `entry_fee + sword_price·sword + shield_price·shield` into
    `pool[game]`, records `paid[game][owner]`, `flags[game][owner]`, **emits**
    `Registered(game_id, owner, realm_id, metadata)`; in stage 1 `apps/operator` consumes the event and writes
    `register_from_l2` on the L3; the ledger calls `piltover.send_message_to_appchain` only when `core_contract != 0`.
    `register_with_pass(game_id, pass_id)`: the player has approved the ledger; the ledger asserts
    `owner_of(pass_id) == caller`, calls `season_pass.burn(pass_id)` and sends `realm_id = pass_id` plus
    `season_pass.get_encoded_metadata(pass_id)` (three felts) in the payload;
    `register_village(game_id, village_pass_id)` likewise without metadata. **Both pass contracts gain
    `burn(token_id)`** — owner or approved, ERC721 `burn` from the component — shipped as an upgrade (both are
    `UpgradeableComponent`) and deployed fresh on Sepolia in B.1. The Village Pass transfer hook (`before_update`,
    `village_pass/src/contract.cairo:116`) rejects transfers from non-distributors, and a burn is a transfer to zero, so
    the deploy grants the ledger `DISTRIBUTOR_ROLE`. Before `start`; one registration per owner per game.
  - `fund(game_id, amount)` — anyone; sponsorship into `pool[game]`, recorded in `paid[game][funder]` so a cancelled
    game refunds it through the same pull as fees.
  - `cancel_game(game_id)` — operator, before `start`; refunds `paid` by pull (`refund(game_id)` per owner), no loop.
  - `apply_results(game_id, ranked: Array<(owner, rank, chests)>)` — stage 1: `assert_only_operator`; stage 3: consumes
    the outcome message. Reverts unless `!finalized`, roster count and membership equal the registered set, the array is
    ordered by rank, and ranks are **competition ranks** (1, 1, 3 — a tied group of `t` at rank `r` is followed by rank
    `r + t`). Money, in this order: `cut = floor(pool × protocol_cut_bps / 10_000)`; `prize_pool = pool − cut`; position
    allocations `alloc_k = floor(prize_pool × weight_k / Σweight)` for `k ∈ 1..W`; **tied ranks**: the `t` players
    sharing competition rank `r` split `alloc_r + … + alloc_{r+t−1}` equally (floor), and the next rank `r + t` starts
    at position `r + t` — positions are consumed once; `treasury` receives `cut` plus every rounding remainder so the
    game's balance is exactly zero afterwards (asserted). Then MMR (below), loot chests and elite invites minted (B.3),
    the bet pool resolved (B.5 — separate money), `finalized`. One call; paging only if a 96-roster call **measures**
    over the Sepolia limit.
  - MMR: the formula from `contracts/game/src/systems/utils/mmr.cairo` ported with the preset's parameters; the
    lobby-split term deleted; ties use the tied group's average position `(r + (r + t − 1)) / 2` over `N − 1` — the same
    competition ranks; sword doubles a positive delta, shield halves a negative one, flags consumed. Result written
    through `MMRToken.update_mmr_batch`.
- Constructor:
  `(admin, operator, treasury, lords, mmr_token, season_pass, village_pass, loot_chest, elite_invite, cosmetics)`; the
  guardian belongs to the vault only. Messaging addresses are not constructor arguments:
  `set_messaging(core_contract, l3_entry_system)` by the admin exists for the settlement era and is unset in stage 1.
  Addresses live in `contracts/common/addresses/sepolia.json` under `ledger`, `vault`, `lords` (test LORDS), `mmrToken`,
  `seasonPass`, `villagePass`, `lootChests`, `eliteInvite`, `cosmetics`, and are exported to `deploy/madara-lab/.env`.
- `MMRToken`: delete `IMMRFactoryContract`, `IWorldFactoryMMR`, the `factory` storage, `set_factory_details`,
  `is_factory_mmr_contract`; add `UPDATER_ROLE`; admin grants it to the ledger at deploy.
- Registrar CLI: `createRegistrarGame` gains the L2 `open_game` call with the operator key (`--ledger` target); presets
  registered on both chains by one command (`register-preset` writes the L3 balance preset and the L2 economic preset).
- Preset values for the lab and Sepolia: Blitz = `official-60` with `registration_count_max = 96`,
  `registration_delay_seconds = 0`; economics `entry_fee 500e18`, `protocol_cut_bps 2000`, `paid_fraction_bps 2000`,
  `decay_bps 9600`, `sword_price 500e18`, `shield_price 500e18`,
  `pm {fee_bps 500, liability_cap 10_000e18, seed 100e18, claim_window_seconds 604_800}`, MMR μ 1500 D 450 Δmax 45 K 50
  λ 150 bps min 6. Eternum preset: `entry_fee 0`, `mmr.enabled false`, `points_for_win` set (owner).

**Gate B.1:** Sepolia deployment with frozen ABI; unit tests for every revert path (double registration, register after
start, second `apply_results`, roster mismatch or unordered or non-competition ranks, `paid_fraction_bps` or `decay_bps`
outside `(0, 10_000]`, cancel after start); a **conservation** test — `Σ payouts + cut + dust == pool` and the game's
balance is zero after `apply_results` — for N ∈ {6, 24, 96}; tie fixtures (1,1,3 and 1,2,2,4) for both prizes and MMR;
an `apply_results` with a 96-row roster measured for gas on Sepolia; the MMR port reproduces the existing fixtures from
`systems/utils/mmr.cairo` tests except where the tie rule changes, with the new expectations written down.

### B.2 — L3: relayed entry, results outcome, Eternum entry

- `register_from_l2(game_id, owner, realm_id, metadata: (felt252, felt252, felt252))` — stage 1 an operator-gated
  entrypoint written by `apps/operator`, stage 3 an `#[l1_handler]` asserting `from_address == ledger` — on a new
  `entry_systems` contract; writes `LedgerRegistration{game_id, owner, realm_id, metadata}` keyed by `(game_id, owner)`,
  idempotent. No account in the payload: `settle` (called by the gameplay account) resolves
  `owner = PlayerRegistry.owner_of(caller)` and reads `LedgerRegistration(game_id, owner)` — the registry already exists
  on the L3 (`contracts/player-account/src/player_registry.cairo`). Eternum's `realm_systems::create` reads `realm_id`
  and decodes `metadata` exactly as `utils/realm.cairo:160-166` decodes the pass today.
- `settle` (Blitz) asserts a `LedgerRegistration` for `(game_id, owner_of(caller))` unless `dev_mode_on`. **Correction
  to the baseline:** the entry-token path is _not_ gone — `settle` still takes `entry_token_id` and calls
  `resolve_and_consume_entry_token` (`blitz/contracts.cairo:93-147`); deleting it (`obtain_entry_token`, the
  mint/consume internals, the issuance config, the ERC721 wiring) is part of B.2. `realm_systems::create` (Eternum)
  reads `realm_id` from the registration instead of custodying the pass; the pass `transfer_from` and metadata read move
  to a read of the pass metadata by id (the pass contract stays on L2 — realm traits come with the entitlement payload
  as the three felts of `season_pass.get_encoded_metadata(pass_id)`, sent by the ledger at registration, so the L3 never
  calls L2).
- Ranking becomes **competition ranking** on the L3 (`prize_distribution/contracts.cairo:442-456` today advances
  `last_rank` by one on a strict decrease — dense; it advances by the tied count instead), so every consumer — the
  results post, `RankPrize`, the review — shares one rule.
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

- `vault` (`contracts/vault`, admin-configured: `set_token(resource_id, token)` for the token↔resource map,
  `set_policy(token, fee_bps, daily_cap, delay)`): `deposit(game_id, structure_id, token, amount)` pulls the ERC20 and
  sends `deposit_from_l2(game_id, owner, structure_id, resource, amount)`; the L3 handler asserts the structure is owned
  by `account_of(owner)` and credits it through `portal_to_structure_arrivals_instant` (the destination-structure rule
  of `resource_bridge_systems.cairo:60-83` kept) (the existing whitelist and inefficiency policy from
  `resource_bridge_systems` stay as the L3 policy layer; `transfer_or_mint`, `lp_withdraw`, `velords_claim`, the
  three-way fee split and every `MINTER_ROLE` grant to the world are deleted).
- `withdraw(game_id, structure_id, resource, amount)` on the L3 (source-structure ownership asserted as today) burns and
  sends `release(game_id, owner, structure_id, token, amount)`; `vault.release` consumes the proven message, applies
  `fee_bps` to `treasury`, and queues the remainder: claimable by the owner after `delay` (24 h) via
  `claim(release_id)`, bounded by a per-token daily `cap`; the `GUARDIAN` can cancel a queued release during the delay —
  a cancelled release is **re-credited on the L3 as a deposit** (`deposit_from_l2` with the same `structure_id`), so a
  legitimately burned resource is never lost; one rule, no special case. Delay and cap are circuit breakers against a
  proof bug and stay after a real prover. The vault pays resource ERC20s from its balance first and mints only the
  shortfall (it holds `MINTER_ROLE` on `season_resources`); LORDS is never minted.
- Eternum sequencing: E-1 (B.2, no vault) → E-2 deposits → E-3 withdrawals; E-3 ships only on a real prover.

**Gate B.4:** deposit on Sepolia → resource credited in the lab game; withdraw in the lab → release claimable on Sepolia
after the delay; a release over the daily cap is refused; the guardian cancels a queued release; the L3 tree contains no
`transfer_or_mint`.

### B.5 — pools (fixed-odds prediction market, inside the ledger)

**Separate money:** bets never touch `pool[game]`; they live in `bet_pool[game]`, and prizes never touch `bet_pool`.
`bet(game_id, outcome, amount)` before `start`, outcomes = registered owners plus `field`, any number of bets per
bettor, each a ticket `(game_id, ticket_id) → {bettor, outcome, stake, locked_payout}`. Odds are quoted **before** the
stake is added, from seeded pools so the first bet has finite odds:
`odds = (bet_pool + O × seed) / (outcome_pool[o] + seed)` with `O` outcomes and `pm.seed` a virtual amount (lab: 100
LORDS) that is never paid out; `locked_payout = floor(amount × odds)`. **Backstop:** the ledger holds a `reserve`
balance in LORDS funded by the admin (`fund_reserve(amount)`, withdrawable by the admin only above the committed
liability); `committed` is the sum over unresolved games of `max(0, max_o liability[game][o] − bet_pool[game])`.
Solvency: `liability[game][o] += locked_payout`; the bet is refused if the game's shortfall after it would exceed
`pm.liability_cap` **or** `committed` would exceed `reserve`. No transfer from an external treasury is ever needed:
shortfalls are paid from `reserve`. `apply_results` resolves to the rank-1 owner (ties → `field`).
`claim_bet(game_id, ticket_id)` pays `locked_payout − floor(locked_payout × pm.fee_bps / 10_000)` from `bet_pool` first,
then from `reserve` for the shortfall; the fee stays in `bet_pool` and, after every winning ticket is claimable, the
remainder of `bet_pool` sweeps to `treasury` (`sweep_bets(game_id)` after `end + pm.claim_window_seconds`; unclaimed
winning tickets sweep too). Cancelled games refund every ticket's stake in full (fees are taken only on winnings). Lab
values: `fee_bps 500`, `liability_cap 10_000 LORDS`, `seed 100 LORDS`, `claim_window_seconds 604_800`; the lab reserve
is funded with 50,000 test LORDS. Reference: the locked-odds mode of `cagecalls/cairo/src/fight_factory.cairo`, without
CTF, ERC1155, VRF rounding or tickets.

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
   the lab → results message consumed → MMR moved on Sepolia (modifiers consumed correctly), prizes paid by the
   parametric payouts (conservation asserted), chests and elite invites minted, pools resolved; a second `apply_results`
   and a roster that differs from the registered set both revert; `cancel_game` refunds.
2. **Eternum E-1 on the lab:** entry by burned pass, a season with `points_for_win` reached, `season_close`, prizes from
   a funded pool through `apply_results`. E-2 deposits credited. E-3 only with a real prover.
3. **C** passes on the redeployed lab.
4. **Deletions verified by the tree:** no `mmr` system, no ERC20 transfer in `prize_distribution`, no collectible
   interface, no `transfer_or_mint`, no pass custody; `apps/operator` runs the two loops with a Postgres cursor and
   survives a restart mid-game without a duplicate write.

## Cost

Added: `contracts/ledger`, `contracts/vault`, `apps/operator` (two loops, one cursor table), `burn` on both passes,
Sepolia deployments of ledger, vault, MMR, collectibles, test LORDS, passes. Deleted: the L3 `mmr` system and its math,
the L3 prize transfers and escrow, the entry-token path, direct collectible minting, pass custody, `transfer_or_mint`
and the resource bridge's fee split, `lp_withdraw`, `velords_claim`, the MMR factory hook. Deferred, not added:
Piltover, the orchestrator and its MongoDB/localstack. Net: two L2 contracts and one small process replace an L3 that
moved value.

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
   still ride `piltover.send_message_to_appchain` → `#[l1_handler]` — that direction needs no proof — but that is for
   the settlement era, not a dependency for anything here.
2. **S.0 is now the gas-per-action measurement**: the current game contracts deployed on Sepolia, a harness game
   replayed there, gas per action by system recorded (median, p95, the top offenders). This is the baseline for the Dojo
   exit and the number that decides when stage 3 is affordable. One week, no infrastructure.
3. **The Piltover/orchestrator shape is postponed** (owner, same evening); when it returns, the mock prover is enough
   for the messaging shape, and validity settlement (stage 3) is scheduled only when S.0's number × a quoted prover
   price is a small fraction of a game's pool. Aggregation: one `update_state` per day for all finished games (the
   orchestrator batches; the measured ~242M gas per update amortizes).
4. **Decision 1 reopened for the owner.** "Proven-only withdrawals" now means no Eternum cash-out until stage 3. The
   choices are (A) the capped + delayed operator release with a guardian as the stage-1 mechanism, or (B) no withdrawals
   in season one. B.4 stays last in the order either way; the vault's deposit side is unaffected.

Everything else in B.1–B.3, B.5 and C stands: the ledger economics, the MMR port, presets, collectibles at
`apply_results`, pools, and account class v2 are needed in every settlement stage.

## Review log

- 2026-08-29, Codex: six findings (pool over-commitment, no `burn` on the passes, contradictory entitlement payload,
  bet-pool solvency, missing structure context in vault messages, stale baseline on the entry token and S.0) — all
  accepted and folded into B.1, B.2, B.4, B.5 and S above; the ledger constructor and address keys added. B.1 can land
  independently.
- 2026-08-29, Codex, second pass: tie double-counting (→ competition ranks, positions consumed once, the L3 ranking rule
  changed to match), `payout_bps` remnants (→ parametric fields, conservation and tie fixtures in the gate), bet refunds
  and backstop (→ `stake` on tickets, `claim_window_seconds` in the preset, an admin-funded `reserve` inside the ledger
  with a committed-liability bound), ledger wiring (→ guardian out of the constructor, `register` emits and calls
  Piltover only when configured, Village Pass `DISTRIBUTOR_ROLE` granted to the ledger), stale gates (→ table, B.2, G
  and Cost aligned; settlement postponed). All accepted.

## Out of this brief

The web app (its brief), the game client (its brief), a real prover contract and its cost, mainnet, the battle-royale
preset (a later preset registration, no code), ERC1155 swords/shields (only if chests should drop them), the marketplace
port (folds into the web app).
