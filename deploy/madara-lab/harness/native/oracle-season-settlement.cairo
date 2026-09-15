use world_native::realms::{ISeasonRealmsDispatcher, ISeasonRealmsDispatcherTrait, SettleSeason};
use world_native::settlement::{
    EntryEntitlement, EntryKey, ISettlementEntryDispatcher, ISettlementEntryDispatcherTrait, ISettlementViewsDispatcher,
    ISettlementViewsDispatcherTrait, SettlementMode,
};
use crate::models::realm_allocation::{RealmAllocationImpl, RealmAllocationPool};
use super::*;

fn setup_season(case: felt252, development: bool, ledger: bool) -> PairedWorld {
    configure_season(setup_timed_world(case, false, development, 1700, 1700, 3000), ledger, SettlementMode::Single)
}

fn configure_season(worlds: PairedWorld, ledger: bool, mode: SettlementMode) -> PairedWorld {
    let mut worlds = super::settlement::configure_entry(worlds, mode, false, ledger);
    let authentication = ISeasonDispatcher { contract_address: worlds.peers.season }.authentication();
    worlds
        .oracle
        .write_member(
            Model::<crate::models::config::ChainConfig>::ptr_from_keys(crate::constants::WORLD_CONFIG_ID),
            selector!("player_registry_address"),
            authentication.registry,
        );
    // Deployment data is seeded outside gameplay; initialization has its own event and resume gates.
    let records = crate::native_inputs::canonical_realm_traits();
    for index in 0..records.len() {
        set_native_fixture(
            worlds.peers.season, selector!("traits"), array![(index + 1).into()].span(), *records.at(index),
        );
    }
    set_native_fixture(worlds.peers.season, selector!("catalogue_count"), array![].span(), 8000_u32);
    worlds
}

fn command(worlds: PairedWorld, selected_realm: Option<u32>) -> SettleSeason {
    let admission = ISettlementEntryDispatcher { contract_address: worlds.peers.season }
        .settlement_admission(1, worlds.actor);
    SettleSeason { name: 'season settler', owner: admission.owner, selected_realm }
}

fn settle_pair(worlds: PairedWorld, command: SettleSeason, timestamp: u64, root: felt252, step: u32, expected: bool) {
    let (address, _) = worlds.oracle.dns(@"realm_systems").unwrap();
    let attempts = IParityAttemptsDispatcher { contract_address: deploy("ParityAttempts", @array![]) };
    start_cheat_block_timestamp_global(timestamp);
    let tx_hash = inject_root(worlds, root);
    start_cheat_caller_address(address, worlds.actor);
    let original = attempts.settle_season(address, command.name, command.selected_realm);
    stop_cheat_caller_address(address);
    let (order, native) = execute_outcome(worlds, Command::SettleSeason(command), timestamp, root.into());
    assert!(native == original && native == expected, "season settlement outcome differs at {}", step);
    if original {
        assert_root_consumed(worlds, tx_hash, root, step);
    } else {
        assert!(IParityRootsDispatcher { contract_address: worlds.roots }.consumed() == 0);
    }
    let action = if command.selected_realm.is_some() {
        'settle_dev'
    } else {
        'settle'
    };
    println!("FACT_ACTION {} {} {} {} {}", worlds.case, order, action, timestamp, native);
    compare_settlement(worlds, step);
}

