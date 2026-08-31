# A1 handoff — single-world Blitz Cairo migration

Handoff to an autonomous coding agent. Everything needed is in this repo; no outside context required.

## Mission

Migrate the Blitz game contracts from one-Dojo-world-per-game to **one persistent world hosting many concurrent games**,
keyed by `game_id`. The factory world is replaced by an in-world **registrar**. This is milestone **A1** of
[appchain-single-world.md](./appchain-single-world.md).

**The schema contract is [appchain-single-world-a0-audit.md](./appchain-single-world-a0-audit.md)** — read it fully
before writing code. All 16 decisions in its §8 are signed off (2026-08-08); do not relitigate them. The
[appchain-single-world-a0/](./appchain-single-world-a0/) directory holds per-file evidence with `file:line` references
for every model and system — consult it whenever this doc or the audit summary is not specific enough.

Acceptance (A1 exit): **two concurrent games run in snforge tests with zero cross-reads/writes**, exercised
adversarially (audit §6 scenario list). Build clean, tests green.

## Ground rules

- **Branch: `feat/single-world-blitz`** (already created, based on `feat/appchain-phase-1`). Never commit to
  `feat/appchain-phase-1` — it drives the live launch pipeline.
- **Comment out, don't delete.** When removing code (asserts, modules, models), comment it out with a one-line reason
  referencing D-numbers from the audit. This is a hard owner preference.
- Cairo only. Do **not** touch `client/`, `config/` (TypeScript), `deploy/`, `.github/` — those are milestones A2–A4.
  `contracts/l3/factory` is retired by this work but leave it untouched (it serves the legacy pipeline until A5).
- Commit in logical increments with `feat(single-world): …` / `refactor(single-world): …` messages, each ending with the
  co-author trailer already used on this branch (see `git log`).
- Keep the excluded-systems cuts restorable (they return in the Phase-3 Eternum port).

## Toolchain (verified working)

- Work from `contracts/l3/game/`. Versions via asdf (`contracts/l3/game/.tool-versions`): **sozo 1.8.0, scarb 2.13.1,
  starknet-foundry 0.51.2**.
- Build: `sozo build --profile local` — baseline (pre-migration) compiles clean in ~40 s.
- Tests: `sozo test` (snforge under the hood) — existing suites live in `src/systems/*/tests*` and `src/utils/testing/`.

## Current working-tree state

Committed on this branch:

