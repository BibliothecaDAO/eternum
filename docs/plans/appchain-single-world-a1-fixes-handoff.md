# A1 Fix Round — Codex Handoff

Status: **CLOSED — A1 ACCEPTED 2026-08-09.** All rounds complete: B1–B6, F1–F9, M1–M8 landed and verified (round 2,
commits `7cb8028848..74c023ff74`); the R2-B1 blocker fixed and regression-tested (round 3, commit `da970ba467`). Final
state independently verified by the reviewer: build clean, 181/181 tests, arity sweep clean. Reviewed range:
`bbcc20b3ac..e8533b28ff` on `feat/single-world-blitz`. Contract: `docs/plans/appchain-single-world-a0-audit.md`
(unchanged). Kept for the record; superseded by `docs/plans/A1-NOTES.md` as the implementation record.

## Mission

The A1 migration is structurally correct (keys, config split, escrow, NFT, series) but ships four verified runtime
breaks that the 167-green suite cannot see, one missing event key, and a storage-only acceptance suite. Fix the
blockers, apply the listed design fixes, and add dispatcher-level two-game tests so this class of bug (wrong-arity
`read_model` compiles silently) can never ship green again.

## Ground rules (unchanged from the A1 handoff)

- Branch: `feat/single-world-blitz`. NEVER commit to `feat/appchain-phase-1`.
- Cairo only: `contracts/l3/game/` and `docs/plans/A1-NOTES.md`. Do not touch `client/`, config TS, `deploy/`,
  `.github/`, `contracts/l3/factory`.
- Comment out removed code (especially asserts) — do not delete. Two past breaches are itemized below for restoration.
- Toolchain: sozo 1.8.0 / scarb 2.13.1 via asdf; build with `sozo build --profile local` from `contracts/l3/game`; tests
  via `sozo test`.

## Owner decisions signed 2026-08-09

- **VRF MUST be non-deterministic** — fix F1 below is mandatory as specified, not optional.
- **`troop_raid` exclusion is confirmed** (Blitz rejects raids at runtime; module stays cut). Record in A1-NOTES as an
  owner-approved extension of D15.
- Everything else in this doc is reviewer's judgment and is signed as the contract for this round.

## Blockers (B1–B6) — all must land

**B1 — Registration-config type mismatch panics every fee entrypoint.** `WorldConfig.blitz_registration_config` is
`BlitzRegistrationGameConfig` (4 fields, 5 packed felts), but eight live sites read the member as the full 12-field
`BlitzRegistrationConfig` via generic `WorldConfigUtilImpl::get_member` → guaranteed `'Could not deserialize'` panic at
runtime:

- `src/systems/realm/blitz/contracts.cairo:64-66` (`obtain_entry_token` — panics before the zero-fee early-return),
  `:106-108` (`settle`)
- `src/systems/realm/blitz/hyperstructure_create/contracts.cairo:44-46`
- `src/systems/prize_distribution/contracts.cairo:97-99`, `:134-136`, `:224-226`, `:362-364`

Fix: route all eight reads through the existing assembler `BlitzRegistrationConfigImpl::get`
(`src/models/config.cairo:1041-1070`, currently dead code). The `settle` write-back at
`realm/blitz/contracts.cairo:208-210` currently writes the full struct into the 5-felt member slot — replace it with a
write of only the game half: build a `BlitzRegistrationGameConfig` from the updated
`fee_amount/registration_count/registration_count_max/registration_start_at` and `set_member` that.

**B2 — `pickup` reads `ResourceAllowance` with the stale 3-key tuple.**
`src/systems/resources/contracts/resource_systems.cairo:258-260`:
`read_model((owner_structure_id, recipient_structure_id, resource_type))` against the 4-key model
`(game_id, owner_entity_id, approved_entity_id, resource_type)`. Every pickup sees a phantom row
(`'insufficient approval'` always) and the decrement write-back at `:267` writes a mis-keyed row. Fix: include `game_id`
in the read tuple.

**B3 — Camp starting resources read `ResourceMinMaxList` without `preset_id`.** `src/systems/utils/camp.cairo:33-34`:
2-key read `(resources_mm_list_id, index)` against the 3-key model `(preset_id, entity_id, index)` → camps silently
grant zero resources. Fix: resolve `preset_id = GameRegistryImpl::get(world, game_id).preset_id` and read with the full
tuple.