fn compare_settlement(worlds: PairedWorld, step: u32) {
    super::settlement::compare_blitz_entry(worlds, step);
    compare_name(worlds, step, worlds.actor);
    let settled: crate::models::config::BlitzSettlement = ModelStorage::read_model(@worlds.oracle, (1, worlds.actor));
    let realms = ISeasonRealmsDispatcher { contract_address: worlds.peers.season };
    for id in settled.structure_ids {
        compare_home(worlds, step, *id);
        let structure: Structure = ModelStorage::read_model(@worlds.oracle, (1, *id));
        let coord = world_native::troops::Coord { alt: false, x: structure.base.coord_x, y: structure.base.coord_y };
        super::settlement::compare_realm_buildings(worlds, step, *id, coord);
        compare_tile(worlds, step, coord);
        for direction in 0_u8..6 {
            let adjacent = world_native::geometry::neighbor(coord, direction);
            compare_tile(worlds, step, adjacent);
            compare_tile(worlds, step, world_native::geometry::neighbor(adjacent, direction));
        }
    }
    let original_remaining = crate::models::realm_allocation::RealmAllocationImpl::remaining(worlds.oracle, 1);
    let progress = ISettlementViewsDispatcher { contract_address: worlds.peers.season }.settlement_progress(1);
    assert!(8000 - progress.realm_count.into() == original_remaining);
    // Compare subsequent draw outcomes over the full pool; internal permutation slots are not player facts.
    for seed in array![0_u256, 1, 2, 3, 71419, 1234, 5678, 0xffffffffffffffffffffffffffffffff] {
        let index: u32 = world_native::random::range(seed, 71419, original_remaining.into()).try_into().unwrap();
        assert!(
            realms
                .available_realm(
                    1, index,
                ) == crate::models::realm_allocation::RealmAllocationImpl::at(worlds.oracle, 1, index),
        );
    }
}

pub fn settlement() {
    let worlds = setup_season('season_settlement', false, false);
    settle_pair(worlds, command(worlds, Option::None), 1800, 1234, 1, true);
    let other = PairedWorld { actor: worlds.opponent, opponent: worlds.actor, ..worlds };
    settle_pair(other, command(other, Option::None), 1860, 5678, 2, true);
    settle_pair(worlds, command(worlds, Option::None), 1920, 4321, 3, false);
}

pub fn development() {
    let worlds = setup_season('season_settlement_dev', true, true);
    let mut step = 1;
    for (id, expected) in array![(1_u32, true), (87, true), (87, false), (0, false), (8001, false)].span() {
        settle_pair(worlds, command(worlds, Option::Some(*id)), 1800, 1234, step, *expected);
        step += 1;
    }
    settle_pair(worlds, command(worlds, Option::None), 1800, 1234, step, false);
}

fn register(ref worlds: PairedWorld, realm_id: u256, pass_kind: u8, metadata: felt252) {
    let owner = command(worlds, Option::None).owner;
    worlds
        .oracle
        .write_model_test(
            @crate::models::ledger::LedgerRegistration {
                game_id: 1, owner, realm_id, metadata: (metadata, 0, 0), pass_kind, registered: true,
            },
        );
    start_cheat_caller_address(worlds.peers.season, authority());
    ISettlementEntryDispatcher { contract_address: worlds.peers.season }
        .register_entitlement(
            EntryKey { game_id: 1, owner },
            EntryEntitlement { realm_id, metadata_1: metadata, metadata_2: 0, metadata_3: 0, pass_kind },
        );
    stop_cheat_caller_address(worlds.peers.season);
}

fn metadata(order: u8, resources: Span<u8>) -> felt252 {
    let mut attrs = array![1_u8, 2, 3, 4];
    attrs.append_span(resources);
    attrs.append(order);
    attrs.append(1);
    let mut scale = 65536_u256;
    let mut value: u256 = attrs.len().into();
    for attr in attrs {
        value += scale * attr.into();
        scale *= 256;
    }
    value.try_into().unwrap()
}

pub fn ledger() {
    let mut worlds = setup_season('season_settlement_ledger', false, true);
    settle_pair(worlds, command(worlds, Option::None), 1800, 12, 1, false);
    register(ref worlds, 7, 1, metadata(3, array![2, 4, 7].span()));
    settle_pair(worlds, command(worlds, Option::None), 1800, 12, 2, true);
    let mut other = PairedWorld { actor: worlds.opponent, opponent: worlds.actor, ..worlds };
    register(ref other, 7, 1, metadata(3, array![2, 4, 7].span()));
    settle_pair(other, command(other, Option::None), 1800, 12, 3, false);
}

