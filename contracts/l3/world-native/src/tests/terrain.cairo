use snforge_std::fs::{FileTrait, read_txt};
use snforge_std::{EventSpyTrait, EventsFilterTrait, interact_with_state};
use starknet::storage::StorageMapWriteAccess;
use crate::game::{IGameDispatcher, IGameDispatcherTrait};
use crate::guards::{GuardKey, IGuardsDispatcher, IGuardsDispatcherTrait};
use crate::map::{IMapLogicDispatcher, IMapLogicDispatcherTrait};
use crate::resources::{IResourceOperationsDispatcher, ResourceKey, ResourceSlot};
use crate::structures::IStructureOperationsDispatcher;
use crate::tests::registrar::muster_command;
use crate::tests::resource_commands::execute_in_game;
use crate::tests::state::{
    GameState, MapObservationTrait, ResourceObservationTrait, StructureObservationTrait, TroopObservationTrait,
};

#[test]
fn settlement_terrain_keeps_map_biomes_and_daily_home_rings() {
    let d = super::registrar::setup();
    let (game_id, preset, _) = super::registrar::expedition_home(d);
    let map = IMapLogicDispatcher { contract_address: d.games };
    let game = IGameDispatcher { contract_address: d.games }.game(game_id);
    for timestamp in array![350_u64, 450, 550] {
        let site = crate::expeditions::site(
            game.start_main_at, preset.rules.epoch_seconds, preset.settlement.spacing, 1, timestamp, 0,
        );
        let ring = map.expedition_home_ring(game_id, 1, timestamp);
        assert_eq!(ring.len(), 7);
        let (center, _) = *ring.at(0);
        assert_eq!(center, site);
        let context = crate::commands::BiomeContext {
            climate: preset.rules.biome_climate_config,
            epoch_seconds: preset.rules.epoch_seconds,
            start_main_at: game.start_main_at,
        };
        for index in 0_u32..7 {
            let (coord, biome) = *ring.at(index);
            if index != 0 {
                assert_eq!(coord, crate::geometry::neighbor(site, (index - 1).try_into().unwrap()));
            }
            let climate = crate::expeditions::climate(
                context.climate, coord, context.start_main_at, context.epoch_seconds, preset.settlement.spacing,
            );
            let expected: u8 = crate::biome::get_biome_with_climate(coord.alt, coord.x.into(), coord.y.into(), climate)
                .into();
            assert_eq!(biome, expected);
            assert_eq!(map.biome(crate::geometry::tile_key(game_id, coord), context), expected);
        }
        let ordinary = crate::commands::BiomeContext { epoch_seconds: 0, ..context };
        for alt in array![false, true] {
            let coord = crate::troops::Coord { alt, ..site };
            let expected: u8 = crate::biome::get_biome_with_climate(
                alt, coord.x.into(), coord.y.into(), ordinary.climate,
            )
                .into();
            assert_eq!(map.biome(crate::geometry::tile_key(game_id, coord), ordinary), expected);
        }
    }
}


