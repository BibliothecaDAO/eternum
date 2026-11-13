#[starknet::contract]
pub mod RaidLogic {
    use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess};
    use crate::events::RowSet;
    use crate::geometry::tile_key;
    use crate::logic::release::ReleaseState;
    use crate::map::{BIOME_SCALE, BYTE_RANGE};
    use crate::troops::Coord;

    component!(path: ReleaseState, storage: release, event: ReleaseEvent);
    impl LifeInternal = ReleaseState::InternalImpl<ContractState>;
    #[storage]
    #[allow(starknet::colliding_storage_paths)]
    struct Storage {
        #[substorage(v0)]
        release: ReleaseState::Storage,
        #[flat]
        data: crate::state::Storage,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        ReleaseEvent: ReleaseState::Event,
        BattleEvent: crate::troops::BattleEvent,
        OwnershipRow: crate::events::RowSet,
        RowSet: RowSet,
        MapEvent: crate::logic::map::MapState::Event,
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
                    Event::RowSet(
                        crate::events::RowSet {
                            version: 1,
                            model: 'RelicDiscovery',
                            keys: array![game_id.into()].span(),
                            values: array![timestamp.into()].span(),
                        },
                    ),
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
        fn reveal_relic_tiles(
            ref self: ContractState, game_id: u32, coord: Coord, count: u8, game_context: crate::commands::BiomeContext,
        ) {
            crate::logic::army_relics::reveal_tiles(game_id, coord, count, game_context);
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
}
