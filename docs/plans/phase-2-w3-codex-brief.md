# W3 Codex Brief — Eternum Systems `game_id` Migration (Full Parity)

Context: `docs/plans/phase-2-dual-world-architecture.md` §4.3, decision D4 ("everything carries forward"). Follows W2
(`89c06b471d`): namespace `s2`, one build → two worlds (`appchain-blitz` / `appchain-eternum` profiles). Branch
`feat/single-world-blitz`. KISS: this is the A1 recipe applied to everything A1 left behind — same conventions, no
redesign.

## Outcome

The full eternum feature set compiles into the SAME `s2` build both worlds deploy: every eternum system entrypoint takes
`game_id` first, every per-game eternum model keys by `game_id` at key[0], and an eternum season can be registered and
played on the eternum world (dev/free entry — the W6 gateway handles real passes later).

## Scope — the s1⊖s2 manifest diff (verify against `docs/plans/appchain-single-world-a0/`)

**Contracts (18):** `bank_systems`, `bitcoin_mine_discovery_systems`, `bitcoin_mine_systems`, `dev_resource_systems`,
`faith_prize_systems`, `faith_systems`, `holysite_discovery_systems`, `liquidity_systems`, `mine_discovery_systems`,
`realm_systems` (season create), `resource_bridge_systems`, `season_systems`, `spire_systems`, `swap_systems`,
`trade_systems`, `troop_raid_systems`, `village_systems` — and `config_systems` stays RETIRED (see "Config surface"
below). `dev_resource_systems` migrates (dev playtests need it) but deploys only where dev mode allows.

**Models (26):** `AntiBot`, `BitcoinMinePhaseLabor`, `BitcoinPhaseLabor`, `FaithfulStructure`, `Liquidity`, `Market`,
`PlayerFaithPoints`, `PlayerFaithPrizeClaimed`, `PlayersRankFinal`, `Quantity`, `QuantityTracker`, `Quest`,
`QuestFeatureFlag`, `QuestGameRegistry`, `QuestLevels`, `QuestRegistrations`, `QuestTile`, `StructureVillageSlots`,
`Trade`, `TradeCount`, `VillageRaidImmunity`, `VillageTroop`, `WonderFaith`, `WonderFaithBlacklist`, `WonderFaithPrize`,
`WonderFaithWinners`.

**Events (8):** `AcceptOrder`, `CancelOrder`, `CreateOrder`, `ExplorerNewRaidEvent`, `ExplorerRaidEvent`,
`LiquidityEvent`, `SeasonEnded`, `SwapEvent`.

## The recipe (A1 conventions, unchanged)

1. **Entrypoints:** `game_id: u32` as the FIRST parameter of every external function; systems open world storage as
   today and read season/config state via `SeasonConfigImpl::get(world, game_id)` /
   `WorldConfigUtilImpl::get_member(world, game_id, …)`.
2. **Models/events:** add `#[key] game_id: u32` as key[0] to everything per-game. Classify per the A0 model docs — the
   per-game default holds unless the row is genuinely chain-level (candidates to judge explicitly and record:
   `QuestGameRegistry`, `QuestFeatureFlag`, `AntiBot`, `QuantityTracker`). Record every classification call in the
   delivery notes.
3. **Season close:** `season_systems.season_close(game_id)` flips `GameRegistry.status = Ended` and records the winner;
   `SeasonEnded` becomes a `game_id`-keyed event (winner announcement) — a finished season must not end any other game.
4. **Config surface (the subtle part):** eternum-mode per-game config (settlement spacing, village config, season
   addresses, bank/AMM params, quest config, faith config, …) must be reachable through the REGISTRAR preset path —
   extend `PresetConfig`/`PresetGameConfig`/side tables and `config/deployer/clean/registrar/preset.ts` so an eternum
   preset registration carries them. `config_systems` stays retired; presets are the only config write path on s2.
5. **Eternum preset:** add eternum preset registration support (`register-preset.ts --preset-id <n>` against the eternum
   config source); propose preset id 10 for the standard eternum season (blitz keeps 2/3; low ids reserved for blitz
   variants) — flag if you see a better convention.
6. **Manifests/bindings:** regenerate BOTH profile manifests (same code, both worlds) and the superset
   `contract-components.ts` (prettier before diffing). The manifest-derived tests (torii scope lint, client game-scope
   classification) pick the new models up automatically — if one fails, the classification is wrong, not the test.

## Explicitly NOT yours

- `client/**` re-enablement of eternum flows (W5, Claude) and `deploy/appchain/cdk/**` (W4, Claude).
- Deploying anything — Claude migrates the eternum world after review (W4).

## Constraints

- When removing a Cairo assert, comment it out rather than delete.
- Never use the paymaster account in tooling; pipeline account only.
- No drive-by refactors; if a system is genuinely dead product-wise, ASK (via delivery notes) rather than dropping it —
  D4 says everything carries.

## Verification

- `scarb fmt` + `scarb build`; both profile builds green.
- Cairo tests for migrated systems where they exist; `config/` + `packages/types` suites green.
- Gate: no external function in `contracts/l3/game/src/systems/**` (deployed set) whose first parameter is per-game
  state without `game_id` leading — list any deliberate exceptions.

## Handoff back

Commit range, classification decisions for the four judgment models, preset-id proposal, and the regenerated manifest
diff summary. Claude reviews, then W4 deploys the eternum world beside blitz.