1. The A0 audit docs (already merged into the branch's base).
2. **A1.2 module cuts — NOT yet build-verified.** `src/systems.cairo` and `src/systems/resources/contracts.cairo`
   comment out the non-Blitz-core systems (D15): village, realm::season, trade, bank (all three sub-contracts), season
   (season_close), faith (+prize), bitcoin_mine (+discovery), spire, resource_bridge_systems. Quest was already
   commented out upstream. **Your first task: run the build and fix the fallout** — expected breakage:
   - `src/utils/testing/helpers.cairo` registers/spawns the cut contracts and their models in test worlds;
   - cross-module imports of cut interfaces (e.g. `resource_systems`'s liquidity-bridge hook, dns lookups of
     `village_systems` in resource transfer paths, `utils/bridge.cairo`, `utils/village.cairo`,
     `utils/bitcoin_mine.cairo`, `utils/holysite.cairo`, `utils/mine.cairo`);
   - the discovery fan-out in `combat/contracts/troop_movement.cairo` contains `mine_discovery_systems`,
     `holysite_discovery_systems` (season-only) — cut those two contract modules as well (they are inside
     troop_movement.cairo, not separate files) and their dns dispatches in `troop_movement_util_systems.find_treasure`;
     keep camp/agent/hyperstructure/relic-chest discovery (Blitz-live).
   - When a kept file references a cut util only in a season-only branch, comment the branch with a D15 marker.

## Execution order

### 1. Finish the cut (A1.2) — WITH AN ESCAPE HATCH (owner-approved 2026-08-08)

Get `sozo build --profile local` green with the Blitz-core-only module tree. Commit.

**Escape hatch:** the cut is a means (smaller migration surface), not an end. **If getting the cut to build costs more
than simply migrating the excluded systems, revert the cut commits and migrate everything instead.** Decision rule:
timebox the cut fallout to roughly half a day of effort; if it is still red or keeps cascading (test helpers,
`troop_movement.cairo`'s embedded discovery modules, shared utils), take the inclusive path. On the inclusive path the
season-only models re-key exactly per the audit §2 tables (the rows marked `season` — they are already classified),
season-only systems get the same `game_id` threading and guard rule, and **contract exclusion moves to the deploy
manifest at A5** (which contracts the world registers is a deployment decision, not a compile-time one). Either way,
record which path you took and why in `A1-NOTES.md`.

### 2. Registry + config split (A1.3)

New file `src/models/game.cairo` (+ registrar system `src/systems/registrar/contracts.cairo`):

- `GameRegistry` — key `game_id: u32`; fields: `name: felt252`, `series_id`, `game_number_in_series`, `preset_id`,
  `creator`, `status` enum (Created/Registration/Live/Ended/Settled), the six lifecycle fields absorbed from
  `SeasonConfig` (`dev_mode_on`, `start_settling_at`, `start_main_at`, `end_at`, `end_grace_seconds`,
  `registration_grace_seconds`), `final_trial_id` (absorbs `PlayersRankFinal` — D5), `seed: felt252` (per-game
  randomness → map center offset + VRF salt folding, D1), and escrow accounting `fees_collected` / `fees_paid_out` (D11
  — **no payout may ever be computed from `balance_of(this)`**).
- `GameCounter` singleton for `game_id` assignment starting at 1 (reserve 0 and `u32::MAX` — audit §7).
- Config split (audit §3): `WorldConfig` re-keys to `game_id` and keeps only per-game members (mutable cursors, clock,
  blitz registration per-game half, `map_center_offset`, biome seeds, mode flags); static rulebook members and
  side-tables (`WeightConfig`, `ResourceFactoryConfig`, `BuildingCategoryConfig`, `StructureLevelConfig`,
  `HyperstrtConstructConfig`, speed/battle/capacity/troop/etc. members) move to **preset-keyed** rows (`preset_id: u32`
  key[0] — D2), written once by an admin `register_preset` flow on the registrar; chain-global members
  (`vrf_provider_address`, `agent_controller_config`, `mmr_config`, fee/collectibles addresses) move to a `ChainConfig`
  singleton. Kill the three setter ordering dependencies (audit §3 last paragraph) by writing preset + per-game rows
  atomically.
- Keep `WorldConfigUtilImpl::get_member/set_member` (models/config.cairo:232-241) as the choke point but add a `game_id`
  parameter; same for `SeasonConfigImpl::get` (→ reads `GameRegistry`), `WorldRecordImpl`, `TickImpl`. The compiler then
  finds every caller.

### 3. Re-key the core models (A1.4)

Follow audit §2.1/§2.2 tables exactly — `game_id: u32` at key[0], existing key order preserved after it (client
constraint C1: `entity_id` stays key[1] on entity-keyed models). Highlights and traps:

- `TileOpt` → `(game_id, alt, col, row)`; `Building` → `(game_id, alt, outer_col, outer_row, inner_col, inner_row)` (D3
  adds the missing `alt`); `StructureReservation` → `(game_id, coord)`.
- Singleton renames: `world_id`/`config_id` fields become `game_id` (`HyperstructureGlobals`, `WonderFaithWinners`*,
  `WorldRecord`, `SeasonPrize`, `GameChestReward`, `AgentCount/LifetimeCount/LordsMinted`, `AgentConfig`). (*faith
  models are cut; re-key only what still compiles.)
- Rank family: `trial_id` keys become `game_id` (D5); `PlayersRankFinal` is absorbed into `GameRegistry` and its model
  commented out; `MMRGameMeta`/`MMRClaimed` re-key `game_id` (their `world_id: u128` field name lies — see models-3
  appendix).
- Blitz models: `BlitzSettlementPosition` → `(game_id, settlement_number)`, `BlitzSettlement` → `(game_id, player)`,
  `BlitzEntryTokenRegister` → `(game_id, token_id)`, `BlitzCosmeticAttrsRegister` → `(game_id, player)` (D8).
- `PlayerRegisteredPoints` → `(game_id, address)`; `StructureOwnerStats` splits (D7): `(game_id, owner)` keeps
  `structures_num`, the `name` field is dropped (comment out) — display names stay in global `AddressName`.
- Guilds (D6): `Guild` re-keys to `(game_id, guild_id: ID)` with `guild_id` from `uuid()`; `GuildMember` →
  `(game_id, member)`; `GuildWhitelist` → `(game_id, guild_id, address)`.
- `AddressName` split (audit models-3 appendix): player names stay global; entity names (banks are cut, agent explorers
  remain — `systems/utils/troop.cairo:709`) move to a new `EntityName(game_id, entity_id)`; the `address == 0`
  mercenaries-name row moves into the preset.
- **Do NOT re-key** (§2.4): `RNG` (tx-hash keyed — documented exception), `AntiBot`, `BiomeDiscovered`, `AddressName`
  (player half), achievement/trophy events.
- Retire (comment out + drop from any test registration): `Quantity`, `QuantityTracker`, `WonderProductionBonusConfig`,
  `WorldConfig.factory_address` + `set_factory_address` + its reader in prize_distribution.
- `StoryEvent` and every kept event model: `game_id` becomes key[0] (audit §2.6).
- Mechanical traps: 23+ bare-scalar `Model::<X>::ptr_from_keys(id)` sites become tuples
  (`grep -rn "ptr_from_keys" src`); `Default::default()` + manual key-field init sites (e.g. resource.cairo:316,479)
  must set `game_id`; `world.erase_model` sites must operate on the re-keyed struct.
- `game_id` sourcing rule per entrypoint is pre-classified in the systems appendices (DERIVABLE / MUST_PASS / AMBIENT):
  derive from the subject entity where possible; add an explicit `game_id` param to creation/registration/coord-only
  fns; `ITroopMovementUtilSystems::find_treasure` (Tile passed **by value**) gains a `game_id` parameter — prerequisite
  for the whole discovery fan-out.
- **Same-game guard rule (D4):** every entrypoint touching ≥2 entities asserts equal `game_id`. Add a shared helper
  (e.g. `assert_same_game(a, b)`). The audit §6 lists the known missing sites, including three deliberately-disabled
  ownership asserts (troop_battle.cairo:677, troop_management.cairo:622, resource_systems.cairo:361) — re-enable or
  replace them with game-scoped equivalents, with a comment.
- **Seeds (D1):** fold the game's `seed` into `TileImpl::to_seed` (models/map.cairo:65-76) and every
  `Source::Salt`/coord-derived VRF salt so two games never roll identical outcomes.

### 4. Registrar `create_game` (A1.5a)

Absorb what the factory + launch pipeline do today (see
[factory-and-presets.md](./appchain-single-world-a0/factory-and-presets.md) §1.2/§2.4 and
[systems-3](./appchain-single-world-a0/systems-3-realm-lifecycle.md) `settle` breakdown):

1. `create_game(name, preset_id, series_ref, start_main_at, duration, dev_mode, mode flags, registration overrides, biome/map overrides, seed)`
   → assigns `game_id`, writes `GameRegistry` + the per-game `WorldConfig` row from the preset + overrides, derives
   `map_center_offset` from `seed`.
2. Hyperstructure ring reservation (today: `reserve_hyperstructures(19)` batches; formula `1 + 3r(r+1)` from
   `registration_count_max`, or 3 in two-player mode) becomes registrar-internal keyed writes. If one tx can't hold the
   whole ring at max size, split into `create_game` + `finalize_game_setup` — target ≤2 txs total.
3. Registration/entry token (D13 as amended): **one shared entry-token ERC721 collection deployed once** (not per game);
   the registrar mints on registration and `BlitzEntryTokenRegister(game_id, token_id)` is the source of truth. Remove
   the per-game UDC deploy from `set_blitz_registration_config`.
4. Entry fees credit `GameRegistry.fees_collected`; every prize/fee payout in `prize_distribution_systems` asserts
   against and debits per-game escrow (D11).
5. Series (D10): `series_id`-keyed rows on the registrar (owner, game_count, chest-economy constants as data);
   `SeriesChestRewardState` re-keys `series_id`, `GameChestReward` re-keys `game_id`; the factory cross-world dispatcher
   chain in `prize_distribution/contracts.cairo:69-140` becomes a same-world registry read with a concurrency guard on
   `game_index`.
6. End-of-game: Blitz ends by `end_at` timestamp (no season_close); `status` transitions on the registry row.

### 5. Adversarial two-game suite (A1.5b)

New snforge module (e.g. `src/systems/registrar/tests/two_games.cairo`). Implement the audit §6 list — two concurrent
games A/B, same preset, overlapping clocks; assert zero cross-effects for: double-settle by one wallet, tile
explore/extract at the same coords, cross-game battle/raid/transfer/approve attempts, mixed-game id spans into
`claim_share_points`, per-game rank finalize + escrowed payouts + series `game_index` under same-block game ends,
per-game MMR trial selection, independent clocks/phase gates, independent agent caps and discovery counters + different
VRF outcomes at the same coord, ending A leaves B live, `create_game` while A is live, per-game guilds and
`structures_num`. Reuse `src/utils/testing/helpers.cairo` patterns (it needs updating for the registrar bootstrap
anyway).

### 6. Namespace rename — LAST commit

`DEFAULT_NS()`/`DEFAULT_NS_STR()` in `src/constants.cairo` → `"s2_blitz"`, plus the `selector_from_tag!`/dns literals
the compiler/greps surface. Doing this last keeps every earlier diff reviewable.

## Facts that save you time

- `ID = u32` (`src/alias.cairo`); entity ids come from `world.dispatcher.uuid()` (world-global counter, 103 sites) —
  they stay as-is; only **keys** change (audit §7).
- Reserved id band at the top of u32: `WORLD_CONFIG_ID = MAX`, banks `MAX-1..-6` (retire with banks),
  `DAYDREAMS_AGENT_ID = MAX-7` (sentinel owner — keep). Add a uuid-headroom assert.
- `troop_management.cairo` live code ends at line 932 (the rest is a commented test module); `troop_movement.cairo`
  holds 8 contract modules (movement, movement_util, 6 discovery).
- Internal-caller bypasses via `world.dns(...)` (`guard_add`, `realm_internal_systems`, discovery asserts) must NOT
  bypass the new game guards.
- `set_world_config` is permissionless until `admin_address` is set (first-caller-wins) — the registrar bootstrap must
  close this.
- The `settle` flow breakdown (9 numbered steps, spawn-coordinate cursor math, swap-with-last pool claim) is in
  systems-3; the per-game vs preset-static config split is fully enumerated in factory-and-presets §2.3.
- Client constraints C1–C7 (audit §9) are hard requirements on key order/arity — deviations silently break entity
  hydration in the client later.

## Definition of done

1. `sozo build --profile local` clean.
2. `sozo test` green, including the new two-game adversarial suite.
3. Every model in the crate compiles under exactly one of: re-keyed per-game, preset-keyed, chain-global, commented-out
   (with D-number). No stragglers keyed by `WORLD_CONFIG_ID` except `ChainConfig`.
4. `grep -rn "WORLD_CONFIG_ID" src` returns only the chain-global singleton + reserved-band constants.
5. Factory world (`contracts/l3/factory`) untouched; branch `feat/appchain-phase-1` untouched.
6. A short `A1-NOTES.md` in `docs/plans/` recording anything you had to decide that the audit didn't cover.