**B4 — `view_registered_points` was never migrated.** `src/systems/points/contracts.cairo:26` reads the 2-key
`PlayerRegisteredPoints (game_id, address)` with a bare `player` key, and `IPointSystems::view_registered_points` has no
`game_id` parameter. Fix: add `game_id: u32` to the interface and thread it into the read. (Client adapts at A4 —
interface change is expected.)

**B5 — `BlitzSettlementEvent` missing `game_id` key (audit §2.6).** `src/systems/realm/blitz/contracts.cairo:49-54` keys
are `[player]` only; emit at `:218`. Fix: add `#[key] game_id: u32` at key[0] and populate at the emit site. This is the
only compiled event missing it.

**B6 — Dispatcher-level two-game acceptance suite.** The current registrar test writes rows with `write_model_test` and
never invokes an entrypoint; `create_game`, `register_preset`, `register_series`, `obtain_entry_token`, `settle`, and
every prize entrypoint have zero tests — which is exactly how B1–B3 shipped green. Required new tests (snforge, real
dispatchers, world deployed via the normal test harness):

1. **Two-game lifecycle**: `bootstrap_chain_config` → `register_preset` → `create_game` ×2 (same preset, different
   non-zero seeds, overlapping clocks) → `obtain_entry_token` + `settle` the SAME wallet in both games → play a minimal
   action in each → finalize + claim a prize in game A → assert: game B's escrow, registration count, and state
   untouched; game A's `fees_paid_out` debited exactly; entry-token `(game_id, token_id)` rows distinct for the same
   wallet.
2. **Cross-game negatives** (each a `#[should_panic]` or assert-revert): attack/transfer with a spoofed `game_id` fails
   on the ownership/empty-model asserts; `approve` in game A then `pickup` attempted with game B's id fails; escrow
   over-debit panics on the `models/game.cairo:93` assert.
3. **Camp/allowance smoke**: after B2/B3, an in-game approve→pickup round-trip succeeds and a camp grant yields non-zero
   resources.
4. **Seed-fold isolation**: fix the vacuous assert in `registrar/tests.cairo:202` — hold the seed constant and vary ONLY
   `game_id`, asserting `to_seed` differs.
5. Make `TEST_PRESET_ID != TEST_GAME_ID` in `utils/testing/helpers.cairo` (e.g. preset 2, game 1) so the `set_member`
   game/preset scope aliasing can never silently pass again; fix any test that was leaning on the equality.

## Required fixes (F1–F9) — reviewer's judgment, owner-signed

**F1 (MANDATORY — owner decision): restore VRF per-tx freshness.** `src/system_libraries/rng_library.cairo:163-170`
(`scope_source_to_game`) rewrites `Source::Nonce(addr)` into a constant `Source::Salt(poseidon(game_id, seed, addr))` —
with a real VRF provider the same wallet draws IDENTICAL randomness for every chest/settle in a game (precomputable
loot). Fix shape:

- Preserve the source kind: a `Nonce` source stays a `Nonce` source (per-tx freshness from the provider).
- Fold game context AFTER the draw instead: at the consumption point in `rng_library`, transform the returned randomness
  with `poseidon(raw_randomness, game_id, game.seed)` before use/caching-derivation. This keeps per-tx freshness AND
  decorrelates two games touched in the same tx/multicall (including the tx-hash `RNG` cache: fold per consumption so
  the cached raw seed still diverges per game).
- Tile-determinism via `to_seed` is already game-folded — leave the Salt path's semantics unchanged.
- Unit-test: same raw randomness + two game ids → different scoped values; `scope_source_to_game` preserves the `Nonce`
  variant.

**F2 — `PlayersRankTrial` griefing.** First permissionless caller owns the game's single trial forever; a wrong
`total_player_count_committed` or abandonment bricks finalization with escrow stranded
(`prize_distribution/contracts.cairo:361`, finalize assert `:513-517`). Fix: add a chain-admin-gated
`reset_trial(game_id)` (registrar or points system) that voids an UNFINALIZED trial so a fresh one can start; finalized
trials stay immutable.

