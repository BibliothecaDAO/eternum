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

#[cfg(feature: "blitz")]
pub fn raise_destination(_key: TileKey, _context: crate::commands::BiomeContext) -> bool {
    false
}

#[cfg(not(feature: "blitz"))]
pub fn raise_destination(key: TileKey, context: crate::commands::BiomeContext) -> bool {
    if !crate::expeditions::is_home_ring(
        crate::troops::Coord { alt: key.alt, x: key.col, y: key.row }, crate::logic::settlement::spacing(),
    ) {
        return false;
    }
    raise_expedition_home(key, context);
    true
}

pub fn raise_expedition_home(key: TileKey, context: crate::commands::BiomeContext) {
    crate::settlement::ITerrainDerivationDispatcherTrait::raise_expedition_home(terrain(key.game_id), key, context);
}

fn terrain(game_id: u32) -> crate::settlement::ITerrainDerivationLibraryDispatcher {
    let state = crate::state::read();
    let release = state.game_releases.read(game_id);
    assert!(release != 0, "game has no release");
    crate::settlement::ITerrainDerivationLibraryDispatcher {
        class_hash: crate::logic::release::release_class(release, crate::slots::SETTLEMENT),
    }
}
use starknet::storage::{StorageMapReadAccess, StoragePointerReadAccess};
use crate::map::{TileKey, TileOpt};

pub fn occupancy(key: TileKey) -> Option<crate::map::TileOccupancy> {
    let state = crate::state::read();
    crate::map::occupancy_from_bits(state.map.occupancy.read((key.game_id, key.alt, key.col, key.row)))
}

pub fn entity_coord(key: crate::resources::ResourceKey) -> Option<crate::troops::Coord> {
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
    use crate::logic::deep_sites::DeepSites;
    component!(path: DeepSites, storage: deep_sites, event: DeepSiteEvent);
    #[abi(embed_v0)]
    impl DiscoveryGuards of crate::guards::IGuardInitialization<ContractState> {
        fn initialize_structure_guards(
            ref self: ContractState,
            key: crate::resources::ResourceKey,
            seed: u256,
            timestamp: u64,
            rules: crate::rules::SliceRules,
        ) {
            let base = crate::logic::structures::record(key).base;
            let category = base.category;
            // Every guarded structure an expedition discovers is a site whose guard follows its kind and depth.
            assert!(crate::expeditions::is_site_category(category), "invalid guarded structure category");
            let guards = {
                let depth = crate::logic::expeditions::depth_rules_at(
                    key.game_id, crate::structures::structure_coord(key),
                );
                let guard = if category == crate::taxonomy::RUIN_CATEGORY {
                    let relic = crate::logic::army_relics::ruin(key).expect('missing ruin relic');
                    let layer = crate::logic::expeditions::depth_at(
                        key.game_id, crate::structures::structure_coord(key),
                    );
                    crate::troops::ruin_guard(relic, layer, seed, rules, timestamp)
                } else {
                    crate::troops::frontier_guard(category, depth, seed, rules, timestamp)
                };
                array![guard].span()
            };
            assert!(base.troop_max_guard_count <= 4, "invalid guard slot limit");
            assert!(guards.len() <= base.troop_max_guard_count.into(), "guards exceed structure limit");
            for slot in 0..guards.len() {
                let troops = *guards.at(slot);
                let slot: u8 = slot.try_into().unwrap();
                let guard_key = crate::guards::GuardKey { game_id: key.game_id, structure_id: key.entity_id, slot };
                assert!(crate::logic::guards::guard(guard_key) == Default::default(), "guards already initialized");
                crate::logic::guards::GuardState::save(guard_key, crate::guards::Guard { troops, destroyed_tick: 0 });
            }
            crate::logic::expeditions::create_site(key, guards);
        }
    }
    #[abi(embed_v0)]
    impl Sites = DeepSites::DeepSitesImpl<ContractState>;
    use crate::geometry::tile_key;
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
        #[substorage(v0)]
        deep_sites: DeepSites::Storage,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        ReleaseEvent: ReleaseState::Event,
        DeepSiteEvent: DeepSites::Event,
        MapEvent: MapState::Event,
        RowSet: crate::events::RowSet,
        StoryEvent: crate::ownership::StoryEvent,
    }

    #[abi(embed_v0)]
    impl Map of crate::map::IMapLogic<ContractState> {
        fn biome(self: @ContractState, key: TileKey, game_context: crate::commands::BiomeContext) -> u8 {
            crate::logic::map::biome(key, game_context)
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
            if !crate::logic::map::raise_destination(key, game_context) {
                return stored;
            }
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
