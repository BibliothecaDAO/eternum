# A1 implementation notes

- The D15 compile-time Blitz-core cut was retained. Its fallout was contained to shared discovery, structure, resource,
  and test helpers, so the escape hatch was not needed. Excluded modules remain commented and mechanically restorable;
  `LEGACY_CONFIG_ID` keeps their old singleton references distinct from active `ChainConfig` access until Phase 3.
- Presets own immutable rulebook rows. Each game stores only mutable state, an effective `GameMapConfig` row, and agent
  caps. The effective map row avoids branching between preset and override data on every map read.
- `create_game` requires a non-zero seed and caps A1 registration at 24 players so the complete hyperstructure ring is
  reserved in the creation transaction. Series are registered by the chain admin for an explicit owner; only that owner
  can append games, and numbering is contiguous.
- Standalone games receive a zero chest allocation instead of entering the series accumulator. Series chest supply, game
  count, and cap ratio are stored on the series and initialized atomically on first allocation.
- The shared entry NFT records `(game_id, token_id)` issuance before settlement and exposes `game_id` in its metadata
  attributes. Registration fees credit explicit per-game escrow. Prize and protocol payouts debit that escrow; pooled
  contract balances are never used to infer sponsorship, which remains zero until a dedicated per-game credit exists.
- The two-game storage fixture deliberately overlaps player addresses, coordinates, entity ids, token ids, clocks,
  ranks, MMR, guild state, resource allowances, settlements, agent counters/caps, chest allocation, owner counts, and
  escrow. The fix round adds a deployed-world dispatcher fixture that runs registration, creation, fee entry,
  settlement, camp resource grants, allowance pickup, prize payout, and escrow sweeping against two live games.
- The Cairo namespace constants and hard-coded selector tags move to `s2_blitz`. Existing Dojo/Torii profile files stay
  unchanged under the Cairo-only A1 boundary; A5 creates the fresh deployment manifest.
- `sozo build --profile local` succeeds. The compiler still reports the existing Starknet bytecode-size notices for
  `troop_battle_systems` and `troop_management_systems`; contract decomposition is outside this schema migration and
  must be resolved before a size-limited Starknet deployment.

## A1 fix round

- The full registration configuration is now assembled from chain-, preset-, and game-scoped rows at every fee,
  settlement, hyperstructure, and prize call site. Only the mutable game half is written back. Issued entry tokens have
  their own per-game counter, so mint capacity cannot be bypassed by delaying settlement.
- Resource allowance pickup now reads its four-key row, and camp discovery resolves the game's preset before reading the
  three-key `ResourceMinMaxList`. `view_registered_points` now requires `game_id`, and `BlitzSettlementEvent` leads with
  a `game_id` key.
- VRF nonce sources retain provider freshness. Raw provider/cache randomness is folded with `game_id` and the game seed
  after each draw, while deterministic salt sources keep their existing game-scoped behavior. The seed isolation test
  now holds the seed constant and varies only `game_id`.
- An admin can clear every row belonging to an abandoned, unfinalized ranking trial; finalized trials remain immutable.
  Lone-player claims pay exactly one entry fee. After the end grace period, an admin settlement sweeps remaining
  per-game escrow to the configured fee recipient and marks the game settled, including dev-mode games.
- Chain bootstrap requires the registrar resource's Dojo owner and requires that caller to be the configured admin. Game
  creation validates registration timing and uuid sentinel headroom, and map-center derivation folds in the assigned
  game id. Registrar game creation reuses the existing hyperstructure reservation system instead of carrying a second
  copy of that domain logic.
- Bonus chests consume the game's series allocation. Immutable series supply, game-count, and cap fields now live only
  on `Series`; the accumulator stores runtime state only. Series registration rejects any maximum allocation that cannot
  fit `GameChestReward.allocated_chests`.
- Preset registration validates the Blitz reward profile. The retired config module's `blitz_exploration_config_tests`
  coverage is folded into the registrar dispatcher tests through valid- and invalid-profile registration. The unused
  preset biome-climate field was retired because biome climate is supplied per game.
- The D15 village claim-immunity and village-association guards, the retired factory address, and the excluded test
  configuration helpers remain as commented restoration markers. `TEST_PRESET_ID` and `TEST_GAME_ID` are deliberately
  different so preset/game scope aliasing fails visibly.
- The completed fix-round suite passes all 180 tests, including 11 deployed-world dispatcher tests.

## Accepted deviations and A4 notes

- `troop_raid` remains excluded with owner approval. Blitz rejects raids at runtime, so this is an accepted extension of
  the D15 compile-time cut.
- Guild identity remains the per-game creator wallet `(game_id, ContractAddress)` rather than a synthetic uuid. The
  leading game key provides the required isolation.
- `GameStatus` omits an assigned `Settling` state and derives pre-live states from timestamps; this is accepted.
- MMR events keep `trial_id` as a trailing key. A4 clients must use each event's declared key order rather than assuming
  `game_id` is the only key.
- `ResourceList` and `ResourceMinMaxList` are preset-scoped: their key order is `(preset_id, entity_id, index)`, not
  game-scoped. This exception belongs in the A4 client key-arity table.
- `ResourceBridgeWtlConfig` and `ResourceRevBridgeWtlConfig` remain compiled singleton bridge configuration rows.
- `AntiBot` remains excluded because its only storage reader is the D15-cut `realm/season` host; no compiled system
  reads it. It must be restored with that host during the full Eternum port.
- Excluded-module files still contain pre-migration signatures. A Phase-3 restore requires a full model, key, config,
  event, and interface migration; uncommenting the modules alone is not sufficient.