**F3 — Entry-token over-minting + lone-player escrow drain.** `is_registration_full` counts settled players, so >max
wallets can pay with no refund path; and `blitz_prize_claim_no_game` (`prize_distribution/contracts.cairo:144`) pays the
WHOLE escrow to a lone settled player, including other minters' fees. Fix: (a) track issued tokens per game (mint-time
counter) and gate `obtain_entry_token` on `issued < registration_count_max`; (b) `blitz_prize_claim_no_game` pays
exactly `fee_amount`, remainder stays in escrow for the F4 sweep.

**F4 — `mark_game_settled` unreachable + dev games never end.** Exact-equality `fees_paid_out == fees_collected`
(`registrar/contracts.cairo:193`) can never hold with rank-prize division dust/unclaimed players, and dev-mode games
never resolve `Ended` (`:438`). Fix: make `mark_game_settled` admin-gated; require status `Ended` + grace elapsed; sweep
the remaining escrow (`collected - paid_out`) to `fee_recipient` via `debit_fees` (keeping accounting exact), then mark
Settled. Let `resolve_game_status` honor `end_at` for dev-mode games too.

**F5 — `bootstrap_chain_config` front-run.** (`registrar/contracts.cairo:102-115`) First caller becomes chain admin.
Fix: assert the caller is the Dojo world owner (same pattern as the `is_owner` checks used elsewhere) before accepting
the bootstrap.

**F6 — Identical create seeds ⇒ identical maps.** `derive_map_center_offset` (`registrar:418-423`) uses only the seed,
and `create_game` doesn't require distinct seeds — two games with the same seed get identical offsets and biome fields.
Fix: fold `game_id` into the offset derivation.

**F7 — Bonus chest bypasses the series budget.** The ≥500-points bonus mint's
`game_chest_reward.distributed_chests += 1` is commented out (`prize_distribution/contracts.cairo:266`), minting outside
the D10 cap. Fix: count bonus chests against the allocation — uncomment the increment and check remaining allocation
before minting.

**F8 — Series field duplication.** `num_games/total_chests/cap_ratio_bps` live on both `Series`
(`models/game.cairo:68-70`) and `SeriesChestRewardState` (`models/series_chest_reward.cairo:99-102`). Fix: drop the
duplicated fields from `SeriesChestRewardState` and read them from the `Series` row (contained churn; pre-deployment so
schema is free).

**F9 — `create_game` window validation.** `registration_start_at` is never validated against the game clock
(`registrar:244-254`) — an empty registration window is constructible. Add an assert that registration opens before
settling starts.

## Minor fixes (M1–M8)

- **M1**: add the §7 one-time uuid-headroom assert in `create_game`: `world.dispatcher.uuid()`-current < `u32::MAX - 8`
  (cheap periodic guarantee that entity ids never reach the sentinel band).
- **M2**: comment out (with D15 markers) the two test-helper landmines `tstore_village_token_config` and
  `tstore_quest_config` (`utils/testing/helpers.cairo:204-206, 244-246`) — they panic on `PresetConfig` member lookup if
  any future test calls them.
- **M3**: inverted assert message at `prize_distribution/contracts.cairo:131` (asserts `final_trial_id` IS zero; message
  says "rankings not finalized") — fix the message.
- **M4**: `allocated_chests.try_into::<u16>().unwrap()` (`prize_distribution:111`) can panic for large admin-set
  `total_chests` — validate bounds at `register_series` instead.
- **M5**: restore the two deleted guard blocks as comments per owner preference (D15 markers stay): the village
  claim-immunity assert in `resource_systems.cairo` (arrivals claim) and the `ensure_associated_with_village` branch in
  `utils/resource.cairo`; also restore `WorldConfig.factory_address` as a commented-out member (handoff said comment, it
  was deleted).
- **M6**: remove the dead `PresetGameConfig.biome_climate_config` member (`models/config.cairo:75`) — it is never read
  (`build_world_config` takes biome from params only).
- **M7**: `AntiBot` dropped out of the world with its cut host module though the audit classed it keep-as-is — if any
  compiled system reads it, re-home it; otherwise record the exclusion + rationale in A1-NOTES.
- **M8**: the retired `config` module silently removed `blitz_exploration_config_tests` (1 compiled test) from the suite
  — fold any still-relevant assertions into the new registrar preset tests and record the retirement in A1-NOTES.

