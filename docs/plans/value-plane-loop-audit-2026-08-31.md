# Value-plane loop audit — 2026-08-31

Full read-only audit of the register→settle→results→payout loop after the L2/L3 tree split (slice T, commits
`1db3ea8b616`, `adeb5419e5f`, `4b9b3e01ce7`). Four parallel passes: L2 ledger money paths, L3 relay surface, the stage-1
operator, and the chain-separation seams. Every finding below was re-verified against the source by the reviewer, not
taken from the pass alone. Corrections to the passes are noted inline.

**Headline:** one blocker (L3 ranking is permissionless and roster-substitutable → a locked prize pool), reachable by
any user with a bound account for one transaction. The money math, state machine, event decode, and crash-window replay
are otherwise sound. Fix the blocker and the two access-control should-fixes before any real LORDS reaches the ledger;
the rest can land alongside.

## Blocker

**B1 — a permissionless ranker can finalize a game with a substituted roster, permanently locking the pool.**
`contracts/l3/game/src/systems/prize_distribution/contracts.cairo:112` (`blitz_prize_player_rank`) has no caller gate —
the first caller owns the trial. `rank_players` (`:198`) reads `PlayerRegisteredPoints` for any address the caller
lists, checking only "not already ranked", never that the address settled or holds a `LedgerRegistration`.
`resolve_result_owner` (`:321`) resolves through `owner_for_account` (bound account), never `for_account` (game-scoped
registration). So an attacker submits the honest points-sorted roster with one 0-point participant swapped for their own
bound-but-unregistered account: the count assert, points-sum assert, and completeness assert all pass,
`game.final_trial_id` locks (`reset_trial` refuses a finalized trial forever), and L2 `apply_results` then reverts on
`"Ledger: unregistered result owner"` every retry. Combined with F1 (ledger has no exit after start), the pool is stuck
until an admin cancel/refund path exists. **Fix the class:** `rank_players` must assert each listed player is a settled
participant of this game (e.g. `BlitzSettlement.structure_ids.len() > 0`), which closes every roster-substitution
variant at once.

## Should-fix — access control (before mainnet LORDS)

**A1 — `create_game` is permissionless and takes `dev_mode_on` from the caller.**
`systems/registrar/contracts.cairo:176` — no admin gate (only series games check the series owner). Anyone can (a)
create a dev-mode game against a production preset, in which `settle` skips the `LedgerRegistration` gate
(`realm/blitz/contracts.cairo:92`) and results emit raw addresses; and (b) squat the next sequential `GameCounter` id
(`assign_game_id`, `:339`) that the operator's `open_game` expects, desyncing the L2↔L3 game-id map and diverting
relayed registrations into an attacker-scheduled game. Move game creation and `dev_mode_on` to the admin/registrar
plane.

**A2 — the L3 ranking entrypoint amplification is the operator poison-halt (see O4).** B1/A1 both produce a message that
reverts on L2 forever; the operator has no per-game isolation, so one poisoned game halts all later payouts. Listed once
under O4.

## Should-fix — L2 ledger exits (`contracts/l2/ledger/src/contract.cairo`)

**F1 — no fund-release path once a game starts.** `cancel_game` requires `now < start` (`:520`) and `refund` requires
`cancelled` (`:391`), so after `start` the only way LORDS leave is a successful `apply_results`; `end` gates nothing. A
dead or disputed L3 mid-game locks the pool or forces the operator to fabricate a ranking. Needs an operator-declared,
`end`-gated abort→refund state.

**F2 — `refund` is not behind the pausable guard.** Guards sit on register/fund/open/apply_results (`:305,368,407,529`);
`refund` (`:389`) has none, so LORDS can exit a paused contract mid-incident. If refund-while-paused is intentional,
state it; today it reads as an omission.

**F3 — a cancelled game eats a burned pass.** `register_with_pass`/`register_village` (`:336`,`:352`) burn the NFT
immediately with `paid = 0`, so on cancellation LORDS payers are refunded and pass players lose the asset for a game
that never ran. Needs a re-mint or credit on cancel.

