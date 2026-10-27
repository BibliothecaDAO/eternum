pub fn biome(key: TileKey, game_context: crate::commands::BiomeContext) -> u8 {
    // Every reveal stores the biome derived here; deriving it again is the costliest step of a move or a battle. The
    // byte lives in the stored tile word alone, so one read answers revealed and unrevealed tiles alike.
    let terrain_word = crate::state::read().map.tiles.read((key.game_id, key.alt, key.col, key.row));
    let stored = terrain_word / crate::map::BIOME_SCALE % crate::map::BYTE_RANGE;
    if stored != 0 {
        return stored.try_into().unwrap();
    }
    crate::settlement::ITerrainDerivationDispatcherTrait::biome(terrain(key.game_id), key, game_context)
}

pub fn raise_expedition_home(key: TileKey, context: crate::commands::BiomeContext) {
    crate::settlement::ITerrainDerivationDispatcherTrait::raise_expedition_home(terrain(key.game_id), key, context);
}

fn terrain(game_id: u32) -> crate::settlement::ITerrainDerivationLibraryDispatcher {
    let state = crate::state::read();
    let release = state.game_releases.read(game_id);
    assert!(release != 0, "game has no release");
    crate::settlement::ITerrainDerivationLibraryDispatcher {
        class_hash: state.releases.entry(release).classes.settlement.read(),
    }
}
use starknet::storage::{StorageMapReadAccess, StoragePathEntry, StoragePointerReadAccess};
use crate::map::{TileKey, TileOpt};

pub fn occupancy(key: TileKey) -> Option<crate::map::TileOccupancy> {
    let state = crate::state::read();
    let occupancy = crate::map::occupancy_from_bits(
        state.map.occupancy.read((key.game_id, key.alt, key.col, key.row)),
    )?;
    if occupancy.category == crate::taxonomy::RUIN_OCCUPIER
        && crate::logic::expeditions::ruin_disappeared(
            crate::resources::ResourceKey { game_id: key.game_id, entity_id: occupancy.entity_id },
        ) {
        None
    } else {
        Some(occupancy)
    }
}

pub fn entity_coord(key: crate::resources::ResourceKey) -> Option<crate::troops::Coord> {
    if crate::logic::expeditions::ruin_disappeared(key) {
        return None;
    }
    let state = crate::state::read();
    crate::map::position_from_bits(state.map.entity_tiles.read((key.game_id, key.entity_id)))
}

pub fn tile(key: TileKey) -> Option<TileOpt> {
    let state = crate::state::read();
    let storage_key = (key.game_id, key.alt, key.col, key.row);
    let occupier = occupancy(key);
    let terrain = state.map.tiles.read(storage_key);
    if terrain / crate::map::BIOME_SCALE % crate::map::BYTE_RANGE != 0 || occupier.is_some() {
        Some(TileOpt { data: crate::map::coordinate_bits(key) + terrain })
    } else {
        None
    }
}

