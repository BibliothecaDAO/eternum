use dojo::model::{Model, ModelStorage, ModelStorageTest};
use dojo::world::{WorldStorage, WorldStorageTrait};
use dojo_snf_test::{
    ContractDefTrait, NamespaceDef, TestResource, WorldStorageTestTrait, get_default_caller_address, spawn_test_world,
};
use snforge_std::{start_cheat_block_timestamp_global, start_cheat_caller_address};
use crate::constants::{DEFAULT_NS, DEFAULT_NS_STR};
use crate::models::game::{GameRegistry, GameStatus};
use crate::models::map::{TileImpl, TileOccupier};
use crate::models::map2::TileOpt;
use crate::models::position::{Coord, CoordTrait, Direction};
use crate::models::structure::Structure;
use crate::models::troop::{ExplorerTroops, TroopTier, TroopType, Troops};
use crate::systems::alt_movement::contracts::{IAltMovementSystemsDispatcher, IAltMovementSystemsDispatcherTrait};
use crate::systems::utils::map::IMapImpl;

fn setup(alt: bool, x: u32) -> (WorldStorage, IAltMovementSystemsDispatcher) {
    let namespace = NamespaceDef {
        namespace: DEFAULT_NS_STR(),
        resources: [
            TestResource::Model("GameRegistry"), TestResource::Model("WorldConfig"),
            TestResource::Model("PresetConfig"), TestResource::Model("ExplorerTroops"),
            TestResource::Model("Structure"), TestResource::Model("TileOpt"), TestResource::Event("StoryEvent"),
            TestResource::Contract("alt_movement_systems"), TestResource::Library(("biome_library", "0_1_13")),
        ]
            .span(),
    };
    let mut world = spawn_test_world([namespace].span());
    world
        .sync_perms_and_inits(
            [
                ContractDefTrait::new(DEFAULT_NS(), @"alt_movement_systems")
                    .with_writer_of([dojo::utils::bytearray_hash(DEFAULT_NS())].span()),
            ]
                .span(),
        );
    let caller = get_default_caller_address();
    world
        .write_model_test(
            @GameRegistry {
                game_id: 7,
                name: 'travel',
                series_id: 0,
                game_number_in_series: 0,
                preset_id: 1,
                creator: caller,
                status: GameStatus::Live,
                dev_mode_on: false,
                start_settling_at: 1,
                start_main_at: 2,
                end_at: 1000,
                end_grace_seconds: 0,
                registration_grace_seconds: 0,
                final_trial_id: 0,
                seed: 1,
            },
        );
    world.write_member(Model::<Structure>::ptr_from_keys((7_u32, 5_u32)), selector!("owner"), caller);
    world
        .write_model_test(
            @ExplorerTroops {
                game_id: 7,
                explorer_id: 9,
                owner: 5,
                coord: Coord { alt, x, y: 100 },
                troops: Troops {
                    category: TroopType::Knight,
                    tier: TroopTier::T1,
                    count: 1000000,
                    stamina: Default::default(),
                    boosts: Default::default(),
                    battle_cooldown_end: 0,
                },
            },
        );
    seed_tile(ref world, Coord { alt, x, y: 100 }, TileOccupier::ExplorerKnightT1Regular, 9);
    seed_tile(ref world, Coord { alt: false, x: 100, y: 100 }, TileOccupier::Spire, 11);
    seed_tile(ref world, Coord { alt: true, x: 100, y: 100 }, TileOccupier::Spire, 11);
    let (contract_address, _) = world.dns(@"alt_movement_systems").unwrap();
    start_cheat_caller_address(contract_address, caller);
    start_cheat_block_timestamp_global(10);
    (world, IAltMovementSystemsDispatcher { contract_address })
}

fn seed_tile(ref world: WorldStorage, coord: Coord, occupier: TileOccupier, id: u32) {
    let mut tile = TileImpl::keys_only(7, coord);
    tile.biome = 3;
    tile.occupier_type = occupier.into();
    tile.occupier_id = id;
    let packed: TileOpt = tile.into();
    world.write_model_test(@packed);
}

#[test]
fn spire_round_trip_preserves_coordinates_and_ethereal_stride() {
    let (world, travel) = setup(false, 99);
    travel.toggle_alternate(7, 9, Direction::East);
    let alternate: ExplorerTroops = world.read_model((7_u32, 9_u32));
    assert!(alternate.coord.alt && alternate.coord.x == 99 && alternate.coord.y == 100, "wrong arrival");
    assert!(alternate.coord.neighbor(Direction::East).x == 114, "ethereal stride changed");
    let landing: TileOpt = world.read_model((7_u32, true, 99_u32, 100_u32));
    let landing: crate::models::map::Tile = landing.into();
    assert!(landing.biome != 0, "arrival tile remains undiscovered");
    travel.toggle_alternate(7, 9, Direction::East);
    let returned: ExplorerTroops = world.read_model((7_u32, 9_u32));
    assert!(!returned.coord.alt && returned.coord.x == 99 && returned.coord.y == 100, "wrong return");
}

#[test]
#[should_panic(expected: "Eternum: destination tile is occupied")]
fn spire_travel_rejects_an_occupied_destination() {
    let (mut world, travel) = setup(false, 99);
    seed_tile(ref world, Coord { alt: true, x: 99, y: 100 }, TileOccupier::ExplorerKnightT1Regular, 12);
    travel.toggle_alternate(7, 9, Direction::East);
}

#[test]
#[should_panic(expected: "Eternum: explorer must be adjacent to spire")]
fn ethereal_stride_does_not_extend_spire_access() {
    let (_, travel) = setup(true, 85);
    travel.toggle_alternate(7, 9, Direction::East);
}

#[test]
fn cross_layer_combat_uses_the_same_spire_access_distance() {
    let (mut world, _) = setup(true, 99);
    assert!(
        IMapImpl::is_adjacent_to_spire(ref world, 7, Coord { alt: true, x: 99, y: 100 }), "ethereal access missing",
    );
    assert!(
        !IMapImpl::is_adjacent_to_spire(ref world, 7, Coord { alt: true, x: 85, y: 100 }),
        "spire access used travel stride",
    );
}