## Accepted deviations — record in A1-NOTES, no code change

- `troop_raid` module exclusion (owner-signed, see above).
- Guild identity = per-game creator wallet `(game_id, ContractAddress)` instead of D6's synthetic uuid — isolation holds
  via the key; accepted.
- `GameStatus` without `Settling`/assigned `Created` (derived from timestamps) — accepted.
- MMR events keep `trial_id` as a trailing key — accepted; client note for A4.
- `ResourceList`/`ResourceMinMaxList` key[0] is `preset_id`, NOT `game_id` — accepted; MUST be called out for the A4
  client key-arity table (C5).
- `ResourceBridgeWtlConfig`/`ResourceRevBridgeWtlConfig` stay compiled singletons — accepted; note disposition.
- Excluded-module files still carry pre-migration signatures — Phase-3 restore requires full migration, not just
  uncommenting (already true in A1-NOTES; keep).

## Definition of done

1. `sozo build --profile local` clean; full `sozo test` green including the new B6 suite.
2. All B1–B5 fixed; every F-item and M-item either landed or listed in A1-NOTES with a one-line reason if genuinely
   blocked (none are expected to be).
3. Self-check sweep before handing back: for every file you touched, verify each `read_model`/
   `ptr_from_keys`/`erase_model` key tuple against the model's `#[key]` list — wrong arity compiles silently; this round
   exists because of that.
4. Update `docs/plans/A1-NOTES.md` with: the fix-round summary, the accepted-deviation records above, and which F/M
   items changed behavior.
5. Reviewer (Claude) re-audits the diff, re-runs the arity sweep, and only then pushes/accepts.

---

## Round 2 addendum (re-audit of 7cb8028848..74c023ff74, 2026-08-09)

Round-1 verdict: B1–B6, F1–F9, M1–M8 all verified landed; arity sweep over ~106 storage-op sites found zero mismatches;
180/180 tests independently confirmed; no pre-existing test weakened. ONE blocking regression was introduced and must be
fixed before acceptance:

**R2-B1 (BLOCKER) — `blitz_prize_claim_no_game` never persists `final_trial_id`, enabling repeat-drain.**
`src/systems/prize_distribution/contracts.cairo:151-153`: line 151 sets `game.final_trial_id = SYSTEM_TRIAL_ID` on a
local copy; line 152 `debit_fees` does its own storage read-modify-write; line 153 re-reads storage into `game`,
discarding the mutation; line 168 persists `final_trial_id = 0`. Consequences: the finalized-guard at `:126` never
trips, so with over-minted escrow (N wallets mint entry tokens, 1 settles — escrow holds N×fee while the prize is 1×fee)
the lone settled player can claim repeatedly and drain the other minters' fees; winner/ranked views report unfinalized
forever; MMR commit/claim stays blocked; admin `reset_trial` passes its immutability guard and can erase the
already-PAID system trial. Fix: mirror `mark_game_settled`'s correct ordering (`registrar/contracts.cairo:222-225`) —
call `debit_fees` first, re-read the registry row, THEN set `final_trial_id` on the fresh copy before `write_model`.
Extend the dispatcher suite: after a no-game claim, assert `GameRegistry.final_trial_id == SYSTEM_TRIAL_ID` and assert a
second claim reverts on "rankings already finalized".

**R2-M1 (record only)** — add to A1-NOTES' A4 notes: `AddressName` remains globally keyed by wallet
(`models/name.cairo:3-7`; written at `realm/blitz/contracts.cairo:557`), so registering in any game overwrites the
player's display name across all games. Accepted (D7 kept names global by design); clients must treat display names as
account-level, not per-game.

Everything else from the round-1 re-audit is accepted as-is, including (recorded for the owner): the end-grace window is
a hard prize-claim deadline (post-sweep unclaimed prizes are confiscated to `fee_recipient` — configure
`end_grace_seconds` generously); standalone and single-registrant games mint no threshold loot chest (zero allocation
per D10 — coherent with "standalone games get zero chest allocation"); `create_game` now rejects games whose season
window is already past (improvement via the reservation-system reuse); dev-mode games can reach Ended/Settled while
season gates stay open (admin-only blast radius).