pub mod MapState {
    use starknet::Event as EventTrait;
    use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess};
    use crate::events::{RowDeleted, RowSet};
    use crate::map::{BIOME_SCALE, BYTE_RANGE, TileKey, TileOccupancy};

    #[derive(Drop, starknet::Event)]
    pub enum Event {
        RowSet: RowSet,
        RowDeleted: RowDeleted,
    }

    pub fn reveal(key: TileKey, biome: u8) {
        let state = crate::state::read();
        assert!(key.game_id != 0, "reserved game id");
        assert!(biome > 0 && biome <= 17, "invalid biome");
        let previous = state.map.tiles.read((key.game_id, key.alt, key.col, key.row));
        assert!(previous / BIOME_SCALE % BYTE_RANGE == 0, "tile already revealed");
        write_terrain(key, previous + biome.into() * BIOME_SCALE);
    }

    pub fn mark_reward_extracted(key: TileKey) {
        let state = crate::state::read();
        let previous = state.map.tiles.read((key.game_id, key.alt, key.col, key.row));
        assert!(previous / BIOME_SCALE % BYTE_RANGE != 0, "tile must be revealed");
        assert!(previous / crate::map::REWARD_EXTRACTED_FLAG % 2 == 0, "reward already extracted");
        write_terrain(key, previous + crate::map::REWARD_EXTRACTED_FLAG);
    }

    pub fn occupy(key: TileKey, entity_id: u64, category: u8, is_structure: bool) {
        assert!(entity_id != 0 && category != crate::taxonomy::NONE_OCCUPIER, "empty occupier");
        assert!(crate::logic::map::occupancy(key).is_none(), "occupied tile");
        write_occupancy(key, Some(TileOccupancy { entity_id, category, is_structure }));
    }

    pub fn reserve_hyperstructure(key: TileKey) {
        crate::logic::map::tile(key).expect('unrevealed reservation');
        assert!(crate::logic::map::occupancy(key).is_none(), "occupied reservation tile");
        // Category distinguishes this reservation from an empty tile despite its zero entity id.
        write_occupancy(
            key,
            Some(
                TileOccupancy {
                    entity_id: 0, category: crate::taxonomy::RESERVED_HYPERSTRUCTURE_OCCUPIER, is_structure: true,
                },
            ),
        );
    }

    pub fn release_hyperstructure(key: TileKey) {
        let previous = crate::logic::map::occupancy(key).expect('missing reservation');
        assert!(
            previous.category == crate::taxonomy::RESERVED_HYPERSTRUCTURE_OCCUPIER, "hyperstructure already created",
        );
        write_occupancy(key, None);
    }

    pub fn upgrade_realm(key: TileKey, entity_id: u64, wonder: bool, level: u8) {
        let previous = crate::logic::map::occupancy(key).expect('missing realm tile');
        assert!(!key.alt && previous.is_structure, "not a surface structure");
        assert!(previous.entity_id == entity_id, "occupier mismatch");
        assert!(
            previous.category >= crate::taxonomy::REALM_REGULAR_LEVEL_1_OCCUPIER
                && previous.category <= crate::taxonomy::REALM_WONDER_LEVEL_4_OCCUPIER,
            "not a realm tile",
        );
        assert!(level <= 3, "invalid realm level");
        let category = level
            + if wonder {
                crate::taxonomy::REALM_WONDER_LEVEL_1_OCCUPIER
            } else {
                crate::taxonomy::REALM_REGULAR_LEVEL_1_OCCUPIER
            };
        write_occupancy(key, Some(TileOccupancy { category, ..previous }));
    }

    pub fn vacate(key: TileKey, entity_id: u64) {
        let previous = crate::logic::map::occupancy(key).expect('undiscovered tile');
        assert!(!previous.is_structure, "cannot vacate structure");
        assert!(entity_id != 0 && previous.entity_id == entity_id, "occupier mismatch");
        write_occupancy(key, None);
    }

    pub fn clear_expedition_site(site_key: crate::resources::ResourceKey) {
        let site = crate::logic::expeditions::expedition_site(site_key).expect('missing expedition site');
        assert!(site.clear.is_some(), "site not cleared");
        let key = TileKey { game_id: site_key.game_id, alt: site.alt, col: site.col, row: site.row };
        let previous = crate::logic::map::occupancy(key).expect('missing site blocker');
        assert!(previous.is_structure && previous.entity_id == site_key.entity_id, "site blocker mismatch");
        write_occupancy(key, None);
    }

    fn write_terrain(key: TileKey, data: u128) {
        let state = crate::state::write();
        let storage_key = (key.game_id, key.alt, key.col, key.row);
        state.map.tiles.write(storage_key, data);
        let mut keys = array![];
        key.serialize(ref keys);
        emit(
            Event::RowSet(
                RowSet { version: 1, model: 'TileOpt', keys: keys.span(), values: array![data.into()].span() },
            ),
        );
    }

    // Chests and spires are tile-only facts; reservations have no entity yet.
    fn has_single_position(occupier: TileOccupancy) -> bool {
        occupier.entity_id != 0
            && occupier.category != crate::taxonomy::CHEST_OCCUPIER
            && occupier.category != crate::taxonomy::SPIRE_OCCUPIER
    }

    // The occupancy fact and its private reverse index are changed only here.
    fn write_occupancy(key: TileKey, next: Option<TileOccupancy>) {
        let state = crate::state::write();
        let storage_key = (key.game_id, key.alt, key.col, key.row);
        let previous = crate::map::occupancy_from_bits(state.map.occupancy.read(storage_key));
        if let Some(occupier) = previous {
            if has_single_position(occupier) {
                state.map.entity_tiles.write((key.game_id, occupier.entity_id), 0);
            }
        }
        if let Some(occupier) = next {
            if has_single_position(occupier) {
                assert!(state.map.entity_tiles.read((key.game_id, occupier.entity_id)) == 0, "entity already placed");
                state
                    .map
                    .entity_tiles
                    .write(
                        (key.game_id, occupier.entity_id),
                        crate::map::position_bits(crate::troops::Coord { alt: key.alt, x: key.col, y: key.row }),
                    );
            }
        }
        state
            .map
            .occupancy
            .write(
                storage_key,
                next.map(|occupancy| crate::map::occupancy_bits(occupancy)).unwrap_or(0).try_into().unwrap(),
            );
        let mut keys = array![];
        key.serialize(ref keys);
        match next {
            Some(occupier) => {
                let mut values = array![];
                occupier.serialize(ref values);
                emit(
                    Event::RowSet(
                        RowSet { version: 1, model: 'TileOccupancy', keys: keys.span(), values: values.span() },
                    ),
                );
            },
            None => emit(Event::RowDeleted(RowDeleted { version: 1, model: 'TileOccupancy', keys: keys.span() })),
        };
    }

    #[cfg(feature: "test_support")]
    pub fn relocate_fixture(
        key: crate::resources::ResourceKey, coord: crate::troops::Coord, category: u8, is_structure: bool,
    ) {
        if let Some(previous) = crate::logic::map::entity_coord(key) {
            write_occupancy(crate::geometry::tile_key(key.game_id, previous), None);
        }
        let tile = crate::geometry::tile_key(key.game_id, coord);
        assert!(crate::logic::map::occupancy(tile).is_none(), "occupied fixture destination");
        write_occupancy(tile, Some(TileOccupancy { entity_id: key.entity_id, category, is_structure }));
    }

    pub fn emit(event: Event) {
        let mut keys = array![selector!("MapEvent")];
        let mut data = array![];
        event.append_keys_and_data(ref keys, ref data);
        starknet::syscalls::emit_event_syscall(keys.span(), data.span()).unwrap();
    }
}

