# Realms value plane — both formats on the L2/L3 split

Design, 2026-08-29. Written from a repo baseline taken the same day (every number below cites its file); it extends
section B of `realms-phase-2-brief.md` from "Blitz ledger" to the whole value plane — Blitz and Eternum, names,
collectibles, bridge, AMM, prediction market — so the tuning pass and the contract work start from one design instead of
five. Nothing here is built yet; the owner decisions it needs are listed at the end.

## 0. What the baseline actually is (facts that shape the design)

- **There is no mainnet Blitz baseline in the tree.** `GameChain` is `madara | appchain`
  (`packages/chain/src/endpoints.ts:1`); `manifest_mainnet.json` is the S1 world with no registrar and no presets. The
  live game is appchain **preset 6** ("Regular Fast", `official-60`, 60 min, cap 24, free entry, STRK fee token —
  `config/deployer/clean/constants.ts:9`, verified live on the appchain Torii). `config/generated/blitz.mainnet.json` is
  a stale artifact of a deleted branch: the historical mainnet _intent_ was **100 LORDS entry**, 30 % protocol cut (15 %
  creator, 15 % veLORDS to a hardcoded burner marked `todo` — `contracts/game/src/constants.cairo:7`), and a computed
  prize curve (`systems/utils/prize.cairo`) whose sponsorship branch is dead (`prize_distribution/contracts.cairo:374`
  hardcodes 0).
- **MMR** is one chain-wide singleton in `ChainConfig` (μ 1500, D 450, Δmax 45, K 50, λ 0.015, min 6 players —
  `config/source/blitz/base.ts:55-67`), computed by a permissionless one-shot `commit`+`claim` over the whole lobby
  (`systems/mmr/contracts.cairo:92-271`), token deployed on mainnet only (`0x0` on appchain/madara, so MMR never ran on
  the chain Blitz runs on). Two defects worth fixing in the port: dense ranks divide by N so any tie skews every delta
  positive; the lobby-split term is dead (both medians are the same value, `:250`). No modifier concept exists.
- **Eternum has no bridge.** The in-world "resource bridge" is a same-chain window onto ERC20s: it `transfer_from`s on
  deposit and **mints when short** on withdraw (`systems/utils/bridge.cairo:40-48`). Nothing in `contracts/`, `deploy/`,
  `config/` sends or consumes a cross-chain message. The bank AMM is pure Dojo state (`models/bank/market.cairo`) with
  one ERC20 escape hatch (`bank/contracts/liquidity.cairo:255-263`). ammv2 on L2 mainnet is live (35 LORDS pools, 1.5 %
  fee, `contracts/ammv2/scripts/state/pools/mainnet.json`); the client's `GameAmmClient` is built and unmounted.
  Eternum's entry is a Season Pass NFT transferred into the world contract (`systems/utils/realm.cairo:150-158`),
  villages a Village Pass the same way. `pointsForWin = 0` everywhere, so no configured Eternum has a win condition.
- **Collectibles** are L2 ERC721s (`contracts/collectibles`, one class, one instance per collection) minted **by the
  world** at prize claim (`prize_distribution/contracts.cairo:255-294`), which is a silent no-op when the address is
  `0x0` — i.e. on every non-mainnet config. Equipped skins are an L3 row (`BlitzCosmeticAttrsRegister`) whose ownership
  check runs against the **gameplay** account (`utils/collectibles.cairo:35-36`), which on the new stack never holds an
  NFT. The client's inventory read path (marketplace Torii) was deleted in `a1a69cc9518`; the render path from the RECS
  row is intact. Already-minted chests and cosmetics sit in L2 wallets and need no migration.
- **Prediction market** is an external Dojo world on mainnet (Gnosis-CTF clone, vault model, ~47 entrypoints across two
  contracts), resolved by a same-chain oracle read of `prize_distribution_systems.blitz_get_winner`, fed by its own
  Torii; the client surface was excised in `5051303e58e`. Its oracle is exactly what an L3 move breaks.
- **Names**: `accountName` in the account store has no writer left (the Controller `username()` path went with
  Cartridge), so every player is `Player-<6 hex>`; `set_address_name` is global per address, requires a structure, and
  its uniqueness assert is commented out (`systems/name/contracts.cairo:31`).

## 1. One principle, one primitive

**Value lives on L2 where identity lives; the L3 holds game state and nothing worth stealing** (decided 2026-08-26).
Every crossing between the two chains is one of two things, and only two:

