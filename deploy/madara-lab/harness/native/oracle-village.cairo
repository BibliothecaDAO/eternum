use world_native::settlement::SettlementMode;
use world_native::village::{IVillagesDispatcher, IVillagesDispatcherTrait, SettleVillage};
use crate::models::position::Direction;
use crate::models::structure::StructureVillageSlots;
use crate::systems::utils::village::iVillageResourceImpl;
use crate::systems::village::contracts::{IVillageSystemsSafeDispatcher, IVillageSystemsSafeDispatcherTrait};
use super::*;

#[feature("safe_dispatcher")]
pub fn village() {
    let mut worlds = super::settlement::configure_entry(
        setup_timed_world('village', false, true, 1700, 1700, 3000), SettlementMode::Single, false, false,
    );
    let config = crate::native_inputs::village_rules();
    assert_resource_pool(config.resource_pool);
    start_cheat_caller_address(worlds.peers.settlement, authority());
    IVillagesDispatcher { contract_address: worlds.peers.settlement }.configure_villages(1, config);
    stop_cheat_caller_address(worlds.peers.settlement);
    let root = 19_u256;
    let mut raw = root;
    let seed = world_native::random::game_root(ref raw, 1, 1);
    // Two pending realm entries reserve candidates 0 and 1 before the first six village candidates.
    let candidate: u32 = (2 + world_native::random::range(seed, 98139, 6)).try_into().unwrap();
    let center = world_native::troops::Coord { alt: false, x: 2147483626, y: 2147483626 };
    let target = *world_native::settlement_grid::settlement_location(center, SettlementMode::Single, 1, candidate)
        .at(0);
    let connected_coord: Coord = convert(world_native::geometry::neighbor_at_distance(target, 3, 2));
    let connected = provision_with_resources(ref worlds, connected_coord, array![].span());
    worlds
        .oracle
        .write_model_test(
            @StructureVillageSlots {
                game_id: 1,
                connected_realm_entity_id: connected,
                connected_realm_id: 0,
                connected_realm_coord: connected_coord,
                directions_left: array![
                    Direction::East, Direction::NorthEast, Direction::NorthWest, Direction::West, Direction::SouthWest,
                    Direction::SouthEast,
                ]
                    .span(),
            },
        );
    let (address, _) = worlds.oracle.dns(@"village_systems").unwrap();
    let original = IVillageSystemsSafeDispatcher { contract_address: address };
    start_cheat_block_timestamp_global(1800);
    let tx_hash = inject_root(worlds, root.try_into().unwrap());
    start_cheat_caller_address(address, worlds.actor);
    let village_id = original.create(1, 0, connected, Direction::East).unwrap();
    stop_cheat_caller_address(address);
    assert_root_consumed(worlds, tx_hash, root.try_into().unwrap(), 1);
    let before = super::settlement::surrounding_tiles(worlds, target, 1);
    let (order, succeeded) = execute_outcome(
        worlds,
        Command::SettleVillage(
            SettleVillage {
                owner: super::settlement::entry_owner(worlds), pass_id: 0, connected_realm_entity_id: connected,
            },
        ),
        1800,
        root,
    );
    assert!(succeeded);
    println!("FACT_ACTION {} {} {} {} {}", worlds.case, order, 'create', 1800, succeeded);
    super::settlement::assert_surroundings_unchanged(worlds, before);
    compare_home(worlds, 1, connected);
    compare_village(worlds, 1, village_id, target);
    for (expected, timestamp) in array![(true, 1860_u64), (false, 1920)].span() {
        army(worlds, original, village_id, target, *timestamp, *expected);
    }
    army(
        PairedWorld { actor: worlds.opponent, opponent: worlds.actor, ..worlds },
        original,
        village_id,
        target,
        1980,
        false,
    );
}

fn compare_village(worlds: PairedWorld, step: u32, village_id: u32, coord: world_native::troops::Coord) {
    compare_home(worlds, step, village_id);
    super::settlement::compare_realm_buildings(worlds, step, village_id, coord);
    compare_tile(worlds, step, coord);
}

#[feature("safe_dispatcher")]
fn army(
    worlds: PairedWorld,
    original: IVillageSystemsSafeDispatcher,
    village_id: u32,
    coord: world_native::troops::Coord,
    timestamp: u64,
    expected: bool,
) {
    start_cheat_block_timestamp_global(timestamp);
    start_cheat_caller_address(original.contract_address, worlds.actor);
    let oracle = original.receive_army_grant(1, village_id).is_ok();
    stop_cheat_caller_address(original.contract_address);
    let (order, native) = execute_outcome(worlds, Command::ReceiveVillageArmy(village_id), timestamp, 0);
    assert!(native == oracle && native == expected, "village army outcome differs");
    println!("FACT_ACTION {} {} {} {} {}", worlds.case, order, 'receive_army_grant', timestamp, native);
    compare_village(worlds, order.try_into().unwrap(), village_id, coord);
}

pub fn resource_draws() {
    let pool = crate::native_inputs::village_rules().resource_pool;
    assert_resource_pool(pool);
    let weights = iVillageResourceImpl::resource_probabilities().span();
    for timestamp in array![0_u64, 1800, 9999999] {
        start_cheat_block_timestamp_global(timestamp);
        for seed in 0_u64..128 {
            let original = crate::utils::random::choices(
                iVillageResourceImpl::resources().span(), weights, array![].span(), 1, true, seed.into(),
            );
            let native = world_native::village::select_resource(pool, seed.into(), timestamp);
            assert!(native == *original.at(0), "village resource draw differs");
        }
    }
}

fn assert_resource_pool(pool: Span<world_native::village::VillageResource>) {
    let resources = iVillageResourceImpl::resources();
    let weights = iVillageResourceImpl::resource_probabilities();
    assert!(pool.len() == resources.len());
    for index in 0..pool.len() {
        assert!(*pool.at(index).resource_type == *resources.at(index), "village resource order differs");
        assert!(*pool.at(index).weight == *weights.at(index), "village resource weight differs");
    }
}
