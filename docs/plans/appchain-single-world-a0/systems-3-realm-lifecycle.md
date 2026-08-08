# A0 systems slice 3 — quest, realm(blitz/season/utils), relic, resources, season, spire, structure, trade, village

## quest_systems (quest/contracts.cairo:56)

- dojo_init writes QuestFeatureFlag{VERSION} constant singleton; enable/disable_quests (:323,:339) flip it world-wide;
  add/remove_game (:85,:124) rewrite QuestGameRegistry(VERSION) (remove loops rebuilding span). World-owner gated via
  is_owner(selector_from_tag).
- create_quest (:168): caller-restricted to troop_movement_util via dns; coord-only Tile by value → needs (game_id,
  coord); uuid QuestTile id (:453); occupies shared tile.
- start_quest (:185): BODY FULLY COMMENTED OUT, returns 1 — dead entrypoint.
- claim_reward (:272): key (game_token_id, game_address) world-global — collides if two games share budokan contract;
  external IBudokanGame.score; NO season gate in this file's entrypoints.

## blitz_realm_systems (realm/blitz/contracts.cairo:17)

- obtain_entry_token (:62): MUST_PASS; gates on BlitzRegistrationConfig singleton (registration_start_at, count/max) +
  season start_main_at; reads BlitzSettlement(caller) player-keyed → settled in game A = "already settled" in game B.
- settle (:95): MUST_PASS, archetypal. Order of ops:
  1. gates (:119-134): name, registration window, not full, BlitzSettlement(caller) empty
  2. hyperstructure reservation guard (:140-142→249-269): singleton blitz_hypers_settlement_config cursor must be
     exhausted — world-level precondition
  3. entry token (:148-150→307-341): mint/assert/lock (hardcoded lock id 69, config.cairo:978); BlitzEntryTokenRegister
     keyed token_id only — per-game collections restart at 1
  4. registration_count += 1 on singleton (:156)
  5. cosmetics (:158-165→350-383): on registration_count==1 → create_lock(timelock, season_end_at) once-per-game side
     effect; BlitzCosmeticAttrsRegister{player}
  6. fill settlement pool (:171-181→392-440): target_open_settlement_count tiers (6/9/remaining); open_next_settlement →
     blitz_settlement_config.generate_coords(map_center, reward_profile_id) + BlitzSettlementPosition{settlement_number}
     write + singleton cursor advance
  7. claim settlement (:187-192→442-463): VRF Source::Nonce(caller); random slot 1..open_count; swap-with-last; count -=
     1
  8. create realms (:193-195→472-514): realm_count_config.count++ per realm (realm_id = count); create_internal per
     coord (1 in single_realm_mode else 3 a/b/c); uuid StoryEvent; achievement
  9. persist: BlitzSettlement{player, structure_ids}, singletons, AddressName{address}, StructureOwnerStats{owner}
- Spawn coords: map_center = CoordImpl::center (CENTER-offset singleton); generate_coords deterministic
  (side,step,point) cursor + BlitzMapDistanceProfile(reward_profile_id: official_60/90, config.cairo:534-560); hex-ring
  triangle [a,b,c] via neighbor_after_distance. **Two games same preset = identical coordinate sequence.** Secondary:
  BlitzSettlementPosition keyed settlement_number:u16 alone — pools share rows, claim/swap corrupts both.
- provision_realm (:213): DERIVABLE; season gate ambient.

## hyperstructure_create_systems (realm/blitz/hyperstructure_create/contracts.cairo:10)

- reserve_hyperstructures (:32): PERMISSIONLESS, count only; singleton cursor blitz_hypers_settlement_config write;
  IMapImpl::explore + occupy(ReservedHyperstructure, 0); deploy script batches count=19 until 1+3R(R+1) tiles
  (config/deployer/clean/blitz/hyperstructure-reservation.ts:6-49, batch 19, 10s cooldown). Same deterministic
  center-anchored rings → identical for same preset. This is registrar create_game work.
- create_hyperstructure (:98): PERMISSIONLESS, coord param; requires occupier ReservedHyperstructure; uuid structure id
  (utils/hyperstructure.cairo:104); seed = poseidon(coord_seed, block_timestamp).

## realm_systems season (realm/season/contracts.cairo:23)

- create (:77): MUST_PASS; season-pass path; CoordImpl::center + settlement_config.generate_coord; writes
  realm_count_config + settlement_config singletons; gate spires_max_count == spires_settled_count (world-level);
  AntiBot model inline (:56, keyed caller+tx_hash, global harmless).

## realm_internal_systems (realm/utils/contracts.cairo:32)