## Should-fix — operator (`apps/operator/src`)

**O1 — no confirmation depth; a mainnet reorg drops a `Registered` event.** `relay.ts:95` reads the raw head and `:105`
advances the cursor past it. A shallow reorg re-includes the tx in a later block never re-read → player paid on L2,
never provisioned on L3. Highest-value operator fix; one line (`toBlock = min(head - CONFIRMATION_DEPTH, …)`). Harmless
on single-sequencer Madara, real on mainnet L2.

**O2 — silent degradation on a pre-v0.10 RPC.** `types.ts:4` requires `transaction_index`/`event_index` (RPC spec ≥
v0.10); on an older `S2_RPC_URL` the sort comparator goes `NaN` and the dedup key collapses, dropping every result row
after the first in a tx and stalling on `Result rows have no ready marker` with nothing naming the cause. Add one loud
shape/version assert at ingestion.

**O3 — no advisory lock; two instances double-submit.** `cursor-store.ts:34` backwards-guard lets two instances both
read the cursor and submit; safe on-chain (idempotent + finalized guard) but noisy, and single-instance is unstated in
the README. Add a `pg_advisory_lock` per stream or state the single-instance requirement.

**O4 — poison-halt with no distinct alert.** `relay.ts:112` retries the same range forever; one permanently reverting
`apply_results` (from B1/A1, or an L2/L3 roster mismatch) halts every later game's payout, indistinguishable in the logs
from an RPC blip. Halting is right for money; add a distinct alert and consider per-game isolation.

## Should-fix — chain seams

**S1 — the shared L2 asset-script provider is unguarded.** `contracts/scripts-runtime/js/starknet.js:69` (`getProvider`)
builds from `STARKNET_RPC` with no `assertProviderChain`, and takes network identity from `STARKNET_NETWORK`
independently — so `STARKNET_NETWORK=sepolia` + a mainnet `STARKNET_RPC` submits to mainnet while writing addresses to
`sepolia.json`. **Correction to the pass:** `live-assets.js` itself IS guarded (`:31 assertLedgerRpc()`, added in slice
T); the gap is every _other_ asset script (deploy, role grants) that routes through `getProvider` without its own guard.
Assert at the chokepoint (`getProvider`/`getAccount` against the selected network).

**S2 — L3 still expects pass/realms/lords token contracts deployed locally.** `systems/village/contracts.cairo:63`
(`transfer_from` on the village pass), `structure_creation_library.cairo` (`IVillagePassDispatcher.mint`),
`systems/config/contracts.cairo:409` (`SeasonAddressesConfig`) — an eternum-format game on Madara reverts on village
creation (dispatcher call vs address zero) unless mock pass tokens are deployed on L3, rather than taking the
entitlement from the `register_from_l2` payload the operator already writes. Blitz disables these loudly; Eternum is the
exposed format.

**S3 — `velords_claim` strands LORDS on L3.** `systems/resources/contracts/resource_bridge_systems.cairo:346` transfers
the game's LORDS balance to a `velords_fee_recipient` — veLORDS is a mainnet-only sink, so on L3 this sends value to an
ordinary address with no bridge lane. Appchain-era carry-over; fold into the L2 settlement path or cut.

**S4 — Madara-lab writers are unguarded.** `deploy/madara-lab/scripts/deploy-gameplay-contracts.ts:14,152` and
`probe-resource-bounds.ts:88` declare/deploy/execute with no chain-guard while the harness one directory over guards
everything; an `RPC_URL` typo acts on whatever node answers.

**S5 — retired appchain scripts remain runnable.** `deploy/appchain/scripts/factory-config.ts`, `blitz-flow.ts`,
`factory-create-game.ts` are marked "Retired by A2 — kept for reference" yet execute against a hardcoded AWS IP default;
per wired-or-deleted, delete them (guard `d16-verify.ts`, which is live drill tooling).