| Direction | Name        | Examples                                           | Who writes it                                                              |
| --------- | ----------- | -------------------------------------------------- | -------------------------------------------------------------------------- |
| L2 → L3   | entitlement | registration, pass lock, deposit, cosmetic loadout | `apps/operator` relay, idempotent by key, after `ACCEPTED_ON_L2` + 1 block |
| L3 → L2   | outcome     | final ranks, chest allocations, withdrawals        | `apps/operator` post (stage 1) → proven message (phase 3), same entrypoint |

Both loops already exist in the phase-2 decisions. Every feature below is a **row in one of these two tables**, not a
new mechanism. Blitz and Eternum differ only in which rows they use and in the numbers — which is what "same engine,
different parameters" should mean at the contract level too.

Second rule, new: **the web app owns every L2 action; the game client owns L3 play.** `apps/web` already has the wallet
connectors, SIWS, Postgres, and an L2 indexer; the game client has a gameplay key and a herald socket. So registering,
locking a pass, depositing, withdrawing, buying a modifier, opening a chest, choosing a loadout, betting, and picking a
name all happen at realms.world with the identity wallet, and the game client links out. This deletes the client's need
for an L2 signer, the marketplace-Torii dependency, and the "which address holds the NFT" seam in one move. The end
state (owner, 2026-08-29): **one web app** — account portal, marketplace, ledger actions, chests, bridge, swap — and
**one desktop game client**; the mobile client (phase x, `apps/mobile` in D) is a second client of the same L3 and the
same web app, not a third place for value actions.

## 2. `game_ledger` (L2) — one contract for both formats

The phase-2 `blitz_ledger` becomes `game_ledger`; same entrypoints, format-agnostic, keyed by `game_id`.

- **Presets** — write-once, admin (cold key): `entry_fee`, `protocol_cut_bps`, `payout_bps[]`, `sword_price`,
  `shield_price`, `mmr: {mean, spread, max_delta, k, regression}`. MMR parameters move **into the preset** (today they
  are chain-wide); an Eternum preset simply has `entry_fee = 0` and `mmr` disabled.
- **`open_game(game_id, preset_id, start, end)`** — operator key, called by the registrar CLI right after the L3
  `create_game`.
- **Entry rows** (entitlements): `register(game_id)` pulls `entry_fee` (Blitz); `register_with_pass(game_id, pass_id)`
  and `register_village(game_id, village_pass_id)` transfer the pass into the ledger and record `pass_owner[game][pass]`
  (Eternum). Passes are **burned** — a season pass is season-scoped, and burning needs no storage and no return
  entrypoint; lock-and-return (`withdraw_pass` after `end`, a pull) only if the owner decides passes keep post-season
  value (decision 2). The relay writes `register_relayed(game_id, owner, gameplay_account, realm_id | 0)` on L3;
  Eternum's `realm_systems::create` reads the relayed realm id instead of custodying the NFT, and its season-pass
  custody code is deleted.
- **Pool** — one bucket per game: entry fees, modifier fees and `fund(game_id, amount)` (sponsorship — the dead branch
  of the old curve, alive again for Eternum where the pool is funded, not paid in) all land in `pool[game]`;
  `paid[game][owner]` records each owner's total; `cancel_game` refunds `paid` in full before `start`.
