pub fn biome(key: TileKey, game_context: crate::commands::BiomeContext) -> u8 {
    if crate::logic::deep::contains(key.game_id, crate::troops::Coord { alt: key.alt, x: key.col, y: key.row }) {
        return crate::biome::Biome::Underground.into();
    }
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
        class_hash: state.releases.entry(release).classes.movement.read(),
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
    let entity_id =
        match crate::logic::deep_guards::entry(
            crate::troops::ExplorerKey { game_id: key.game_id, explorer_id: key.entity_id },
        ) {
        Some(guard) => guard.site_id.read(),
        None => key.entity_id,
    };
    crate::map::position_from_bits(state.map.entity_tiles.read((key.game_id, entity_id)))
}

pub fn tile(key: TileKey) -> Option<TileOpt> {
    let state = crate::state::read();
    let storage_key = (key.game_id, key.alt, key.col, key.row);
    let occupier = occupancy(key);
    let terrain = if crate::logic::deep::contains(
        key.game_id, crate::troops::Coord { alt: key.alt, x: key.col, y: key.row },
    ) {
        Into::<u8, u128>::into(crate::biome::Biome::Underground.into()) * crate::map::BIOME_SCALE
    } else {
        state.map.tiles.read(storage_key)
    };
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
    use crate::geometry::{distance, spire_neighbor, tile_key};
    use crate::logic::map::MapState;
    use crate::logic::release::ReleaseState;
    use crate::map::{BIOME_SCALE, BYTE_RANGE, TileKey, TileOpt};
    use crate::troops::Coord;
    component!(path: ReleaseState, storage: release, event: ReleaseEvent);
    impl LifeInternal = ReleaseState::InternalImpl<ContractState>;

    #[storage]
    #[allow(starknet::colliding_storage_paths)]
    struct Storage {
        #[flat]
        pub data: crate::state::Storage,
        #[substorage(v0)]
        release: ReleaseState::Storage,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        ReleaseEvent: ReleaseState::Event,
        MapEvent: MapState::Event,
        RowSet: crate::events::RowSet,
        StoryEvent: crate::ownership::StoryEvent,
    }

    #[abi(embed_v0)]
    impl PresetStructures of crate::presets::IPresetStructures<ContractState> {
        fn store_structure_preset(
            ref self: ContractState, commitment: felt252, structures: crate::presets::StructurePreset,
        ) {
            crate::logic::preset_record::store_structures(commitment, structures);
        }
    }
    #[abi(embed_v0)]
    impl RuinEntitlements of crate::logic::ruins::IRuinEntitlements<ContractState> {
        fn ruin_disappeared(self: @ContractState, key: crate::resources::ResourceKey) -> bool {
            crate::logic::ruins::disappeared(key)
        }
        fn ruin_cleared_at(self: @ContractState, key: crate::expeditions::ExpeditionDiscoveryKey, depth: u8) -> bool {
            crate::logic::ruins::cleared_at(key, depth)
        }
        fn cache_ruin_depths(ref self: ContractState, key: crate::expeditions::ExpeditionDiscoveryKey) {
            crate::logic::ruins::cache(key);
        }
        fn close_ruins(ref self: ContractState, key: crate::expeditions::ExpeditionDiscoveryKey, depth: u8) {
            crate::logic::ruins::close(key, depth);
        }
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
}