- create_internal (:42): MUST_PASS; internal-only (dns realm_systems | blitz_realm_systems); uuid structure id
  (utils/realm.cairo:47); make_structure writes shared tile; optional starting troops.
- provision_internal (:73): DERIVABLE; reveal_realm_surroundings loops 6 neighbor TileOpt reads; starting resources;
  center ResourceLabor building.

## relic_systems (relic/contracts.cairo:19)

- open_chest (:73): DERIVABLE from explorer; chest_coord needs (game_id, coord); PlayerRegisteredPoints player-keyed
  write; uuid.
- apply_relic (:139): DERIVABLE; EXPLORER_INSTANTLY_EXPLORE calls IMapImpl::explore_ring (:261 → utils/map.cairo:142)
  looping coord ring TileOpt read/writes; guard branch loops all_slots.

## resource_bridge_systems (resource_bridge_systems.cairo:23) — EXCLUDE FROM s2_blitz

- deposit (:52)/withdraw (:160): shared pooled ERC20 balance for whole world; lp_withdraw (:241) liquidity-systems-only.
- velords_claim (:287): PERMISSIONLESS sweep of entire LORDS balance gated on singleton season ended — drains
  still-running games. Eternum-mainnet-specific; no Blitz caller.

## resource_systems (resource_systems.cairo:24) — all gate on season singleton (AMBIENT)

- approve (:87): ResourceAllowance (owner,approved,resource_type) — cross-game allowance representable; no same-game
  assert.
- send (:145)/pickup (:203): cross-game resource transfer risk; distance from shared coords.
- troop_troop (:269)/troop_structure (:297)/structure_troop (:348) adjacent transfers: adjacency by coord = cross-game
  predicate; structure_troop recipient-owner check COMMENTED OUT (:355-363) — can push resources onto anyone's adjacent
  troop.
- troop_burn (:377)/structure_burn (:402): DERIVABLE fine.
- structure_regularize_weight (:426): caller-supplied Array<ID>, no ownership check, loops ids × all_resource_ids —
  anyone touches any game's structures.
- arrivals_offload (:435): day from singleton tick config → per-game.

## season_systems (season/contracts.cairo:25)

- season_close (:46): asserts blitz_mode_on == false (Eternum-season only; Blitz ends by end_at timestamp);
  SeasonConfigImpl::end_season writes singleton end_at — ends EVERY game; PlayerRegisteredPoints(caller) player-keyed →
  cross-game points satisfy points_for_win; SeasonEnded{winner} no game discriminator.
- Lifecycle surface = SeasonConfig fields + this close fn. Registrar owns phase timestamps; end*season takes game_id.
  assert*\* helpers (config.cairo:175-215) called from ~25 entrypoints in this slice alone.

## spire_systems (spire/contracts.cairo:21)

- create_spires (:63): PERMISSIONLESS map-init; writes settlement_config.spires_settled_count singleton; 2 TileOpt
  lookups per spire (regular+alt, :46-49); uuid spire_id; gates realm_systems.create.

## structure_systems (structure/contracts.cairo:9)

- level_up (:38): DERIVABLE; StructureLevelConfig(level) + ResourceList(id,index) config rows; TileOpt coord lookup +
  occupy; loop required resources; uuid.

## trade_systems (trade/contracts/trade_systems.cairo:22)

- create_order (:88): DERIVABLE from maker; taker_id arbitrary world id no same-game check; Trade keyed uuid trade_id;
  TradeCount by maker.
- accept_order (:199): **THE cross-game orderbook join** — bare trade_id lookup (:204), ownership only on taker (:208),
  public orders (taker_id==0) takeable by any structure in world; resources → both parties' ResourceArrival slots;
  travel time from shared coords. Needs game_id key + assert maker.game_id == taker.game_id.
- cancel_order (:376): different gate (main-game grace) than create/accept.

## village_systems (village/contracts.cairo:11) — EXCLUDABLE from s2_blitz

- create (:41): village-pass ERC721 world-global; coord walk from realm; shared tile write.
- receive_army_grant (:148): tick singleton math (AMBIENT clock).
- Village branches in resource/trade systems never fire without villages.

## Riskiest ranked

1. blitz settle (identical spawn coords, shared pool, player-keyed lockout)
2. trade accept_order (cross-game resource pipe)
3. reserve/create hyperstructures (permissionless cursor+tiles)
4. season_close (ends all games; cross-game points win)
5. velords_claim (drains all games; exclude contract)
6. structure_regularize_weight (arbitrary id list, no auth)
7. resource send/pickup/approve (cross-game pairs)
8. create_spires (permissionless world-setup, gates realm create)
9. quest singletons + (game_token_id, game_address) collision
10. structure_troop_adjacent_transfer (disabled owner check + coord adjacency)