- **Results** (outcome): `apply_results(game_id, ranked: Array<(owner, rank, chests)>)` — one call; it reverts unless
  the roster equals the registered set in count and membership, then: MMR deltas computed on-chain from ranks and
  current MMR with the preset's parameters (modifier flags consumed), payouts by `payout_bps` to the registered owner,
  protocol cut plus integer dust to `treasury`, loot chests and elite invites **minted by the ledger** (it holds
  `MINTER_ROLE` on those two ERC721s — the world's direct-mint path and its `0x0` guards are deleted), `finalized` set.
  A second call reverts. Paging (`post_results` + `finalize`) is added only if a 96-roster call _measures_ over the
  transaction limit on Sepolia — not before. Stage 2 swaps the operator check for `consume_message_from_l3`; nothing
  else changes.
- **MMR math in the port**: keep the formula (expected score, tanh-capped delta, mean regression), **delete** the dead
  lobby-split term, and fix ties by using the **average position** of a tied group (competition ranking) over `N − 1`,
  so a full-lobby tie yields zero deltas instead of all-positive ones. `MMRToken` loses its factory hook for an
  `UPDATER_ROLE` granted to the ledger (decision 2 of the phase-2 brief). The L3 `mmr` system, `MMRGameMeta`,
  `MMRClaimed`, and the cubit math under `systems/utils/mmr.cairo` are **deleted** — the L3 no longer computes MMR.
- **Prizes leave the L3 too**: `prize_distribution` keeps ranking and the series chest allocator (`GameChestReward`) and
  loses every ERC20 transfer, the escrow fields on `GameRegistry`, `fee_recipient`, the veLORDS burner constant, and
  `blitz_get_winner`'s only consumer.

## 3. Names — an identity fact, mirrored

The display name is chosen once at first SIWS sign-in in `apps/web` (Controller users get it prefilled from Cartridge,
every other wallet types one), stored on the better-auth user with a case-insensitive unique index, 3–20 characters,
changeable there. The ledger, leaderboards and the web resolve `owner → name` from that table. The L3 `AddressName` row
stays what it already is — a mirror: the client writes `set_address_name` from the gameplay account at settle with the
name from the identity session (the same call it makes today, with a real name instead of `Player-…`), and a redeployed
L3 is re-mirrored on the next settle. No contract change; the unused `accountName` store field and its `Player-`
fallback go.

## 4. Collectibles — import is straightforward, granting moves to L2

- **Inventory**: the cosmetics ERC721 is `ERC721Enumerable`, so a wallet's items are `balance_of` +
  `token_of_owner_by_index` + `attributes_raw` in one multicall read against the L2 RPC — no indexer, no Torii. The web
  app reads it for the loadout picker and the chest-opening page; the game client never reads L2.
- **Granting**: chests and elite invites are minted by `game_ledger.apply_results` from the posted
  `(owner, rank, chests)` rows (the L3 allocator still computes the counts; the operator posts them like ranks). Chest
  opening stays exactly the existing L2 `collectibles_claim` (player-signed, Cartridge VRF) — its VRF dependency is the
  one Cartridge remnant we keep until the VRF is replaced, and it is behind a claim the player performs at leisure.
- **Loadout**: chosen in the web app, verified there against the wallet (ownership + timelock to `end`), relayed as an
  entitlement row `set_loadout(game_id, owner, attrs[])` that writes `BlitzCosmeticAttrsRegister`. The L3's ownership
  check against the gameplay account (`utils/collectibles.cairo:18-47`) is deleted — the RECS row and the whole render
  path (`player-cosmetics-store.ts`) are untouched.

## 5. Eternum's economy: bank on L3, bridge as a capped outcome

- **Bank AMM stays on the L3 unchanged**; its `lp_withdraw` escape hatch into ERC20s is deleted — removing liquidity
  pays in-game resources, and bridging out is an explicit, separate action. LORDS inside the game is a game resource
  seeded at deploy (as on the appchain today).
- **ammv2 stays on L2 as is** — it is already the L2 market for the resource ERC20s. The client's unmounted
  `GameAmmClient` and `services/amm/*` are deleted (wired or deleted); the web app's swap page uses the ammv2 SDK.
- **The bridge** is two rows of the primitive plus a policy the brief did not yet allow:
  - _deposit_ (entitlement): `vault.deposit(game_id, token, amount)` on L2 locks LORDS / burns a resource ERC20; the
    relay writes `deposit_relayed(game_id, owner, resource, amount)` on L3, which credits the realm through the existing
    arrival path. The L3 mints only through this entrypoint; `transfer_or_mint` and every `MINTER_ROLE` grant to the
    world are deleted.
  - _withdraw_ (outcome): `withdraw(game_id, resource, amount)` on L3 burns and emits; the operator posts
    `vault.release(owner, token, amount)` on L2. **Bounded loss instead of trust**: a release is claimable after a **24
    h delay**, the vault enforces a **per-token daily cap** set in the preset, and a **guardian** cold key can cancel a
    pending release — so a compromised operator key can lose at most one day's cap, never the vault. Stage 2 replaces
    the operator post with the proven L3→L2 message and the delay collapses to proof cadence; delay and cap stay as
    circuit breakers.
  - _fees_: the three-way velords / season-pool / client split and its "all three non-zero" revert
    (`utils/bridge.cairo:232-235`) become **one `bridge_fee_bps` to `treasury`** on the L2 side; the hyperstructure
    inefficiency burn stays on the L3 where it is game balance.
- **Sequencing** so Eternum can run before the bridge exists: E-1 Eternum on the lab with pass-lock entry, in-game
  LORDS, win condition set (`points_for_win > 0`), prizes and elite/chests through `apply_results` from a funded pool;
  E-2 deposits; E-3 capped withdrawals. A season played on E-1 is a real season — value enters as passes and leaves as
  prizes.

## 6. Prediction market — only with evidence, then as a parimutuel in the ledger

First question, unanswered by the repo: **does it earn its place?** No usage data (markets created, bettors, volume)
exists in the tree; build it only if the old mainnet PM's history shows players used it, otherwise cut it and delete the
enum stubs in the client. If it stays: **do not port and do not adopt**. Nothing reusable turned up on Starknet (a
search finds only token-price noise), and the old contract's shape — CTF positions, vault pricing, an oracle that reads
the game chain — is the wrong shape now that the winner is already known **on L2** at `apply_results`. A parimutuel "who
wins game X" pool is ~150 lines inside `game_ledger` (a module, not a contract — resolution is internal to
`apply_results`):