#[test]
fn home_ring_materializes_once_each_day_and_all_six_deployments_work() {
    let d = super::registrar::setup();
    let (game_id, preset, category) = super::registrar::expedition_home(d);
    let map = IMapLogicDispatcher { contract_address: d.games };
    let game = IGameDispatcher { contract_address: d.games }.game(game_id);
    let home = ResourceKey { game_id, entity_id: 1 };
    let structures = IStructureOperationsDispatcher { contract_address: d.games };
    let state = GameState { contract_address: d.games };
    let context = crate::commands::BiomeContext {
        climate: preset.rules.biome_climate_config,
        epoch_seconds: preset.rules.epoch_seconds,
        start_main_at: game.start_main_at,
    };
    let mut serialized = array![1_felt252, 21];
    for timestamp in array![350_u64, 450, 550] {
        let ring = map.expedition_home_ring(game_id, 1, timestamp);
        let (center, _) = *ring.at(0);
        let mut spy = snforge_std::spy_events();
        let resources = IResourceOperationsDispatcher { contract_address: d.games };
        let before = ring_reward_balances(resources, game_id);
        interact_with_state(
            d.games,
            || {
                crate::logic::terrain::raise_expedition_home(crate::geometry::tile_key(game_id, center), context);
            },
        );
        assert_eq!(before, ring_reward_balances(resources, game_id));
        for (_, event) in spy.get_events().emitted_by(d.games).events {
            assert_eq!(*event.keys.at(0), selector!("RowSet"));
            assert_eq!(*event.keys.at(2), 'TileOpt');
        }
        // The complete ring exists before this day's first gameplay command, matching the public view.
        for (coord, biome) in ring {
            let key = crate::geometry::tile_key(game_id, *coord);
            let stored = map.tile(key).unwrap().data - crate::map::coordinate_bits(key);
            assert_eq!(
                stored, Into::<u8, u128>::into(*biome) * crate::map::BIOME_SCALE + crate::map::REWARD_EXTRACTED_FLAG,
            );
            serialized
                .append_span(
                    array![timestamp.into(), (*coord.x).into(), (*coord.y).into(), (*biome).into(), stored.into()]
                        .span(),
                );
        }
        let mut repeated = snforge_std::spy_events();
        interact_with_state(
            d.games,
            || {
                crate::logic::terrain::raise_expedition_home(crate::geometry::tile_key(game_id, center), context);
            },
        );
        assert_eq!(repeated.get_events().emitted_by(d.games).events.len(), 0);
        for direction in 0_u8..6 {
            let action_at = timestamp + 1 + Into::<u8, u64>::into(direction) * 2;
            assert!(execute_in_game(d, game_id, muster_command(category, direction), action_at, action_at));
            let id = *structures.home_armies(home).at(0);
            let explorer = state.resolved_explorer(crate::troops::ExplorerKey { game_id, explorer_id: id }).unwrap();
            assert_eq!(explorer.coord, crate::geometry::neighbor(center, direction));
            assert!(
                execute_in_game(
                    d,
                    game_id,
                    crate::commands::Command::ManageTroops(crate::troop_management::ManageTroops::RemoveExplorer(id)),
                    action_at + 1,
                    action_at + 1,
                ),
            );
        }
    }
    assert_eq!(serialized, read_txt(@FileTrait::new("tests/fixtures/frontier-home-ring-v1.txt")));
}

#[test]
fn deploy_refuses_a_missing_neighbour_after_the_ring_is_materialized() {
    let d = super::registrar::setup();
    let (game_id, _, category) = super::registrar::expedition_home(d);
    let map = IMapLogicDispatcher { contract_address: d.games };
    let ring = map.expedition_home_ring(game_id, 1, 350);
    let (coord, _) = *ring.at(1);
    let key = crate::geometry::tile_key(game_id, coord);
    interact_with_state(
        d.games,
        || {
            let state = crate::state::write();
            state.map.tiles.write((game_id, false, coord.x, coord.y), 0);
            state.map.exists.write((game_id, false, coord.x, coord.y), false);
        },
    );
    let resources = IResourceOperationsDispatcher { contract_address: d.games };
    let troops = ResourceSlot {
        game_id,
        entity_id: 1,
        resource_type: crate::troops::troop_resource(
            IGuardsDispatcher { contract_address: d.games }
                .guard(GuardKey { game_id, structure_id: 1, slot: 0 })
                .troops
                .category,
            0,
        ),
    };
    let before = resources.resource_balance(troops);
    assert!(!execute_in_game(d, game_id, muster_command(category, 0), 351, 351));
    assert_eq!(resources.resource_balance(troops), before);
    assert!(map.tile(key).is_none());
    assert_eq!(
        IStructureOperationsDispatcher { contract_address: d.games }
            .home_armies(ResourceKey { game_id, entity_id: 1 })
            .len(),
        0,
    );
}

fn ring_reward_balances(state: IResourceOperationsDispatcher, game_id: u32) -> Array<u128> {
    let mut balances = array![];
    for resource_type in array![crate::resources::LABOR, crate::resources::ESSENCE] {
        balances.append(state.resource_balance(ResourceSlot { game_id, entity_id: 1, resource_type }));
    }
    balances
}
