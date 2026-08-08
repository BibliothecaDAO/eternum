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
- The two-game fixture deliberately overlaps player addresses, coordinates, entity ids, token ids, clocks, ranks, MMR,
  guild state, resource allowances, settlements, agent counters/caps, chest allocation, owner counts, and escrow. The
  full suite passes with 167 tests.
- The Cairo namespace constants and hard-coded selector tags move to `s2_blitz`. Existing Dojo/Torii profile files stay
  unchanged under the Cairo-only A1 boundary; A5 creates the fresh deployment manifest.
- `sozo build --profile local` succeeds. The compiler still reports the existing Starknet bytecode-size notices for
  `troop_battle_systems` and `troop_management_systems`; contract decomposition is outside this schema migration and
  must be resolved before a size-limited Starknet deployment.