- `bet(game_id, outcome, amount)` before `start` (outcomes = registered owners plus `field`), LORDS into
  `outcome_pool[game][outcome]`, `stake[game][outcome][bettor]`;
- resolution is `apply_results` calling `resolve_pool(game_id, winner)` in the same contract — no oracle, no cross-chain
  read, ties resolve to `field`;
- `claim(game_id)` pays `stake × (total − fee) / outcome_pool[winner]` — pull-based, no loops, unbounded bettors;
  `fee_bps` to `treasury`; a cancelled game refunds stakes.

Cost: odds float until close instead of fixed-odds pricing; acceptable for a game. What it deletes: two contracts, the
PM Torii, the oracle, 41 client files that are already gone.

## 7. Tuning pass — the baseline to tune from

**Blitz presets** (immutable rows; tuning means registering new ids and repointing the default):

| Field                              | preset 6 `official-60` (live) | preset 7 / base `official-90` | madara preset 1 |
| ---------------------------------- | ----------------------------- | ----------------------------- | --------------- |
| duration                           | 3600 s                        | 5400 s                        | 5400 s          |
| cap / delay                        | 24 / 20 s                     | 24 / 20 s                     | 96 / 10 s       |
| stamina initial / gain per tick    | 30 / 30                       | 20 / 30                       | 20 / 30         |
| VP explore / claim / relic / hyper | 5 / 250 / 250 / 1000          | 10 / 500 / 1000 / 3000        | base            |
| starting resources (W/L/Wo/C/Cu/D) | 1000/1500/360/240/120/500     | 1000/1200/180/120/60/200      | base            |
| troops per type (stock)            | 3500                          | 1500                          | base            |
| production multiplier              | ×2 (donkey 3, essence 20)     | ×1                            | base            |
| map base distance / step / ring    | 6 / 12 / 12                   | 8 / 15 / 15                   | base            |
| entry fee                          | 0 (STRK)                      | 0 (STRK)                      | 0 (STRK)        |

Sources: `config/source/blitz/official-60.ts`, `official-90.ts`, `troop.ts`, `points.ts`, `chains.ts`,
`config/deployer/clean/madara.ts`; shared values (ticks 60/180 s, stamina max 120, deployment caps,
`points_for_win = 0`) in `config/source/common/base-config.ts` and `blitz/base.ts`.

**Economics — historical mainnet intent vs the ledger's knobs.** The old curve pays a wide, flat field: winners = ⌈N·r⌉
with r = 1 − 1.03·(N/1000)^0.13, geometric decay s = 0.3 + 0.64·(1 − N^-0.7), on 70 % of entries.

| N   | winners   | rank-1 share | last-winner share | at 100 LORDS entry: rank 1 / last winner |
| --- | --------- | ------------ | ----------------- | ---------------------------------------- |
| 24  | 9 (38 %)  | 18.1 %       | 6.0 %             | 305 / 101 LORDS                          |
| 48  | 15 (31 %) | 12.8 %       | 2.8 %             | 429 / 94 LORDS                           |
| 96  | 24 (25 %) | 9.7 %        | 1.2 %             | 655 / 82 LORDS                           |