**S6 — sparse address map defeats the loud-miss rule.** `contracts/common/addresses/madara.json` holds only `{strk}` but
`contracts/utils/utils.ts:66` casts it to the full `SeasonAddresses`, and `config/source/common/environment.ts:33`
re-casts with `?? {}`. Current consumers guard, but a new one reading `.lords` on madara gets `undefined` into calldata
with no error. Validate per-chain required keys in the loader.

## Minor

- **M1 (ledger)** results can be applied the instant `start` passes; `end` gates nothing (`:465`).
- **M2 (ledger)** `reserve`/`pm_enabled`/`loot_chest`/`elite_invite`/`cosmetics` stored and exposed but never written or
  read — dead surface on a money contract (wired-or-deleted).
- **M3 (ledger)** u16 rank arithmetic panics at a full 65,535-player roster (`:626`, `mmr.cairo:37`); unreachable at
  scale, but combined with F1 it would lock the pool.
- **M4 (ledger)** no admin rescue for tokens mis-sent outside register/fund.
- **M5 (operator)** `abortableDelay` (`relay.ts:129`) leaks an abort listener per poll iteration.
- **M6 (operator)** `parseLedgerRegistration` (`events.ts:16`) accepts extra keys (`keys.length < 3`); make it `!== 3`
  for symmetry with the exact `data.length !== 5` check, so an added `#[key]` fails loud.
- **M7 (L3)** `LedgerRegistration.realm_id`/`metadata` are stored but discarded by `for_account` — the settle path
  should consume the realm metadata or the operator should stop relaying it.
- **M8 (L3)** MMR leftovers outside game src: `factory_mmr.cairo`, `mmr_models.cairo`, `factory.cairo:416`, and the
  `s1_eternum-mmr_systems` writer grants in `dojo_{dev,local,sepolia}.toml:57` (madara profile is clean).
- **M9 (L3)** dead L2→L3 piltover messaging: ledger `emit_registration` sends `send_message_to_appchain` to
  `register_from_l2`, but that entrypoint is operator-gated and can't consume a message; two paths for one fact, one
  unconsumable — delete the messaging config or make the entrypoint a real handler.
- **M10 (seam)** `config/deployer/clean/shared/addresses.ts:5` second candidate path never existed post-split.
- **M11 (seam)** `lords`/`collectibles_claim` ext deploy scripts write addresses outside `contracts/common`
  (pre-existing off-by-one carried through the move); nothing reads those paths.
- **M12 (seam)** dead constant `UNIVERSAL_DEPLOYER_ADDRESS` (`l3/game/src/constants.cairo:5`).
- **M13 (seam)** client factory deployer wallets hardcoded (`factory-v2/deployer-wallet.ts:17`) — second address source
  of truth, though typed so misses are visible.

## Verified clean

Money conservation and the payout curve (every floor remainder rolls into `treasury_amount`; `finalized/pool=0` written
before any external call; no over-payment, no double-release; overflow-safe at 48k-LORDS scale). The ledger state
machine (cancel/finalize mutually exclusive in time and order; no double-finalize; refund zeroes before transfer).
Reentrancy ordering across every flow. Event decode field-for-field including u256 lo/hi order and felt/u64/u128 widths.
Operator crash-window replay end-to-end on both loops (idempotent L3 registration, finalized-flag guard on L2, no error
path advances the cursor), continuation-token pagination, and the leftover-group throw (cannot false-positive —
rows+ready share one tx/block). `register_from_l2` operator-gating/idempotency/conflict-assertion. `settle` owner
resolution and the write-once PlayerRegistry binding (no front-run, no rotate-to-hijack). Entry-token path fully
deleted; no ERC20 transfer or mmr system left in `prize_distribution`. Scarb workspace isolation after the move (no
cross-package relative path deps). Stale-path fallout from the split (CI, aliases, ext-script CWD chains all updated —
the one miss, `utils.ts`, was fixed in `880fa3d04a8`).