pub fn invalid_ledger(case: felt252, pass: u8, order: u8, empty: bool) {
    let mut worlds = setup_season(case, false, true);
    let resources = if empty {
        array![].span()
    } else {
        array![2_u8].span()
    };
    register(ref worlds, 9, pass, metadata(order, resources));
    settle_pair(worlds, command(worlds, Option::None), 1800, 12, 1, false);
}

pub fn rejections() {
    let worlds = setup_season('season_settlement_rejections', false, false);
    let action = command(worlds, Option::None);
    settle_pair(worlds, SettleSeason { name: 0, ..action }, 1800, 12, 1, false);
    settle_pair(worlds, action, 1699, 12, 2, false);
    settle_pair(worlds, action, 3000, 12, 3, false);
    settle_pair(worlds, command(worlds, Option::Some(1)), 1800, 12, 4, false);
}

pub fn wrong_mode() {
    let worlds = configure_season(setup_world('season_wrong_mode', true, false), false, SettlementMode::Single);
    settle_pair(worlds, command(worlds, Option::None), 1800, 12, 1, false);
}

pub fn wrong_planner(case: felt252, mode: SettlementMode) {
    let worlds = configure_season(setup_timed_world(case, false, false, 1700, 1700, 3000), false, mode);
    settle_pair(worlds, command(worlds, Option::None), 1800, 12, 1, false);
}

pub fn before_main() {
    let worlds = configure_season(
        setup_timed_world('season_pre_main', false, false, 1700, 2000, 3000), false, SettlementMode::Single,
    );
    settle_pair(worlds, command(worlds, Option::None), 1700, 13, 1, true);
}

pub fn occupied_candidates(case: felt252, count: u32, expected: bool) {
    let mut worlds = setup_season(case, true, false);
    let center = world_native::troops::Coord { alt: false, x: 2147483626, y: 2147483626 };
    let mut obstacles = array![];
    for index in 0..count {
        let coord = *world_native::settlement_grid::settlement_location(center, SettlementMode::Single, 1, index).at(0);
        let id = provision_with_resources(ref worlds, convert(coord), array![].span());
        obstacles.append((id, coord));
    }
    settle_pair(worlds, command(worlds, Option::None), 1800, 19, 1, expected);
    for (id, coord) in obstacles {
        compare_home(worlds, 1, id);
        compare_tile(worlds, 1, coord);
    }
}


pub fn search_limit() {
    let mut worlds = setup_season('season_search_limit', true, false);
    let center = world_native::troops::Coord { alt: false, x: 2147483626, y: 2147483626 };
    let mut positions = array![];
    // The rejection reads occupancy only; full-structure collisions have their own paired case.
    for index in 0..70_u32 {
        let coord = *world_native::settlement_grid::settlement_location(center, SettlementMode::Single, 1, index).at(0);
        let key = world_native::geometry::tile_key(1, coord);
        let biome = IMapDispatcher { contract_address: worlds.peers.map }.biome(key);
        let tile = crate::models::map::Tile {
            biome,
            occupier_id: index + 1,
            occupier_type: 1,
            occupier_is_structure: true,
            ..crate::models::map::TileImpl::keys_only(1, convert(coord)),
        };
        let tile: TileOpt = tile.into();
        worlds.oracle.write_model_test(@tile);
        let keys = array![1, 0, coord.x.into(), coord.y.into()].span();
        set_native_fixture(worlds.peers.map, selector!("tiles"), keys, tile.data);
        set_native_fixture(worlds.peers.map, selector!("exists"), keys, true);
        positions.append(coord);
    }
    settle_pair(worlds, command(worlds, Option::None), 1800, 19, 1, false);
    for coord in positions {
        compare_tile(worlds, 1, coord);
    }
}