Rank 1 earns 3–6.5× entry and the last third of winners is at or below breakeven. The ledger replaces the curve with
`payout_bps[]` per preset, so this table is the starting point, not a constraint; the phase-2 default (50/30/20 to the
top three) is the opposite extreme. Recommendation for the pass: pay the top ~20 %, steep enough that rank 1 ≈ 5× entry
and the last paid rank ≥ 1.5× entry, and keep the protocol cut at one number (`protocol_cut_bps`, 1000–3000) to one
recipient — the creator/veLORDS split is a treasury policy, not a contract rule.

**MMR knobs** (per preset after the port): μ 1500, D 450, Δmax 45, K 50, λ 0.015, min players 6; tiers in the client at
600 / 1200 / 1600 / 2000 / 2400 (`apps/game/src/ui/utils/mmr-tiers.ts`). Modifiers: sword doubles a positive delta,
shield halves a negative one, one of each per game, priced in the preset.

**Eternum** needs numbers that do not exist yet: `points_for_win`, season length (the appchain profile is a 30-day
dev-mode test, `config/source/eternum/chains.ts:7-37`), bridge `fee_bps`, daily release caps per token, and the funded
pool per season. Those are the tuning pass's second half.

## 8. What this deletes

L3: entry-token path (done), `mmr` system + models + cubit math, ERC20 prize transfers and escrow, direct collectible
minting and its `0x0` guards, season-pass and village-pass custody, `transfer_or_mint`, the three-way bridge fee split,
`lp_withdraw`, the cosmetics ownership check against the gameplay account. L2/off-chain: the factory hook in `MMRToken`,
the PM world + its Torii + oracle, the marketplace-Torii inventory read, `packages/amm-sdk` (v1, no consumers),
`services/amm/*` in the game client, the `accountName` store field. Added: `game_ledger` (pools inside it), `vault`
(separate only because it has a different key — the guardian), `apps/operator` (already decided), one name field and one
loadout page in the web app.

## 9. Owner decisions (answered 2026-08-29 unless marked open)

- **1 — bridge withdrawals: open, under discussion.** Recommendation on the table: no operator-authorized releases; the
  vault releases only against the proven L3 burn (settlement on Sepolia, started now with the orchestrator's mock
  prover), with the delay and daily cap kept as permanent circuit breakers. Eternum's first season runs on E-1 +
  deposits.
- **2 — passes burned** at registration. Done.
- **3 — the web app owns L2 actions and is the lobby**; the game client is launched per game and only plays. One web app
  (account, marketplace, lobby, ledger actions, chests, loadout, bridge, swap, betting), one desktop client, mobile
  later as a second client.
- **4 — prediction market kept, fixed odds, simple**: odds quoted from the pool at buy time and locked per bet; the
  game's pool pays winners first and the treasury backs any shortfall up to a per-game liability cap (bets over the cap
  are refused); LORDS payouts, no CTF/ERC1155, no VRF rounding. Simplified from
  `cagecalls/cairo/src/fight_factory.cairo` (its locked-odds mode) — `create / buy / settle / redeem` and the odds math,
  roughly a fifth of it.
- **5 — numbers**: one Blitz preset = `official-60` at **cap 96, no registration delay**; a battle-royale preset later
  (same sheet, one realm per player); Eternum. Entry **500 LORDS**, sword **500**, shield **500** — all tunable in the
  preset; the factory stays preset-based and presets are added, never edited.

Original questions, for the record:

1. **Capped operator bridge** (§5) relaxes the phase-2 line "no operator-run value bridge in the interim" to "bounded by
   cap × delay with a guardian". Accept, or keep withdrawals for phase 3 and ship Eternum on E-1 only.
2. **Passes are burned** at registration (KISS); lock-and-return only if passes keep post-season value (§2).
3. **The web app owns L2 actions**; the game client links out (§1). This moves chest opening, loadout, bridge, swap, and
   betting UI out of `apps/game`.
4. **Prediction market: cut unless past usage says otherwise**; if kept, a parimutuel resolved by `apply_results` (§6).
5. The numbers in §7 — presets, `payout_bps`, protocol cut, MMR parameters, modifier prices, Eternum's season values.

Once 1–4 are answered this becomes section B of the phase-2 brief (B.1 ledger, B.2 Eternum entry, B.3 collectibles, B.4
bridge, B.5 pools if kept) with a gate each, and the tuning numbers are registered as new preset ids.
