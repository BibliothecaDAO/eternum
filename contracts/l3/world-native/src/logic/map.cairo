pub fn biome(key: TileKey) -> u8 {
    let rules = crate::logic::game::rules(key.game_id);
    let climate = if rules.epoch_seconds == 0 {
        rules.biome_climate_config
    } else {
        let spacing = crate::logic::settlement::rules(key.game_id).spacing;
        crate::expeditions::climate(
            rules.biome_climate_config,
            crate::troops::Coord { alt: key.alt, x: key.col, y: key.row },
            crate::logic::game::game(key.game_id).start_main_at,
            rules.epoch_seconds,
            spacing,
        )
    };
    crate::biome::get_biome_with_climate(key.alt, key.col.into(), key.row.into(), climate).into()
}
use starknet::storage::StorageMapReadAccess;
use crate::map::{TileKey, TileOpt};

pub fn tile(key: TileKey) -> Option<TileOpt> {
    let state = crate::state::read();
    let storage_key = (key.game_id, key.alt, key.col, key.row);
    if state.map.exists.read(storage_key) {
        Some(TileOpt { data: state.map.tiles.read(storage_key) })
    } else {
        None
    }
}

pub mod MapState {
    use starknet::Event as EventTrait;
    use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess};
    use crate::events::{RowMemberSet, RowSet};
    use crate::map::{
        BIOME_SCALE, BYTE_RANGE, ENTITY_RANGE, OCCUPIER_SCALE, RESERVED_HYPERSTRUCTURE, TileKey, TileOpt,
        coordinate_bits,
    };

    #[derive(Drop, starknet::Event)]
    pub enum Event {
        RowSet: RowSet,
        RowMemberSet: RowMemberSet,
    }

    pub fn reveal(key: TileKey, biome: u8) {
        let state = crate::state::write();
        assert!(key.game_id != 0, "reserved game id");
        assert!(biome > 0 && biome <= 17, "invalid biome");
        let storage_key = (key.game_id, key.alt, key.col, key.row);
        let tile = crate::logic::map::tile(key);
        let previous = tile.map(|tile| tile.data).unwrap_or(coordinate_bits(key));
        assert!((previous / BIOME_SCALE) % BYTE_RANGE == 0, "tile already revealed");
        let data = previous + biome.into() * BIOME_SCALE;
        state.map.tiles.write(storage_key, data);
        if tile.is_none() {
            state.map.exists.write(storage_key, true);
        }
        let mut keys = array![];
        key.serialize(ref keys);
        emit(
            Event::RowSet(
                RowSet { version: 1, model: 'TileOpt', keys: keys.span(), values: array![data.into()].span() },
            ),
        );
    }

    pub fn occupy(key: TileKey, entity_id: u32, category: u8, is_structure: bool) {
        let tile = crate::logic::map::tile(key).unwrap_or(TileOpt { data: coordinate_bits(key) });
        assert!(tile.data % 2 == 0, "cannot occupy structure");
        assert!(entity_id != 0 && category != 0, "empty occupier");
        assert!(tile.data % BIOME_SCALE == 0, "occupied tile");
        let data = tile.data
            + entity_id.into() * OCCUPIER_SCALE
            + category.into() * 2
            + if is_structure {
                1
            } else {
                0
            };
        write_occupancy(key, data);
    }

    pub fn reserve_hyperstructure(key: TileKey) {
        let tile = crate::logic::map::tile(key).expect('unrevealed reservation');
        assert!(tile.data % BIOME_SCALE == 0, "occupied reservation tile");
        write_occupancy(key, tile.data + RESERVED_HYPERSTRUCTURE * 2 + 1);
    }
    pub fn release_hyperstructure(key: TileKey) {
        let tile = crate::logic::map::tile(key).expect('missing reservation');
        assert!((tile.data / 2) % BYTE_RANGE == RESERVED_HYPERSTRUCTURE, "hyperstructure already created");
        write_occupancy(key, tile.data - tile.data % BIOME_SCALE);
    }
    pub fn upgrade_realm(key: TileKey, entity_id: u32, wonder: bool, level: u8) {
        let tile = crate::logic::map::tile(key).expect('missing realm tile');
        assert!(!key.alt && tile.data % 2 == 1, "not a surface structure");
        assert!((tile.data / OCCUPIER_SCALE) % ENTITY_RANGE == entity_id.into(), "occupier mismatch");
        let previous = (tile.data / 2) % BYTE_RANGE;
        assert!(previous >= 1 && previous <= 8, "not a realm tile");
        assert!(level <= 3, "invalid realm level");
        let category: u128 = level.into() + if wonder {
            5
        } else {
            1
        };
        write_occupancy(key, tile.data - previous * 2 + category * 2);
    }

    pub fn vacate(key: TileKey, entity_id: u32) {
        let tile = crate::logic::map::tile(key).expect('undiscovered tile');
        assert!(tile.data % 2 == 0, "cannot vacate structure");
        assert!(entity_id != 0 && (tile.data / OCCUPIER_SCALE) % ENTITY_RANGE == entity_id.into(), "occupier mismatch");
        write_occupancy(key, tile.data - tile.data % BIOME_SCALE);
    }

    pub fn write_occupancy(key: TileKey, data: u128) {
        let state = crate::state::write();
        let storage_key = (key.game_id, key.alt, key.col, key.row);
        let existed = state.map.exists.read(storage_key);
        state.map.tiles.write(storage_key, data);
        if !existed {
            state.map.exists.write(storage_key, true);
        }
        let mut keys = array![];
        key.serialize(ref keys);
        if !existed {
            emit(
                Event::RowSet(
                    RowSet { version: 1, model: 'TileOpt', keys: keys.span(), values: array![data.into()].span() },
                ),
            );
            return;
        }
        emit(
            Event::RowMemberSet(
                RowMemberSet {
                    version: 1, model: 'TileOpt', member: 'data', keys: keys.span(), values: array![data.into()].span(),
                },
            ),
        );
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
    use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess};
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
        fn biome(self: @ContractState, key: TileKey) -> u8 {
            crate::logic::map::biome(key)
        }
        fn discovery(
            self: @ContractState, key: TileKey, seed: u256, hyperstructures: u32, timestamp: u64,
        ) -> crate::discovery::Discovery {
            let rules = crate::logic::game::rules(key.game_id);
            let coord = Coord { alt: key.alt, x: key.col, y: key.row };
            if key.alt {
                let mut adjacent = false;
                for direction in 0_u8..6 {
                    let tile = crate::logic::map::tile(tile_key(key.game_id, spire_neighbor(coord, direction)));
                    if tile.map(|tile| (tile.data / 2) % BYTE_RANGE == 35).unwrap_or(false) {
                        adjacent = true;
                    }
                }
                crate::discovery::ethereal(
                    rules.map_config, rules.bitcoin_mine_config.enabled, adjacent, seed, timestamp,
                )
            } else {
                let center = Coord {
                    alt: false, x: 2147483646 - rules.map_center_offset, y: 2147483646 - rules.map_center_offset,
                };
                crate::discovery::surface(
                    rules.map_config, seed, timestamp, distance(coord, center), hyperstructures, rules.mode_rules,
                )
            }
        }

        fn reveal_structure_surroundings(ref self: ContractState, game_id: u32, coord: Coord) {
            for direction in 0_u8..6 {
                let key = tile_key(game_id, crate::geometry::neighbor(coord, direction));
                let data = crate::logic::map::tile(key).map(|tile| tile.data).unwrap_or(0);
                if data / BIOME_SCALE % BYTE_RANGE == 0 {
                    crate::logic::map::MapState::reveal(key, crate::logic::map::biome(key));
                }
            }
        }

        fn reveal_destination_tile(ref self: ContractState, key: TileKey) -> Option<TileOpt> {
            let stored = crate::logic::map::tile(key);
            if stored.map(|tile| tile.data / BIOME_SCALE % BYTE_RANGE != 0).unwrap_or(false) {
                return stored;
            }
            if crate::logic::game::rules(key.game_id).epoch_seconds == 0
                || !crate::expeditions::is_home_ring(
                    Coord { alt: key.alt, x: key.col, y: key.row },
                    crate::logic::settlement::rules(key.game_id).spacing,
                ) {
                return stored;
            }
            crate::logic::map::MapState::reveal(key, crate::logic::map::biome(key));
            crate::logic::map::tile(key)
        }

        fn expedition_home_ring(
            self: @ContractState, game_id: u32, realm_id: u16, timestamp: u64,
        ) -> Span<(Coord, u8)> {
            let rules = crate::logic::game::rules(game_id);
            assert!(rules.epoch_seconds != 0, "game has no expeditions");
            let site = crate::expeditions::site(
                crate::logic::game::game(game_id).start_main_at,
                rules.epoch_seconds,
                crate::logic::settlement::rules(game_id).spacing,
                realm_id,
                timestamp,
                0,
            );
            let mut ring = array![(site, crate::logic::map::biome(tile_key(game_id, site)))];
            for direction in 0_u8..6 {
                let coord = crate::geometry::neighbor(site, direction);
                ring.append((coord, crate::logic::map::biome(tile_key(game_id, coord))));
            }
            ring.span()
        }
    }
    #[abi(embed_v0)]
    impl Extraction of crate::exploration_rewards::IExtraction<ContractState> {
        fn configure_extraction(
            ref self: ContractState, game_id: u32, rewards: Span<crate::exploration_rewards::ExplorationReward>,
        ) {
            crate::logic::release::assert_authority();
            crate::logic::game::game(game_id);
            assert!(self.data.map_rules.exploration_reward_count.read(game_id) == 0, "immutable extraction rewards");
            assert!(!rewards.is_empty(), "empty exploration pool");
            let mut total: u128 = 0;
            for index in 0..rewards.len() {
                let reward = *rewards.at(index);
                assert!(reward.resource_type > 0 && reward.resource_type <= 58, "invalid reward resource");
                assert!(reward.amount <= reward.amount_max, "invalid exploration reward range");
                total += reward.weight;
                self.data.map_rules.exploration_rewards.write((game_id, index), reward);
            }
            assert!(total != 0, "empty exploration pool");
            self.data.map_rules.exploration_reward_count.write(game_id, rewards.len());
            let mut values = array![];
            rewards.serialize(ref values);
            self
                .emit(
                    crate::events::RowSet {
                        version: 1,
                        model: 'ExtractionRewards',
                        keys: array![game_id.into()].span(),
                        values: values.span(),
                    },
                );
        }
        fn extraction_rewards(
            self: @ContractState, game_id: u32,
        ) -> Span<crate::exploration_rewards::ExplorationReward> {
            let count = self.data.map_rules.exploration_reward_count.read(game_id);
            assert!(count != 0, "missing extraction rewards");
            let mut rewards = array![];
            for index in 0..count {
                rewards.append(self.data.map_rules.exploration_rewards.read((game_id, index)));
            }
            rewards.span()
        }
        fn extract_exploration_reward(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            explorer_id: u32,
            revealed: Option<Coord>,
            context: crate::commands::ExecutionContext,
        ) {
            let classes = self.release.classes(game_id);
            crate::commands::assert_context_time(context.timestamp);
            let game = crate::logic::game::game(game_id);
            crate::game::assert_playing(game, context.timestamp);
            let explorer = crate::logic::troops::authorized_explorer(
                crate::troops::ExplorerKey { game_id, explorer_id }, actor, context.timestamp,
            );
            assert!(!explorer.coord.alt, "extraction requires surface");
            assert!(explorer.troops.count != 0, "explorer is dead");
            let occupied = crate::logic::map::tile(tile_key(game_id, explorer.coord)).expect('unrevealed army tile');
            assert!(
                (occupied.data / crate::map::OCCUPIER_SCALE) % crate::map::ENTITY_RANGE == explorer_id.into(),
                "explorer does not occupy tile",
            );
            let rules = crate::logic::game::rules(game_id);
            let coord = if crate::rules::rule_enabled(rules, crate::rules::REVEAL_SUPPLIES) {
                match revealed {
                    Some(coord) => coord,
                    None => { return; },
                }
            } else {
                explorer.coord
            };
            let key = tile_key(game_id, coord);
            let tile = crate::logic::map::tile(key).expect('unrevealed extraction tile');
            assert!(tile.data / BIOME_SCALE % BYTE_RANGE != 0, "tile must be revealed");
            let mut root = context.raw_root;
            let seed = crate::random::game_root(ref root, game_id, game.seed);
            if tile.data / crate::map::REWARD_EXTRACTED_FLAG % 2 == 1 {
                return;
            }
            let reward = crate::exploration_rewards::draw(self.extraction_rewards(game_id), seed, context.timestamp);
            let multiplier = if crate::rules::rule_enabled(rules, crate::rules::DEPTH_CONTENTS) {
                crate::logic::expeditions::depth_rules_at(game_id, coord).supply_multiplier
            } else {
                1
            };
            let amount = crate::exploration_rewards::boosted_amount(
                reward.amount * multiplier.into(),
                explorer.troops.boosts,
                context.timestamp / rules.tick_config.armies_tick_in_seconds,
            );
            let receiver = crate::exploration_rewards::receiver(
                crate::rules::rule_enabled(rules, crate::rules::HOME_REWARDS),
                explorer_id,
                explorer.owner,
                reward.resource_type,
            );
            crate::exploration_rewards::IExplorationGrantDispatcherTrait::grant_exploration_reward(
                crate::exploration_rewards::IExplorationGrantLibraryDispatcher { class_hash: classes.resources.read() },
                crate::resources::ResourceKey { game_id, entity_id: receiver },
                reward.resource_type,
                amount,
                context.timestamp,
            );
            crate::logic::map::MapState::write_occupancy(key, tile.data + crate::map::REWARD_EXTRACTED_FLAG);
            if crate::rules::rule_enabled(rules, crate::rules::REVEAL_SUPPLIES)
                && crate::rules::rule_enabled(rules, crate::rules::DISCOVER_CHESTS)
                && tile.data % 2 == 0 {
                crate::relics::IRelicsDispatcherTrait::grant_reveal_chest(
                    crate::relics::IRelicsLibraryDispatcher { class_hash: classes.relics.read() },
                    game_id,
                    actor,
                    crate::relics::OpenChest { explorer_id, coord },
                    context,
                );
            }
            self
                .record_extraction(
                    game_id,
                    actor,
                    context.timestamp,
                    crate::exploration_rewards::ExtractedReward {
                        explorer_id, receiver, coord, resource_type: reward.resource_type, amount,
                    },
                );
        }
    }
    #[abi(embed_v0)]
    impl RelicMap of crate::relics::IRelicMap<ContractState> {
        #[cfg(test)]
        fn relic_discovery_time(self: @ContractState, game_id: u32) -> u64 {
            self.data.map_rules.last_relic_discovery.read(game_id)
        }
        fn discover_relic_chest(
            ref self: ContractState, game_id: u32, coord: Coord, excluded: Coord, seed: u256, timestamp: u64,
        ) {
            let classes = self.release.classes(game_id);
            crate::commands::assert_context_time(timestamp);
            let rules = crate::logic::game::rules(game_id);
            if !crate::rules::rule_enabled(rules, crate::rules::DISCOVER_CHESTS) || coord.alt {
                return;
            }
            if rules.epoch_seconds != 0
                && crate::relics::IRelicsDispatcherTrait::chest_rules(
                    crate::relics::IRelicsLibraryDispatcher { class_hash: classes.relics.read() }, game_id,
                )
                    .is_some() {
                return;
            }
            if self.data.map_rules.last_relic_discovery.read(game_id)
                + Into::<u16, u64>::into(rules.map_config.relic_discovery_interval_sec) > timestamp {
                return;
            }
            let mut destination = crate::relics::chest_destination(
                coord, seed, timestamp, rules.map_config.relic_hex_dist_from_center,
            );
            loop {
                let key = tile_key(game_id, destination);
                let data = crate::logic::map::tile(key).map(|tile| tile.data).unwrap_or(0);
                if destination != excluded
                    && destination != coord
                    && data % BIOME_SCALE == 0
                    && !crate::state::read().settlement_pool.reserved.read((game_id, destination.x, destination.y)) {
                    if data / BIOME_SCALE % BYTE_RANGE == 0 {
                        crate::logic::map::MapState::reveal(key, crate::logic::map::biome(key));
                    }
                    crate::logic::map::MapState::occupy(key, crate::logic::game::allocate_entity(game_id), 34, false);
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
        fn consume_relic_chest(ref self: ContractState, game_id: u32, coord: Coord) {
            let key = tile_key(game_id, coord);
            let tile = crate::logic::map::tile(key).expect('missing chest tile');
            assert!(tile.data % 2 == 0 && (tile.data / 2) % BYTE_RANGE == 34, "tile is not a relic chest");
            let id = ((tile.data / crate::map::OCCUPIER_SCALE) % crate::map::ENTITY_RANGE).try_into().unwrap();
            crate::logic::map::MapState::vacate(key, id);
        }
        fn reveal_relic_ring(ref self: ContractState, game_id: u32, coord: Coord, radius: u8) {
            assert!(radius == 1 || radius == 2, "invalid relic radius");
            for radius in 1_u32..Into::<u8, u32>::into(radius) + 1 {
                let mut next = crate::geometry::neighbor_at_distance(coord, 4, radius);
                for direction in 0_u8..6 {
                    for _ in 0..radius {
                        let key = tile_key(game_id, next);
                        let data = crate::logic::map::tile(key).map(|tile| tile.data).unwrap_or(0);
                        if data / BIOME_SCALE % BYTE_RANGE == 0 {
                            crate::logic::map::MapState::reveal(key, crate::logic::map::biome(key));
                        }
                        next = crate::geometry::neighbor(next, direction);
                    }
                }
            }
        }
    }
    #[generate_trait]
    impl Internal of InternalTrait {
        fn record_extraction(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            timestamp: u64,
            reward: crate::exploration_rewards::ExtractedReward,
        ) {
            self
                .emit(
                    crate::ownership::StoryEvent {
                        version: 1,
                        game_id,
                        id: crate::logic::game::allocate_entity(game_id),
                        entity_id: Some(reward.explorer_id),
                        owner: Some(actor),
                        timestamp,
                        tx_hash: starknet::get_tx_info().unbox().transaction_hash,
                        story: crate::ownership::Story::ExplorationReward(reward),
                    },
                );
        }
    }
}