pub fn explorer_occupied() {
    let mut worlds = setup_season('season_explorer_occupied', true, false);
    let mut root = 19_u256;
    let seed = world_native::random::game_root(ref root, 1, 1);
    let count = world_native::settlement_grid::target_pool_size(0, 0xffff, SettlementMode::Single);
    let candidate: u32 = world_native::random::range(seed, 98139, count.into()).try_into().unwrap();
    let center = world_native::troops::Coord { alt: false, x: 2147483626, y: 2147483626 };
    let coord = *world_native::settlement_grid::settlement_location(center, SettlementMode::Single, 1, candidate).at(0);
    let home = provision(ref worlds, convert(world_native::geometry::neighbor(coord, 3)));
    let explorer_id = create_explorer_pair(worlds, home);
    let original = ITroopsDispatcher { contract_address: worlds.peers.troops }
        .explorer(ExplorerKey { game_id: 1, explorer_id })
        .unwrap();
    assert!(original.coord == coord, "blocking fixture missed selected candidate");
    settle_pair(worlds, command(worlds, Option::None), 1800, 19, 200, true);
    let after = compare_explorer(worlds, 200, explorer_id);
    assert!(after == original, "season settlement must skip an explorer without displacing it");
    compare_home(worlds, 200, home);
    compare_tile(worlds, 200, coord);
}

pub fn canonical_traits() {
    let records = crate::native_inputs::canonical_realm_traits();
    assert!(records.len() == 8000);
    for index in 0..records.len() {
        let native = world_native::realms::decode_traits(*records.at(index));
        let (wonder, order, resources) = crate::systems::utils::realm_metadata::realm_attributes(index + 1);
        assert!(
            native.observe() == OracleRealmTraits { wonder, order, resources: resources.span() }.observe(),
            "canonical realm {} differs",
            index + 1,
        );
    }
}


#[starknet::interface]
trait IAllocationFixture<T> {
    fn reserve(ref self: T, game: u32, id: u32, settled: u16);
    fn available(self: @T, game: u32, index: u32, settled: u16) -> u32;
}
#[starknet::contract]
mod AllocationFixture {
    use world_native::realms::RealmState;
    component!(path: RealmState, storage: realms, event: RealmEvent);
    impl Internal = RealmState::InternalImpl<ContractState>;
    #[storage]
    struct Storage {
        #[substorage(v0)]
        realms: RealmState::Storage,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        #[flat]
        RealmEvent: RealmState::Event,
    }
    #[abi(embed_v0)]
    impl Fixture of super::IAllocationFixture<ContractState> {
        fn reserve(ref self: ContractState, game: u32, id: u32, settled: u16) {
            self.realms.reserve(game, id, settled);
        }
        fn available(self: @ContractState, game: u32, index: u32, settled: u16) -> u32 {
            self.realms.available(game, index, settled)
        }
    }
}

#[feature("safe_dispatcher")]
pub fn allocation() {
    let mut world = spawn_test_world(
        [
            NamespaceDef {
                namespace: DEFAULT_NS_STR(),
                resources: [
                    TestResource::Model("RealmAllocation"), TestResource::Model("RealmAllocationPool"),
                    TestResource::Model("RealmAllocationSlot"),
                ]
                    .span(),
            }
        ]
            .span(),
    );
    let native = IAllocationFixtureDispatcher { contract_address: deploy("AllocationFixture", @array![]) };
    let player = 123.try_into().unwrap();
    // Seed the same three remaining ids at the exhaustion boundary in both representations.
    world.write_model_test(@RealmAllocationPool { game_id: 1, initialized: true, remaining: 3 });
    let mut settled = 7997_u16;
    for id in array![2_u32, 3, 1] {
        RealmAllocationImpl::reserve(ref world, 1, id, player);
        native.reserve(1, id, settled);
        settled += 1;
        let remaining = RealmAllocationImpl::remaining(world, 1);
        assert!(remaining == 8000 - settled.into());
        for index in 0..remaining {
            assert!(native.available(1, index, settled) == RealmAllocationImpl::at(world, 1, index));
        }
    }
    assert!(
        IAllocationFixtureSafeDispatcher { contract_address: native.contract_address }
            .available(1, 0, settled)
            .is_err(),
    );
    assert!(native.available(2, 7999, 0) == RealmAllocationImpl::at(world, 2, 7999));
}
