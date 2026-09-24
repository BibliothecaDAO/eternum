#[starknet::contract]
pub mod PlacementLogic {
    use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess};
    use crate::geometry::{spire_neighbor, tile_key};
    use crate::logic::map::MapState;
    use crate::logic::release::ReleaseState;
    use crate::logic::settlement::SettlementPoolState;
    use crate::map::{BIOME_SCALE, BYTE_RANGE};
    use crate::settlement::SettlementPool;
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
    impl Spires of crate::spires::ISpires<ContractState> {
        fn initialize_spires(ref self: ContractState, game_id: u32, layout: crate::spires::SpireLayout) {
            crate::logic::release::assert_authority();
            assert!(
                crate::rules::rule_enabled(crate::logic::game::rules(game_id), crate::rules::SPIRES),
                "spires are disabled",
            );
            assert!(self.data.map_rules.spire_layouts.read(game_id).is_none(), "spires already initialized");
            crate::spires::validate(layout);
            let center = self.map_center(game_id);
            for ordinal in 0_u32..layout.count.into() {
                self.create_spire(game_id, crate::spires::location(center, layout, ordinal));
            }
            self.data.map_rules.spire_layouts.write(game_id, Some(layout));
            let mut values = array![];
            layout.serialize(ref values);
            self
                .emit(
                    crate::events::RowSet {
                        version: 1, model: 'SpireLayout', keys: array![game_id.into()].span(), values: values.span(),
                    },
                );
        }
        #[cfg(test)]
        fn spire_layout(self: @ContractState, game_id: u32) -> Option<crate::spires::SpireLayout> {
            self.data.map_rules.spire_layouts.read(game_id)
        }
    }
    #[abi(embed_v0)]
    impl SeasonPlacement of crate::realms::ISeasonPlacement<ContractState> {
        fn claim_season_settlement(ref self: ContractState, game_id: u32, settled_count: u16, seed: u256) -> Coord {
            let mut rules = crate::logic::settlement::rules(game_id);
            assert!(rules.mode == crate::settlement::SettlementMode::Single, "season settlement requires one realm");
            rules.registration_limit = 0xffff;
            let center = self.map_center(game_id);
            for _ in 0..64_u32 {
                let coords = self.settlements.claim(game_id, center, rules, settled_count, seed);
                let coord = *coords.at(0);
                let occupied = crate::logic::map::tile(tile_key(game_id, coord))
                    .map(|tile| (tile.data / 2) % BYTE_RANGE != 0)
                    .unwrap_or(false);
                if !occupied {
                    return coord;
                }
            }
            panic!("no vacant settlement in search limit")
        }
    }
    #[abi(embed_v0)]
    impl Settlements of crate::settlement::ISettlementPool<ContractState> {
        #[cfg(test)]
        fn reserved_hyperstructures(self: @ContractState, game_id: u32) -> u32 {
            self.settlements.data.settlement_pool.reserved_hyperstructures.read(game_id)
        }
        #[cfg(test)]
        fn settlement_pool(self: @ContractState, game_id: u32) -> SettlementPool {
            let rules = crate::logic::settlement::rules(game_id);
            let center = self.map_center(game_id);
            self.settlements.pool(game_id, center, rules)
        }
        fn village_pool(self: @ContractState, game_id: u32) -> SettlementPool {
            let rules = crate::logic::settlement::rules(game_id);
            self.settlements.village_pool(game_id, self.map_center(game_id), rules)
        }
        fn claim_village(ref self: ContractState, game_id: u32, registered: u16, seed: u256) -> Coord {
            let rules = crate::logic::settlement::rules(game_id);
            self.settlements.claim_village(game_id, self.map_center(game_id), rules, registered, seed)
        }
    }
    #[abi(embed_v0)]
    impl Reservations of crate::settlement::IBlitzReservations<ContractState> {
        fn initialize_reservations(ref self: ContractState, game_id: u32) {
            if self.settlements.data.settlement_pool.reserved_hyperstructures.read(game_id) != 0 {
                return;
            }
            let rules = crate::logic::settlement::rules(game_id);
            self.settlements.reserve_blitz_locations(game_id, self.map_center(game_id), rules);
            self.reserve_sites(game_id, 255, starknet::get_block_timestamp());
        }

        fn release_hyperstructure(ref self: ContractState, game_id: u32, coord: Coord) {
            crate::logic::map::MapState::release_hyperstructure(tile_key(game_id, coord));
        }
    }

    #[generate_trait]
    impl Internal of InternalTrait {
        fn reserve_sites(ref self: ContractState, game_id: u32, count: u8, timestamp: u64) {
            let game = crate::logic::game::game(game_id);
            let game_rules = crate::logic::game::rules(game_id);
            assert!(
                crate::rules::rule_enabled(game_rules, crate::rules::RESERVED_HYPERSTRUCTURES),
                "reserved hyperstructures disabled",
            );
            assert!(game.end_at == 0 || timestamp < game.end_at, "game ended");
            let rules = crate::logic::settlement::rules(game_id);
            let required = crate::settlement_grid::reservation_count(rules.registration_limit, rules.mode);
            let center = self.map_center(game_id);
            let mut placed = self.settlements.data.settlement_pool.reserved_hyperstructures.read(game_id);
            let last = core::cmp::min(required, placed + count.into());
            while placed < last {
                let coord = crate::settlement_grid::reservation_location(center, rules.mode, rules.spacing, placed);
                let key = tile_key(game_id, coord);
                let previous = crate::logic::map::tile(key).map(|tile| tile.data).unwrap_or(0);
                assert!(previous % BIOME_SCALE == 0, "occupied reservation tile");
                if previous / BIOME_SCALE % BYTE_RANGE == 0 {
                    crate::logic::map::MapState::reveal(key, crate::logic::map::biome(key));
                }
                crate::logic::map::MapState::reserve_hyperstructure(key);
                placed += 1;
            }
            if placed != self.settlements.data.settlement_pool.reserved_hyperstructures.read(game_id) {
                self.settlements.data.settlement_pool.reserved_hyperstructures.write(game_id, placed);
                self
                    .emit(
                        crate::events::RowSet {
                            version: 1,
                            model: 'HyperstructureReservations',
                            keys: array![game_id.into()].span(),
                            values: array![placed.into()].span(),
                        },
                    );
            }
        }

        fn create_spire(ref self: ContractState, game_id: u32, coord: Coord) -> u32 {
            for alt in array![false, true] {
                let tile = crate::logic::map::tile(tile_key(game_id, Coord { alt, ..coord }));
                assert!(tile.map(|value| (value.data / 2) % BYTE_RANGE == 0).unwrap_or(true), "spire tile occupied");
            }
            let id = crate::logic::game::allocate_entity(game_id);
            for alt in array![false, true] {
                let center = Coord { alt, ..coord };
                self.reveal_spire_access(game_id, center);
                crate::logic::map::MapState::occupy(tile_key(game_id, center), id, 35, true);
                for direction in 0_u8..6 {
                    self.reveal_spire_access(game_id, spire_neighbor(center, direction));
                }
            }
            id
        }
        fn reveal_spire_access(ref self: ContractState, game_id: u32, coord: Coord) {
            let key = tile_key(game_id, coord);
            let data = crate::logic::map::tile(key).map(|tile| tile.data).unwrap_or(0);
            if data / BIOME_SCALE % BYTE_RANGE == 0 {
                crate::logic::map::MapState::reveal(key, crate::logic::map::biome(key));
            }
        }

        fn map_center(self: @ContractState, game_id: u32) -> Coord {
            let rules = crate::logic::game::rules(game_id);
            let center = 2147483646 - rules.map_center_offset;
            Coord { alt: false, x: center, y: center }
        }
    }
}