#[starknet::contract]
pub mod MapLogic {
    use starknet::ContractAddress;
    use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess, StoragePathEntry, StoragePointerReadAccess};
    use crate::geometry::{distance, spire_neighbor, tile_key};
    use crate::logic::map::MapState;
    use crate::logic::release::ReleaseState;
    use crate::logic::settlement::SettlementPoolState;
    use crate::map::{BIOME_SCALE, BYTE_RANGE, TileKey, TileOpt};
    use crate::troops::Coord;
    component!(path: ReleaseState, storage: release, event: ReleaseEvent);
    component!(path: SettlementPoolState, storage: settlements, event: SettlementEvent);
    impl SettlementInternal = SettlementPoolState::InternalImpl<ContractState>;
    impl LifeInternal = ReleaseState::InternalImpl<ContractState>;

    #[storage]
    #[allow(starknet::colliding_storage_paths)]
    struct Storage {
        #[flat]
        pub data: crate::state::Storage,
        #[substorage(v0)]
        release: ReleaseState::Storage,
        #[substorage(v0)]
        settlements: SettlementPoolState::Storage,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        ReleaseEvent: ReleaseState::Event,
        MapEvent: MapState::Event,
        SettlementEvent: SettlementPoolState::Event,
        RowSet: crate::events::RowSet,
        StoryEvent: crate::ownership::StoryEvent,
    }

    #[abi(embed_v0)]
    impl Map of crate::map::IMapLogic<ContractState> {
        fn biome(self: @ContractState, key: TileKey, game_context: crate::commands::BiomeContext) -> u8 {
            crate::logic::map::biome(key, game_context)
        }
        fn discovery(
            self: @ContractState,
            key: TileKey,
            seed: u256,
            hyperstructures: u32,
            timestamp: u64,
            game_context: crate::commands::ActionContext,
        ) -> crate::discovery::Discovery {
            let game_context = crate::commands::execution_context(key.game_id, game_context);

            let rules = game_context.rules.unbox();
            let coord = Coord { alt: key.alt, x: key.col, y: key.row };
            if key.alt {
                let mut adjacent = false;
                for direction in 0_u8..6 {
                    let tile = crate::logic::map::occupancy(tile_key(key.game_id, spire_neighbor(coord, direction)));
                    if tile.map(|tile| tile.category == crate::taxonomy::SPIRE_OCCUPIER).unwrap_or(false) {
                        adjacent = true;
                    }
                }
                crate::discovery::ethereal(rules.map_config, rules.bitcoin_mine_config.enabled, adjacent, seed)
            } else {
                let center = crate::settlement_grid::map_center(rules.map_center_offset);
                crate::discovery::surface(
                    rules.map_config, seed, distance(coord, center), hyperstructures, rules.mode_rules,
                )
            }
        }

        fn reveal_structure_surroundings(
            ref self: ContractState, game_id: u32, coord: Coord, game_context: crate::commands::BiomeContext,
        ) {
            for direction in 0_u8..6 {
                let key = tile_key(game_id, crate::geometry::neighbor(coord, direction));
                let data = crate::logic::map::tile(key).map(|tile| tile.data).unwrap_or(0);
                if data / BIOME_SCALE % BYTE_RANGE == 0 {
                    crate::logic::map::MapState::reveal(key, crate::logic::map::biome(key, game_context));
                }
            }
        }

        fn reveal_destination_tile(
            ref self: ContractState, key: TileKey, game_context: crate::commands::BiomeContext,
        ) -> Option<TileOpt> {
            let stored = crate::logic::map::tile(key);
            if stored.map(|tile| tile.data / BIOME_SCALE % BYTE_RANGE != 0).unwrap_or(false) {
                return stored;
            }
            if game_context.day_unit_seconds == 0
                || !crate::expeditions::is_home_ring(
                    Coord { alt: key.alt, x: key.col, y: key.row },
                    crate::logic::settlement::rules(key.game_id).spacing,
                ) {
                return stored;
            }
            crate::logic::map::raise_expedition_home(key, game_context);
            crate::logic::map::tile(key)
        }

        fn expedition_home_ring(
            self: @ContractState, game_id: u32, region_id: u32, timestamp: u64,
        ) -> Span<(Coord, u8)> {
            crate::settlement::ITerrainDerivationDispatcherTrait::expedition_home_ring(
                crate::logic::map::terrain(game_id), game_id, region_id, timestamp,
            )
        }
    }
    #[abi(embed_v0)]
    impl FrontierDiscovery of crate::expeditions::IFrontierDiscovery<ContractState> {
        fn frontier_discovery_rules(
            self: @ContractState, game_id: u32,
        ) -> Option<crate::expeditions::FrontierDiscoveryRules> {
            crate::logic::preset_record::for_game(game_id).discovery_rules.read()
        }
        fn consume_frontier_site(ref self: ContractState, key: TileKey) -> u8 {
            let occupied = crate::logic::map::occupancy(key).expect('missing site');
            assert!(
                !occupied.is_structure
                    && (occupied.category == crate::taxonomy::SHRINE_OCCUPIER
                        || occupied.category == crate::taxonomy::WELL_OCCUPIER),
                "tile is not a shrine or well",
            );
            crate::logic::map::MapState::vacate(key, occupied.entity_id);
            occupied.category
        }
        fn expedition_discovery(
            self: @ContractState, key: crate::expeditions::ExpeditionDiscoveryKey,
        ) -> Option<crate::expeditions::ExpeditionDiscovery> {
            crate::logic::expeditions::discovery(key)
        }
        fn discover_frontier_tile(
            ref self: ContractState,
            key: TileKey,
            explorer_id: u64,
            seed: u256,
            context: crate::commands::ActionContext,
        ) -> crate::discovery::Discovery {
            let context = crate::commands::execution_context(key.game_id, context);
            let mut rules = self.frontier_discovery_rules(key.game_id).expect('missing discovery rules');
            let explorer_key = crate::troops::ExplorerKey { game_id: key.game_id, explorer_id };
            let home = crate::state::read().troops.explorers.entry((key.game_id, explorer_id)).owner.read();
            assert!(home != 0, "missing exploring army");
            let progress = crate::logic::progression::require(explorer_key);
            let home_key = crate::resources::ResourceKey { game_id: key.game_id, entity_id: home };
            let learned = crate::logic::research::require(home_key).learned;
            if crate::research::tier(learned, crate::research::ROW_SHRINE) == 0 {
                rules.shrine_bps = 0;
            }
            if crate::research::tier(learned, crate::research::ROW_WELL) == 0 {
                rules.well_bps = 0;
            }
            let counter = crate::expeditions::ExpeditionDiscoveryKey {
                game_id: key.game_id,
                structure_id: home,
                epoch: crate::expeditions::region_day(
                    crate::troops::Coord { alt: key.alt, x: key.col, y: key.row },
                    crate::logic::settlement::rules(key.game_id).spacing,
                ),
            };
            let day = crate::logic::expeditions::discovery(counter)
                .unwrap_or(crate::expeditions::ExpeditionDiscovery { empty_reveals: 0, ruin_cleared: false });
            if !key.alt
                && crate::rules::rule_enabled(context.rules.unbox(), crate::rules::DISCOVER_CHESTS)
                && crate::discovery::frontier_chest(seed) {
                let chest = crate::logic::lords_budget::common_candidate(key.game_id, context);
                if crate::logic::lords_budget::try_reserve(key.game_id, chest, context) {
                    let id = crate::entity_ids::allocate_home(key.game_id, home);
                    crate::logic::lords_budget::store_site_chest(
                        crate::resources::ResourceKey { game_id: key.game_id, entity_id: id }, chest,
                    );
                    crate::logic::map::MapState::occupy(key, id, crate::taxonomy::CHEST_OCCUPIER, false);
                    crate::logic::expeditions::record_discovery(counter, crate::discovery::Discovery::Chest);
                    return crate::discovery::Discovery::Chest;
                }
            }
            let ruin = if day.ruin_cleared {
                None
            } else {
                let odds = crate::logic::expeditions::depth_rules_at(
                    key.game_id, Coord { alt: key.alt, x: key.col, y: key.row },
                )
                    .chest;
                Some(crate::logic::lords_budget::candidate(key.game_id, odds, seed, context))
            };
            let (camp, rift, beasts) = crate::progression::scouting_bonus(progress);
            let result = crate::discovery::frontier(rules, camp, rift, beasts, day.empty_reveals, ruin, seed);
            crate::logic::expeditions::record_discovery(counter, result);
            if let Some(category) = crate::discovery::tile_occupier(result) {
                crate::logic::map::MapState::occupy(
                    key, crate::entity_ids::allocate_home(key.game_id, home), category, false,
                );
            }
            result
        }
    }
    #[abi(embed_v0)]
    impl Extraction of crate::exploration_rewards::IExtraction<ContractState> {
        fn extraction_rewards(
            self: @ContractState, game_id: u32,
        ) -> Span<crate::exploration_rewards::ExplorationReward> {
            let preset = crate::logic::preset_record::for_game(game_id);
            let count = preset.exploration_reward_count.read();
            let mut rewards = array![];
            for index in 0..count {
                rewards.append(preset.exploration_rewards.read(index));
            }
            rewards.span()
        }
        fn extract_exploration_reward(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            explorer_id: u64,
            revealed: Option<Coord>,
            context: crate::commands::ActionContext,
        ) -> () {
            let context = crate::commands::execution_context(game_id, context);
            let explorer = self.revealing_explorer(game_id, actor, explorer_id, context);
            let rules = context.rules.unbox();
            let coord = if crate::rules::rule_enabled(rules, crate::rules::REVEAL_SUPPLIES) {
                match revealed {
                    Some(coord) => coord,
                    None => { return (); },
                }
            } else {
                explorer.coord
            };
            let key = tile_key(game_id, coord);
            let tile = crate::logic::map::tile(key).expect('unrevealed extraction tile');
            assert!(tile.data / BIOME_SCALE % BYTE_RANGE != 0, "tile must be revealed");
            let mut root = context.raw_root;
            let seed = crate::random::game_root(ref root, game_id);
            if tile.data / crate::map::REWARD_EXTRACTED_FLAG % 2 == 1 {
                return ();
            }
            let reward = if crate::rules::rule_enabled(rules, crate::rules::REVEAL_SUPPLIES) {
                crate::exploration_rewards::reveal_reward(
                    explorer.troops,
                    rules.troop_limit_config,
                    crate::logic::expeditions::depth_rules_at(game_id, coord).reveal_percent,
                    seed,
                )
            } else {
                crate::exploration_rewards::pool_reward(
                    self.extraction_rewards(game_id),
                    explorer.troops,
                    rules.troop_limit_config,
                    context.timestamp,
                    seed,
                )
            };
            let paid = self.pay_reveal(game_id, explorer_id, explorer, coord, reward, context);
            crate::logic::map::MapState::mark_reward_extracted(key);
            if rules.day_unit_seconds != 0 {
                crate::progression::IArmyProgressionDispatcherTrait::grant_army_xp(
                    crate::progression::IArmyProgressionLibraryDispatcher {
                        class_hash: self.release.classes(game_id).relics.read(),
                    },
                    crate::troops::ExplorerKey { game_id, explorer_id },
                    crate::progression::XpAward::Reveal,
                );
            }
            self
                .record_story(
                    game_id, actor, context.timestamp, paid, crate::ownership::Story::ExplorationReward(paid),
                );
            ()
        }
        fn raise_dormant_spire(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            explorer_id: u64,
            coord: Coord,
            context: crate::commands::ActionContext,
        ) {
            let context = crate::commands::execution_context(game_id, context);
            assert!(
                crate::rules::rule_enabled(context.rules.unbox(), crate::rules::DISCOVER_SPIRES),
                "spire discovery is disabled",
            );
            let explorer = self.revealing_explorer(game_id, actor, explorer_id, context);
            crate::logic::map::MapState::occupy(
                tile_key(game_id, coord),
                crate::entity_ids::allocate_home(game_id, explorer.owner),
                crate::taxonomy::DORMANT_SPIRE_OCCUPIER,
                false,
            );
            let reward = crate::exploration_rewards::spire_reward(explorer.troops.boosts, context.timestamp);
            let paid = self.pay_reveal(game_id, explorer_id, explorer, coord, reward, context);
            self.record_story(game_id, actor, context.timestamp, paid, crate::ownership::Story::SpireDiscovered(paid));
        }
    }
    #[abi(embed_v0)]
    impl RelicMap of crate::relics::IRelicMap<ContractState> {
        #[cfg(feature: "test_support")]
        fn relic_discovery_time(self: @ContractState, game_id: u32) -> u64 {
            self.data.map_rules.last_relic_discovery.read(game_id)
        }
        fn discover_relic_chest(
            ref self: ContractState,
            game_id: u32,
            home_id: u64,
            coord: Coord,
            excluded: Coord,
            seed: u256,
            timestamp: u64,
            game_context: crate::commands::ActionContext,
        ) {
            let game_context = crate::commands::execution_context(game_id, game_context);
            let rules = game_context.rules.unbox();
            if !crate::rules::rule_enabled(rules, crate::rules::DISCOVER_CHESTS) || coord.alt {
                return;
            }
            if self.data.map_rules.last_relic_discovery.read(game_id)
                + Into::<u16, u64>::into(rules.map_config.relic_discovery_interval_sec) > timestamp {
                return;
            }
            let mut destination = crate::relics::chest_destination(
                coord, seed, rules.map_config.relic_hex_dist_from_center,
            );
            loop {
                let key = tile_key(game_id, destination);
                let data = crate::logic::map::tile(key).map(|tile| tile.data).unwrap_or(0);
                if destination != excluded
                    && destination != coord
                    && crate::logic::map::occupancy(key).is_none()
                    && !crate::state::read().settlement_pool.reserved.read((game_id, destination.x, destination.y)) {
                    if data / BIOME_SCALE % BYTE_RANGE == 0 {
                        crate::logic::map::MapState::reveal(
                            key, crate::logic::map::biome(key, crate::commands::biome_context(game_context)),
                        );
                    }
                    let chest_id = crate::entity_ids::allocate_home(game_id, home_id);
                    crate::logic::map::MapState::occupy(key, chest_id, crate::taxonomy::CHEST_OCCUPIER, false);
                    crate::logic::relic_chests::store(
                        crate::resources::ResourceKey { game_id, entity_id: chest_id }, crate::relics::draw_chest(seed),
                    );
                    break;
                }
                destination = crate::geometry::neighbor(destination, 0);
            }
            self.data.map_rules.last_relic_discovery.write(game_id, timestamp);
            self
                .emit(
                    crate::events::RowSet {
                        version: 1,
                        model: 'RelicDiscovery',
                        keys: array![game_id.into()].span(),
                        values: array![timestamp.into()].span(),
                    },
                );
        }
        fn consume_relic_chest(ref self: ContractState, game_id: u32, coord: Coord) -> u64 {
            let key = tile_key(game_id, coord);
            let occupied = crate::logic::map::occupancy(key).expect('missing chest tile');
            assert!(
                !occupied.is_structure && occupied.category == crate::taxonomy::CHEST_OCCUPIER,
                "tile is not a relic chest",
            );
            let id = occupied.entity_id;
            crate::logic::map::MapState::vacate(key, id);
            id
        }
        fn reveal_relic_ring(
            ref self: ContractState,
            game_id: u32,
            coord: Coord,
            radius: u8,
            game_context: crate::commands::BiomeContext,
        ) {
            assert!(radius == 1 || radius == 2, "invalid relic radius");
            for radius in 1_u32..Into::<u8, u32>::into(radius) + 1 {
                let mut next = crate::geometry::neighbor_at_distance(coord, 4, radius);
                for direction in 0_u8..6 {
                    for _ in 0..radius {
                        let key = tile_key(game_id, next);
                        let data = crate::logic::map::tile(key).map(|tile| tile.data).unwrap_or(0);
                        if data / BIOME_SCALE % BYTE_RANGE == 0 {
                            crate::logic::map::MapState::reveal(key, crate::logic::map::biome(key, game_context));
                        }
                        next = crate::geometry::neighbor(next, direction);
                    }
                }
            }
        }
    }
    #[generate_trait]
    impl Internal of InternalTrait {
        /// The surface army standing on its own tile that a reveal pays.
        fn revealing_explorer(
            self: @ContractState,
            game_id: u32,
            actor: ContractAddress,
            explorer_id: u64,
            context: crate::commands::ExecutionContext,
        ) -> crate::troops::ExplorerTroops {
            crate::game::assert_playing(context.game.unbox(), context.timestamp);
            let explorer = crate::logic::troops::authorized_explorer(
                crate::troops::ExplorerKey { game_id, explorer_id }, actor, context.timestamp, context,
            );
            assert!(!explorer.coord.alt, "extraction requires surface");
            assert!(explorer.troops.count != 0, "explorer is dead");
            let occupied = crate::logic::map::occupancy(tile_key(game_id, explorer.coord))
                .expect('missing army occupancy');
            assert!(occupied.entity_id == explorer_id, "explorer does not occupy tile");
            explorer
        }

        /// Grants a reveal's reward to the army or, under home rewards, to its realm.
        fn pay_reveal(
            ref self: ContractState,
            game_id: u32,
            explorer_id: u64,
            explorer: crate::troops::ExplorerTroops,
            coord: Coord,
            reward: crate::resources::ResourceAmount,
            context: crate::commands::ExecutionContext,
        ) -> crate::exploration_rewards::ExtractedReward {
            let receiver = crate::exploration_rewards::receiver(
                crate::rules::rule_enabled(context.rules.unbox(), crate::rules::HOME_REWARDS),
                explorer_id,
                explorer.owner,
                reward.resource_type,
            );
            crate::exploration_rewards::IExplorationGrantDispatcherTrait::grant_exploration_reward(
                crate::exploration_rewards::IExplorationGrantLibraryDispatcher {
                    class_hash: self.release.classes(game_id).resources.read(),
                },
                crate::resources::ResourceKey { game_id, entity_id: receiver },
                reward.resource_type,
                reward.amount,
                context.timestamp,
                crate::commands::resource_context(context),
            );
            crate::exploration_rewards::ExtractedReward {
                explorer_id, receiver, coord, resource_type: reward.resource_type, amount: reward.amount,
            }
        }

        /// A reveal's payout story, told once for the army that revealed it.
        fn record_story(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            timestamp: u64,
            paid: crate::exploration_rewards::ExtractedReward,
            story: crate::ownership::Story,
        ) {
            self
                .emit(
                    crate::ownership::StoryEvent {
                        version: 2,
                        game_id,
                        entity_id: Some(paid.explorer_id),
                        owner: Some(actor),
                        timestamp,
                        tx_hash: starknet::get_tx_info().unbox().transaction_hash,
                        story,
                    },
                );
        }
    }
}
