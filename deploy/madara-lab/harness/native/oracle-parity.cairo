use dojo::model::{Model, ModelStorage, ModelStorageTest};
use dojo::world::{IWorldDispatcherTrait, WorldStorage, WorldStorageTrait};
use dojo_snf_test::{ContractDefTrait, NamespaceDef, TestResource, WorldStorageTestTrait, spawn_test_world};
use snforge_std::signature::stark_curve::{StarkCurveKeyPair, StarkCurveKeyPairImpl, StarkCurveSignerImpl};
use snforge_std::signature::{KeyPairTrait, SignerTrait};
use snforge_std::{
    CheatSpan, ContractClassTrait, DeclareResultTrait, EventSpyTrait, cheat_caller_address, declare, spy_events,
    start_cheat_block_timestamp_global, start_cheat_caller_address, start_cheat_chain_id_global,
    start_cheat_transaction_hash_global, stop_cheat_caller_address,
};
use starknet::ContractAddress;
use world_native::commands::{Battle, Command, CreateExplorer, Explore, Move, ToggleAlternate};
use eternum_randomness_protocol::{Intent, action_identity};
use eternum_randomness_protocol::entrypoint::{ExecutionContext, IRecordedExecutionDispatcher, IRecordedExecutionDispatcherTrait, IRecordedExecutionViewsDispatcher, IRecordedExecutionViewsDispatcherTrait};
use crate::native_protocol;
use world_native::game::{IGameDispatcher, IGameDispatcherTrait};
use world_native::lifecycle::{IDomainDispatcher, IDomainDispatcherTrait, Peers};
use world_native::map::{IMapDispatcher, IMapDispatcherTrait};
use world_native::resources::ResourceKey;
use world_native::season::{ISeasonDispatcher, ISeasonDispatcherTrait};
use world_native::structures::{IStructuresDispatcher, IStructuresDispatcherTrait};
use world_native::troops::{ExplorerKey, ITroopsDispatcher, ITroopsDispatcherTrait};
use crate::constants::{DEFAULT_NS, DEFAULT_NS_STR, RESOURCE_PRECISION};
use crate::models::config::{GameMapConfig, PresetConfig, WorldConfig};
use crate::models::game::GameRegistry;
use crate::models::hyperstructure::{Hyperstructure, HyperstructureGlobals, PlayerRegisteredPoints};
use crate::models::map2::TileOpt;
use crate::models::position::Coord;
use crate::models::resource::production::building::{Building, StructureBuildings};
use crate::models::resource::resource::Resource;
use crate::models::structure::{Structure, StructureOwnerStats};
use crate::models::troop::{ExplorerTroops, TroopTier, TroopType};
use crate::systems::alt_movement::contracts::{IAltMovementSystemsDispatcher, IAltMovementSystemsDispatcherTrait};
use crate::systems::combat::contracts::troop_battle::{
    ITroopBattleSystemsDispatcher, ITroopBattleSystemsDispatcherTrait,
};
use crate::systems::combat::contracts::troop_management::{
    ITroopManagementSystemsDispatcher, ITroopManagementSystemsDispatcherTrait,
};
use crate::systems::combat::contracts::troop_movement::{
    ITroopMovementSystemsDispatcher, ITroopMovementSystemsDispatcherTrait,
};
use crate::systems::utils::map::IMapImpl;

#[derive(Copy, Drop)]
struct PairedWorld {
    oracle: WorldStorage,
    peers: Peers,
    actor: ContractAddress,
    opponent: ContractAddress,
    case: felt252,
    roots: ContractAddress,
}

fn pair() -> StarkCurveKeyPair {
    KeyPairTrait::from_secret_key(12345)
}
fn opponent_pair() -> StarkCurveKeyPair {
    KeyPairTrait::from_secret_key(12346)
}
fn authority() -> ContractAddress {
    0x111.try_into().unwrap()
}
fn submitter() -> ContractAddress {
    0x222.try_into().unwrap()
}
fn deploy(name: ByteArray, calldata: @Array<felt252>) -> ContractAddress {
    let (address, _) = declare(name).unwrap().contract_class().deploy(calldata).unwrap();
    address
}

fn namespace() -> NamespaceDef {
    NamespaceDef {
        namespace: DEFAULT_NS_STR(),
        resources: [
            TestResource::Model("WorldConfig"), TestResource::Model("GameRegistry"),
            TestResource::Model("PresetConfig"), TestResource::Model("GameMapConfig"),
            TestResource::Model("ChainConfig"), TestResource::Model("RNG"), TestResource::Model("Structure"),
            TestResource::Model("StructureOwnerStats"), TestResource::Model("StructureReservation"),
            TestResource::Model("StructureBuildings"), TestResource::Model("StructureVillageSlots"),
            TestResource::Model("Building"), TestResource::Model("Resource"),
            TestResource::Model("ResourceFactoryConfig"), TestResource::Model("WeightConfig"),
            TestResource::Model("BuildingCategoryConfig"), TestResource::Model("ProductionBoostBonus"),
            TestResource::Model("ResourceList"), TestResource::Model("ExplorerTroops"), TestResource::Model("TileOpt"),
            TestResource::Model("PlayerRegisteredPoints"), TestResource::Model("SeasonPrize"),
            TestResource::Model("Hyperstructure"), TestResource::Model("HyperstructureGlobals"),
            TestResource::Model("AgentConfig"), TestResource::Model("AgentCount"),
            TestResource::Contract("alt_movement_systems"), TestResource::Contract("parity_bootstrap_systems"),
            TestResource::Contract("troop_management_systems"), TestResource::Contract("troop_movement_systems"),
            TestResource::Contract("troop_movement_util_systems"), TestResource::Contract("troop_battle_systems"),
            TestResource::Contract("hyperstructure_discovery_systems"),
            TestResource::Contract("mine_discovery_systems"), TestResource::Contract("camp_discovery_systems"),
            TestResource::Contract("agent_discovery_systems"), TestResource::Contract("relic_chest_discovery_systems"),
            TestResource::Contract("bitcoin_mine_discovery_systems"),
            TestResource::Library(("structure_creation_library", "0_1_18")),
            TestResource::Library(("biome_library", "0_1_13")), TestResource::Library(("rng_library", "0_1_16")),
            TestResource::Library(("combat_library", "0_1_14")), TestResource::Event("StoryEvent"),
            TestResource::Event("ExplorerMoveEvent"), TestResource::Event("BattleEvent"),
        ]
            .span(),
    }
}

fn setup(case: felt252) -> PairedWorld {
    start_cheat_block_timestamp_global(1800);
    start_cheat_chain_id_global('SN_TEST');
    native_protocol::deploy_submitter(submitter(), authority());
    let account = declare("ParityAccount").unwrap().contract_class();
    let (actor, _) = account.deploy(@array![pair().public_key]).unwrap();
    let (opponent, _) = account.deploy(@array![opponent_pair().public_key]).unwrap();
    let registry = deploy("ParityRegistry", @array![actor.into(), opponent.into()]);
    let season = deploy(
        "SeasonDomain", @array![authority().into(), submitter().into(), registry.into(), (*account.class_hash).into()],
    );
    let peers = Peers {
        season,
        map: deploy("MapDomain", @array![authority().into()]),
        structures: deploy("StructuresDomain", @array![authority().into()]),
        troops: deploy("TroopsDomain", @array![authority().into()]),
    };
    for address in array![peers.season, peers.map, peers.structures, peers.troops] {
        start_cheat_caller_address(address, authority());
        IDomainDispatcher { contract_address: address }.configure(peers);
    }
    for address in array![peers.season, peers.map, peers.structures, peers.troops] {
        IDomainDispatcher { contract_address: address }.activate();
        stop_cheat_caller_address(address);
    }
    let game = world_native::game::GameRegistry {
        name: 'native_parity',
        series_id: 0,
        game_number_in_series: 0,
        preset_id: 1,
        creator: authority(),
        status: world_native::game::GameStatus::Live,
        dev_mode_on: true,
        start_settling_at: 0,
        start_main_at: 0,
        end_at: 999999,
        end_grace_seconds: 0,
        registration_grace_seconds: 0,
        final_trial_id: 0,
        seed: 1,
    };
    start_cheat_caller_address(peers.season, authority());
    IGameDispatcher { contract_address: peers.season }.create_game(1, game, crate::native_inputs::rules());
    stop_cheat_caller_address(peers.season);
    start_cheat_caller_address(peers.structures, authority());
    IStructuresDispatcher { contract_address: peers.structures }
        .configure_resources(1, crate::native_inputs::resource_rules());
    stop_cheat_caller_address(peers.structures);
    let roots = deploy("ParityRoots", @array![]);
    let mut oracle = spawn_test_world([namespace()].span());
    let mut defs = array![];
    for name in array![
        "alt_movement_systems", "parity_bootstrap_systems", "troop_management_systems", "troop_movement_systems",
        "troop_movement_util_systems", "troop_battle_systems", "hyperstructure_discovery_systems",
        "mine_discovery_systems", "camp_discovery_systems", "agent_discovery_systems", "relic_chest_discovery_systems",
        "bitcoin_mine_discovery_systems",
    ] {
        defs
            .append(
                ContractDefTrait::new(DEFAULT_NS(), @name)
                    .with_writer_of([dojo::utils::bytearray_hash(DEFAULT_NS())].span()),
            );
    }
    oracle.sync_perms_and_inits(defs.span());
    oracle
        .write_member(
            Model::<crate::models::config::ChainConfig>::ptr_from_keys(crate::constants::WORLD_CONFIG_ID),
            selector!("vrf_provider_address"),
            roots,
        );
    oracle.dispatcher.uuid();
    let mut values = array![1];
    game.serialize(ref values);
    let mut raw = values.span();
    let oracle_game: GameRegistry = Serde::deserialize(ref raw).unwrap();
    assert!(raw.is_empty());
    oracle.write_model_test(@oracle_game);
    let mut preset_data = crate::native_preset::preset_values();
    let preset: PresetConfig = Serde::deserialize(ref preset_data).unwrap();
    assert!(preset_data.is_empty());
    oracle.write_model_test(@preset);
    oracle.write_model_test(@GameMapConfig { game_id: 1, map_config: preset.map_config });
    oracle.write_member(Model::<WorldConfig>::ptr_from_keys(1_u32), selector!("map_center_offset"), 20_u32);
    oracle
        .write_member(
            Model::<WorldConfig>::ptr_from_keys(1_u32),
            selector!("biome_climate_config"),
            convert::<
                world_native::rules::BiomeClimateConfig, crate::models::config::BiomeClimateConfig,
            >(crate::native_inputs::rules().biome_climate_config),
        );
    crate::native_side_tables::configure(ref oracle);
    PairedWorld { oracle, peers, actor, opponent, case, roots }
}

fn convert<A, B, +Serde<A>, +Drop<A>, +Serde<B>, +Drop<B>>(value: A) -> B {
    let mut values = array![];
    value.serialize(ref values);
    let mut raw = values.span();
    let result = Serde::deserialize(ref raw).unwrap();
    assert!(raw.is_empty());
    result
}

fn grants() -> Span<(u8, u128)> {
    array![
        (26, 1000 * RESOURCE_PRECISION), (35, 50000 * RESOURCE_PRECISION), (36, 50000 * RESOURCE_PRECISION),
        (38, 100 * RESOURCE_PRECISION),
    ]
        .span()
}
fn provision(ref worlds: PairedWorld, coord: Coord) -> u32 {
    provision_with_resources(ref worlds, coord, grants())
}
fn provision_with_resources(ref worlds: PairedWorld, coord: Coord, initial_resources: Span<(u8, u128)>) -> u32 {
    let (address, _) = worlds.oracle.dns(@"parity_bootstrap_systems").unwrap();
    let id = IParityBootstrapDispatcher { contract_address: address }.bootstrap(worlds.actor, coord, initial_resources);
    start_cheat_caller_address(worlds.peers.structures, authority());
    let native_id = IStructuresDispatcher { contract_address: worlds.peers.structures }
        .provision_realm(1, worlds.actor, convert(coord), initial_resources);
    stop_cheat_caller_address(worlds.peers.structures);
    assert_eq!(id, native_id);
    id
}
fn execute(worlds: PairedWorld, command: Command, timestamp: u64, root: u256) {
    start_cheat_block_timestamp_global(timestamp);
    let intent = native_protocol::action(worlds.peers.season, worlds.actor, command, timestamp);
    let public_key = world_native::season::IGameplayKeyDispatcherTrait::get_public_key(
        world_native::season::IGameplayKeyDispatcher { contract_address: worlds.actor },
    );
    let signer = if public_key == pair().public_key {
        pair()
    } else {
        opponent_pair()
    };
    let (r, s) = signer.sign(action_identity(@intent)).unwrap();
    let context = native_protocol::context(@intent, timestamp, root);
    let order = intent.last_order;
    native_protocol::authenticate(worlds.peers.season, submitter());
    IRecordedExecutionDispatcher { contract_address: worlds.peers.season }.execute(intent, context, r, s);
    assert_eq!(IRecordedExecutionViewsDispatcher { contract_address: worlds.peers.season }.get_result(order).status, 1);
    stop_cheat_caller_address(worlds.peers.season);
}
fn compare_row<A, +Serde<A>, +Drop<A>, B, +Serde<B>, +Drop<B>>(
    case: felt252, step: u32, model: felt252, keys: Span<felt252>, native: A, oracle: B,
) {
    let mut native_row = keys.into();
    native.serialize(ref native_row);
    let mut oracle_row = array![];
    oracle.serialize(ref oracle_row);
    let row_id = core::poseidon::poseidon_hash_span(keys);
    println!("PARITY_ROW {} {} {} {} {} {}", case, step, model, row_id, keys.len(), native_row.len());
    assert_eq!(native_row.len(), oracle_row.len(), "row length differs");
    for index in 0..native_row.len() {
        println!(
            "PARITY_VALUE {} {} {} {} {} {} {}",
            case,
            step,
            model,
            row_id,
            index,
            *native_row.at(index),
            *oracle_row.at(index),
        );
    }
    assert!(native_row == oracle_row, "gameplay row differs: {} step {}", model, step);
}
fn compare_home(worlds: PairedWorld, step: u32, id: u32) {
    let structures = IStructuresDispatcher { contract_address: worlds.peers.structures };
    let key = ResourceKey { game_id: 1, entity_id: id };
    compare_row(
        worlds.case,
        step,
        'Structure',
        array![1, id.into()].span(),
        structures.structure(key).unwrap(),
        ModelStorage::<WorldStorage, Structure>::read_model(@worlds.oracle, (1, id)),
    );
    compare_row(
        worlds.case,
        step,
        'Resource',
        array![1, id.into()].span(),
        structures.resource(key),
        ModelStorage::<WorldStorage, Resource>::read_model(@worlds.oracle, (1, id)),
    );
    let owner = structures.structure(key).unwrap().owner;
    compare_row(
        worlds.case,
        step,
        'StructureOwnerStats',
        array![1, owner.into()].span(),
        structures.owner_count(1, owner),
        ModelStorage::<WorldStorage, StructureOwnerStats>::read_model(@worlds.oracle, (1, owner)),
    );
}
#[test]
fn world_parity_explorer_creation() {
    let mut worlds = setup('creation');
    let coord = Coord { alt: false, x: 2147483626, y: 2147483626 };
    let home = provision(ref worlds, coord);
    compare_home(worlds, 0, home);
    let (address, _) = worlds.oracle.dns(@"troop_management_systems").unwrap();
    start_cheat_caller_address(address, worlds.actor);
    let id = ITroopManagementSystemsDispatcher { contract_address: address }
        .explorer_create(
            1,
            home,
            TroopType::Knight,
            TroopTier::T1,
            100 * RESOURCE_PRECISION,
            crate::models::position::Direction::East,
        );
    stop_cheat_caller_address(address);
    execute(
        worlds,
        Command::CreateExplorer(
            CreateExplorer { structure_id: home, category: 0, tier: 0, amount: 100 * RESOURCE_PRECISION, direction: 0 },
        ),
        1800,
        101,
    );
    compare_home(worlds, 1, home);
    let explorer = ITroopsDispatcher { contract_address: worlds.peers.troops }
        .explorer(ExplorerKey { game_id: 1, explorer_id: id })
        .unwrap();
    compare_row(
        worlds.case,
        1,
        'ExplorerTroops',
        array![1, id.into()].span(),
        explorer,
        ModelStorage::<WorldStorage, ExplorerTroops>::read_model(@worlds.oracle, (1, id)),
    );
    compare_row(
        worlds.case,
        1,
        'Resource',
        array![1, id.into()].span(),
        IStructuresDispatcher { contract_address: worlds.peers.structures }
            .resource(ResourceKey { game_id: 1, entity_id: id }),
        ModelStorage::<WorldStorage, Resource>::read_model(@worlds.oracle, (1, id)),
    );
    let tile = world_native::map::IMapDispatcher { contract_address: worlds.peers.map };
    let key = world_native::geometry::tile_key(1, explorer.coord);
    let actual = world_native::map::IMapDispatcherTrait::tile(tile, key).unwrap();
    compare_row(
        worlds.case,
        1,
        'TileOpt',
        array![1, 0, key.col.into(), key.row.into()].span(),
        actual,
        ModelStorage::<WorldStorage, TileOpt>::read_model(@worlds.oracle, (1, false, key.col, key.row)),
    );
}


fn compare_tile(worlds: PairedWorld, step: u32, coord: world_native::troops::Coord) {
    let key = world_native::geometry::tile_key(1, coord);
    let actual = IMapDispatcher { contract_address: worlds.peers.map }
        .tile(key)
        .unwrap_or(world_native::map::TileOpt { data: 0 });
    compare_row(
        worlds.case,
        step,
        'TileOpt',
        array![1, coord.alt.into(), coord.x.into(), coord.y.into()].span(),
        actual,
        ModelStorage::<WorldStorage, TileOpt>::read_model(@worlds.oracle, (1, coord.alt, coord.x, coord.y)),
    );
}
fn compare_explorer(worlds: PairedWorld, step: u32, id: u32) -> world_native::troops::ExplorerTroops {
    let explorer = ITroopsDispatcher { contract_address: worlds.peers.troops }
        .explorer(ExplorerKey { game_id: 1, explorer_id: id })
        .unwrap();
    compare_row(
        worlds.case,
        step,
        'ExplorerTroops',
        array![1, id.into()].span(),
        explorer,
        ModelStorage::<WorldStorage, ExplorerTroops>::read_model(@worlds.oracle, (1, id)),
    );
    compare_tile(worlds, step, explorer.coord);
    compare_row(
        worlds.case,
        step,
        'Resource',
        array![1, id.into()].span(),
        IStructuresDispatcher { contract_address: worlds.peers.structures }
            .resource(ResourceKey { game_id: 1, entity_id: id }),
        ModelStorage::<WorldStorage, Resource>::read_model(@worlds.oracle, (1, id)),
    );
    explorer
}
fn explore_pair(
    worlds: PairedWorld, id: u32, direction: u8, timestamp: u64, root: felt252, step: u32, expected_occupier: u8,
) -> world_native::troops::Coord {
    let explorer = ITroopsDispatcher { contract_address: worlds.peers.troops }
        .explorer(ExplorerKey { game_id: 1, explorer_id: id })
        .unwrap();
    let target = world_native::geometry::neighbor(explorer.coord, direction);
    start_cheat_block_timestamp_global(timestamp);
    let tx_hash = inject_root(worlds, root);
    let (address, _) = worlds.oracle.dns(@"troop_movement_systems").unwrap();
    start_cheat_caller_address(address, worlds.actor);
    ITroopMovementSystemsDispatcher { contract_address: address }
        .explorer_move(1, id, array![convert(direction)].span(), true);
    stop_cheat_caller_address(address);
    assert_root_consumed(worlds, tx_hash, root, step);
    execute(worlds, Command::Explore(Explore { explorer_id: id, direction }), timestamp, root.into());
    compare_home(worlds, step, explorer.owner);
    compare_explorer(worlds, step, id);
    compare_tile(worlds, step, explorer.coord);
    compare_tile(worlds, step, target);
    let tile = IMapDispatcher { contract_address: worlds.peers.map }
        .tile(world_native::geometry::tile_key(1, target))
        .unwrap();
    assert_eq!((tile.data / 2) % 256, expected_occupier.into());
    let game = IGameDispatcher { contract_address: worlds.peers.season };
    compare_row(
        worlds.case,
        step,
        'SeasonPrize',
        array![1].span(),
        (game.season_points(1), 0_u256),
        ModelStorage::<WorldStorage, crate::models::season::SeasonPrize>::read_model(@worlds.oracle, 1_u32),
    );
    compare_row(
        worlds.case,
        step,
        'PlayerRegisteredPoints',
        array![1, worlds.actor.into()].span(),
        game.player_points(1, worlds.actor),
        ModelStorage::<WorldStorage, PlayerRegisteredPoints>::read_model(@worlds.oracle, (1, worlds.actor)),
    );
    target
}
fn create_explorer_pair(worlds: PairedWorld, home: u32) -> u32 {
    let (address, _) = worlds.oracle.dns(@"troop_management_systems").unwrap();
    start_cheat_caller_address(address, worlds.actor);
    let id = ITroopManagementSystemsDispatcher { contract_address: address }
        .explorer_create(
            1,
            home,
            TroopType::Knight,
            TroopTier::T1,
            100 * RESOURCE_PRECISION,
            crate::models::position::Direction::East,
        );
    stop_cheat_caller_address(address);
    execute(
        worlds,
        Command::CreateExplorer(
            CreateExplorer { structure_id: home, category: 0, tier: 0, amount: 100 * RESOURCE_PRECISION, direction: 0 },
        ),
        1800,
        101,
    );
    compare_home(worlds, 1, home);
    compare_explorer(worlds, 1, id);
    id
}
fn compare_discovery(worlds: PairedWorld, step: u32, coord: world_native::troops::Coord, mine: bool) {
    let structures = IStructuresDispatcher { contract_address: worlds.peers.structures };
    let tile = IMapDispatcher { contract_address: worlds.peers.map }
        .tile(world_native::geometry::tile_key(1, coord))
        .unwrap();
    let id: u32 = ((tile.data / 512) % 0x100000000).try_into().unwrap();
    compare_home(worlds, step, id);
    for direction in 0_u8..6 {
        compare_tile(worlds, step, world_native::geometry::neighbor(coord, direction));
    }
    if (tile.data / 2) % 256 == 9 {
        let key = ResourceKey { game_id: 1, entity_id: id };
        compare_row(
            worlds.case,
            step,
            'Hyperstructure',
            array![1, id.into()].span(),
            structures.hyperstructure(key).unwrap(),
            ModelStorage::<WorldStorage, Hyperstructure>::read_model(@worlds.oracle, (1, id)),
        );
        compare_row(
            worlds.case,
            step,
            'HyperstructureGlobals',
            array![1].span(),
            (structures.hyperstructure_count(1), 0_u32),
            ModelStorage::<WorldStorage, HyperstructureGlobals>::read_model(@worlds.oracle, 1_u32),
        );
    }
    if mine {
        let key = world_native::buildings::BuildingKey {
            game_id: 1, alt: coord.alt, outer_col: coord.x, outer_row: coord.y, inner_col: 10, inner_row: 10,
        };
        compare_row(
            worlds.case,
            step,
            'Building',
            array![1, coord.alt.into(), coord.x.into(), coord.y.into(), 10, 10].span(),
            structures.building(key).unwrap(),
            ModelStorage::<
                WorldStorage, Building,
            >::read_model(@worlds.oracle, (1, coord.alt, coord.x, coord.y, 10_u32, 10_u32)),
        );
        compare_row(
            worlds.case,
            step,
            'StructureBuildings',
            array![1, id.into()].span(),
            structures.structure_buildings(ResourceKey { game_id: 1, entity_id: id }),
            ModelStorage::<WorldStorage, StructureBuildings>::read_model(@worlds.oracle, (1, id)),
        );
    }
}
#[test]
fn world_parity_surface_discoveries() {
    let mut worlds = setup('surface');
    let home = provision(ref worlds, Coord { alt: false, x: 2147483626, y: 2147483626 });
    let id = create_explorer_pair(worlds, home);
    explore_pair(worlds, id, 0, 1920, 1, 2, 15);
    let mine = explore_pair(worlds, id, 0, 2040, 36, 3, 12);
    compare_discovery(worlds, 3, mine, true);
    let hyper = explore_pair(worlds, id, 1, 2160, 66, 4, 9);
    compare_discovery(worlds, 4, hyper, false);
}


fn provision_spire_pair(worlds: PairedWorld, spire: Coord) {
    let (bootstrap, _) = worlds.oracle.dns(@"parity_bootstrap_systems").unwrap();
    let expected = IParityBootstrapDispatcher { contract_address: bootstrap }.spire(spire);
    start_cheat_caller_address(worlds.peers.structures, authority());
    let actual = IStructuresDispatcher { contract_address: worlds.peers.structures }.provision_spire(1, convert(spire));
    stop_cheat_caller_address(worlds.peers.structures);
    assert_eq!(actual, expected);
    for alt in array![false, true] {
        let coord = world_native::troops::Coord { alt, x: spire.x, y: spire.y };
        compare_tile(worlds, 0, coord);
        for direction in 0_u8..6 {
            compare_tile(worlds, 0, world_native::geometry::spire_neighbor(coord, direction));
        }
    }
}
fn toggle_pair(worlds: PairedWorld, id: u32, direction: u8, timestamp: u64) {
    start_cheat_block_timestamp_global(timestamp);
    let (address, _) = worlds.oracle.dns(@"alt_movement_systems").unwrap();
    start_cheat_caller_address(address, worlds.actor);
    IAltMovementSystemsDispatcher { contract_address: address }.toggle_alternate(1, id, convert(direction));
    stop_cheat_caller_address(address);
    execute(
        worlds,
        Command::ToggleAlternate(ToggleAlternate { explorer_id: id, spire_direction: direction }),
        timestamp,
        102,
    );
}

#[test]
fn world_parity_ethereal_entry_and_discovery() {
    let mut worlds = setup('ethereal');
    let home = provision(ref worlds, Coord { alt: false, x: 2147483626, y: 2147483626 });
    let spire = Coord { alt: false, x: 2147483628, y: 2147483626 };
    provision_spire_pair(worlds, spire);
    let id = create_explorer_pair(worlds, home);
    toggle_pair(worlds, id, 0, 1860);
    compare_home(worlds, 2, home);
    let explorer = compare_explorer(worlds, 2, id);
    assert!(explorer.coord.alt);
    compare_tile(worlds, 2, world_native::troops::Coord { alt: false, ..explorer.coord });
    explore_pair(worlds, id, 0, 1920, 2, 3, 15);
    let mine = explore_pair(worlds, id, 0, 2040, 9, 4, 38);
    compare_discovery(worlds, 4, mine, false);
}


#[test]
fn world_parity_production_settlement() {
    production_settlement_case('production', 1860, 180, false);
}
#[test]
fn world_parity_production_cap() {
    production_settlement_case('production_cap', 2100, 300, false);
}
#[test]
fn world_parity_production_capacity() {
    production_settlement_case('production_capacity', 1860, 180, true);
}
fn production_settlement_case(case: felt252, claim_at: u64, expected_balance: u128, limited: bool) {
    let mut worlds = setup(case);
    let initial = if limited {
        let capacity = crate::native_inputs::rules().structure_capacity_config.realm_capacity.into()
            * RESOURCE_PRECISION;
        array![(1_u8, capacity / 1000 - 5 * RESOURCE_PRECISION)].span()
    } else {
        grants()
    };
    let home = provision_with_resources(ref worlds, Coord { alt: false, x: 2147483626, y: 2147483626 }, initial);
    let (bootstrap, _) = worlds.oracle.dns(@"parity_bootstrap_systems").unwrap();
    let dispatcher = IParityBootstrapDispatcher { contract_address: bootstrap };
    dispatcher.producer(home, 300 * RESOURCE_PRECISION);
    start_cheat_caller_address(worlds.peers.structures, authority());
    let structures = IStructuresDispatcher { contract_address: worlds.peers.structures };
    let key = ResourceKey { game_id: 1, entity_id: home };
    structures.provision_producer(key, 300 * RESOURCE_PRECISION);
    stop_cheat_caller_address(worlds.peers.structures);
    compare_home(worlds, 0, home);
    start_cheat_block_timestamp_global(1860);
    let before = structures.resource(key);
    assert_eq!(before, structures.resource(key));
    assert_eq!(before.EARTHEN_SHARD_BALANCE, 0);
    for (step, timestamp) in array![(1_u32, claim_at), (2, claim_at)] {
        start_cheat_block_timestamp_global(timestamp);
        start_cheat_caller_address(bootstrap, worlds.actor);
        dispatcher.claim(home);
        stop_cheat_caller_address(bootstrap);
        execute(worlds, Command::ClaimProduction(home), timestamp, (400 + step).into());
        compare_home(worlds, step, home);
    }
    let after = structures.resource(key);
    assert_eq!(after.EARTHEN_SHARD_BALANCE, (if limited {
        50
    } else {
        expected_balance
    }) * RESOURCE_PRECISION);
    assert_eq!(after.EARTHEN_SHARD_PRODUCTION.output_amount_left, (300 - expected_balance) * RESOURCE_PRECISION);
}


#[test]
fn world_parity_battle_deletes_explorer() {
    battle_case('battle', false);
}
#[test]
fn world_parity_ethereal_battle() {
    battle_case('ethereal_battle', true);
}
fn battle_case(case: felt252, alt: bool) {
    let mut worlds = setup(case);
    let home = provision(ref worlds, Coord { alt: false, x: 2147483626, y: 2147483626 });
    let mut opponent = PairedWorld { actor: worlds.opponent, ..worlds };
    let enemy_x = if alt {
        2147483643
    } else {
        2147483629
    };
    let enemy_home = provision(ref opponent, Coord { alt: false, x: enemy_x, y: 2147483626 });
    if alt {
        provision_spire_pair(worlds, Coord { alt: false, x: 2147483628, y: 2147483626 });
        provision_spire_pair(worlds, Coord { alt: false, x: 2147483641, y: 2147483626 });
    }
    let attacker = create_explorer_pair(worlds, home);
    let (management, _) = worlds.oracle.dns(@"troop_management_systems").unwrap();
    start_cheat_caller_address(management, worlds.opponent);
    let defender = ITroopManagementSystemsDispatcher { contract_address: management }
        .explorer_create(
            1,
            enemy_home,
            TroopType::Knight,
            TroopTier::T1,
            RESOURCE_PRECISION,
            crate::models::position::Direction::West,
        );
    stop_cheat_caller_address(management);
    execute(
        opponent,
        Command::CreateExplorer(
            CreateExplorer { structure_id: enemy_home, category: 0, tier: 0, amount: RESOURCE_PRECISION, direction: 3 },
        ),
        1800,
        201,
    );
    compare_home(worlds, 1, enemy_home);
    compare_explorer(worlds, 1, defender);
    if alt {
        toggle_pair(worlds, attacker, 0, 1860);
        toggle_pair(opponent, defender, 3, 1860);
    }
    let before = compare_explorer(worlds, if alt {
        4
    } else {
        1
    }, defender);
    let step = if alt {
        5_u32
    } else {
        2_u32
    };
    start_cheat_block_timestamp_global(1920);
    let tx_hash = inject_root(worlds, 501);
    let mut battle_events = spy_events();
    let (battle, _) = worlds.oracle.dns(@"troop_battle_systems").unwrap();
    start_cheat_caller_address(battle, worlds.actor);
    ITroopBattleSystemsDispatcher { contract_address: battle }
        .attack_explorer_vs_explorer(1, attacker, defender, array![].span());
    stop_cheat_caller_address(battle);
    if alt {
        assert_root_consumed(worlds, tx_hash, 501, step);
    } else {
        assert_eq!(IParityRootsDispatcher { contract_address: worlds.roots }.consumed(), 0);
    }
    execute(worlds, Command::Battle(Battle { attacker_id: attacker, defender_id: defender }), 1920, 501);
    let events = battle_events.get_events();
    let mut native_payload = array![];
    let mut native_count = 0;
    for (address, event) in events.events.span() {
        if *address == worlds.peers.troops && *event.keys.at(0) == selector!("BattleEvent") {
            assert_eq!(*event.keys.at(1), 1);
            native_payload.append(5);
            native_payload.append_span(event.keys.span().slice(2, 5));
            native_payload.append(event.data.len().into());
            native_payload.append_span(event.data.span());
            native_count += 1;
        }
    }
    assert_eq!(native_count, 1);
    let mut matched = 0;
    for (address, event) in events.events.span() {
        if *address == worlds.oracle.dispatcher.contract_address
            && *event.keys.at(0) == selector!("EventEmitted")
            && event.data.span() == native_payload.span() {
            matched += 1;
        }
    }
    assert_eq!(matched, 1, "combat event projection differs");
    println!(
        "PARITY_EVENT {} {} {} {}",
        case,
        step,
        'BattleEvent',
        core::poseidon::poseidon_hash_span(native_payload.span()),
    );
    compare_home(worlds, step, home);
    compare_home(worlds, step, enemy_home);
    compare_explorer(worlds, step, attacker);
    assert!(
        ITroopsDispatcher { contract_address: worlds.peers.troops }
            .explorer(ExplorerKey { game_id: 1, explorer_id: defender })
            .is_none(),
    );
    assert!(
        !IStructuresDispatcher { contract_address: worlds.peers.structures }
            .has_resource(ResourceKey { game_id: 1, entity_id: defender }),
    );
    let deleted: ExplorerTroops = ModelStorage::<
        WorldStorage, ExplorerTroops,
    >::read_model(@worlds.oracle, (1, defender));
    let resource: Resource = ModelStorage::<WorldStorage, Resource>::read_model(@worlds.oracle, (1, defender));
    let mut row = array![];
    deleted.serialize(ref row);
    for value in row.span().slice(2, row.len() - 2) {
        assert_eq!(*value, 0);
    }
    let mut row = array![];
    resource.serialize(ref row);
    for value in row.span().slice(2, row.len() - 2) {
        assert_eq!(*value, 0);
    }
    println!("PARITY_DELETE {} {} {} {} {}", worlds.case, step, 'ExplorerTroops', 1, defender);
    println!("PARITY_DELETE {} {} {} {} {}", worlds.case, step, 'Resource', 1, defender);
    compare_tile(worlds, step, before.coord);
}


fn rejected_explore_pair(worlds: PairedWorld, id: u32, direction: u8, timestamp: u64, step: u32) {
    let attempts = IParityAttemptsDispatcher { contract_address: deploy("ParityAttempts", @array![]) };
    let season = ISeasonDispatcher { contract_address: worlds.peers.season };
    let troops = ITroopsDispatcher { contract_address: worlds.peers.troops };
    let structures = IStructuresDispatcher { contract_address: worlds.peers.structures };
    let map = IMapDispatcher { contract_address: worlds.peers.map };
    let key = ExplorerKey { game_id: 1, explorer_id: id };
    let before = troops.explorer(key).unwrap();
    let home_key = ResourceKey { game_id: 1, entity_id: before.owner };
    let resource_before = structures.resource(home_key);
    let home_before = structures.structure(home_key).unwrap();
    let target = world_native::geometry::tile_key(1, world_native::geometry::neighbor(before.coord, direction));
    let target_before = map.tile(target);
    let nonce = season.next_nonce(1, worlds.actor);
    start_cheat_block_timestamp_global(timestamp);
    let tx_hash = inject_root(worlds, 1);
    let (movement, _) = worlds.oracle.dns(@"troop_movement_systems").unwrap();
    cheat_caller_address(movement, worlds.actor, CheatSpan::TargetCalls(1));
    assert!(!attempts.explore(movement, id, convert(direction)));
    let intent = native_protocol::action(worlds.peers.season, worlds.actor, Command::Explore(Explore { explorer_id: id, direction }), timestamp);
    let public_key = world_native::season::IGameplayKeyDispatcherTrait::get_public_key(
        world_native::season::IGameplayKeyDispatcher { contract_address: worlds.actor },
    );
    let signer = if public_key == pair().public_key {
        pair()
    } else {
        opponent_pair()
    };
    let (r, s) = signer.sign(action_identity(@intent)).unwrap();
    let context = native_protocol::context(@intent, timestamp, 1);
    native_protocol::authenticate(worlds.peers.season, submitter());
    assert!(!attempts.native(worlds.peers.season, intent, context, r, s));
    assert_eq!(season.next_nonce(1, worlds.actor), nonce + 1);
    assert_eq!(IParityRootsDispatcher { contract_address: worlds.roots }.consumed(), 0);
    assert_eq!(ModelStorage::<WorldStorage, crate::models::rng::RNG>::read_model(@worlds.oracle, tx_hash).seed, 0);
    assert_eq!(troops.explorer(key).unwrap(), before);
    assert_eq!(structures.resource(home_key), resource_before);
    assert_eq!(structures.structure(home_key).unwrap(), home_before);
    assert_eq!(map.tile(target), target_before);
    compare_home(worlds, step, before.owner);
    compare_explorer(worlds, step, id);
    compare_tile(worlds, step, world_native::troops::Coord { alt: target.alt, x: target.col, y: target.row });
    println!("PARITY_REJECTION {} {} {} {}", worlds.case, step, id, timestamp);
}
#[test]
fn world_parity_rejected_actions_preserve_rows() {
    let mut worlds = setup('rejections');
    let home = provision_with_resources(
        ref worlds, Coord { alt: false, x: 2147483626, y: 2147483626 }, array![(26, 1000 * RESOURCE_PRECISION)].span(),
    );
    let id = create_explorer_pair(worlds, home);
    rejected_explore_pair(worlds, id, 0, 1920, 2);
    rejected_explore_pair(worlds, id, 3, 1920, 3);
    rejected_explore_pair(PairedWorld { actor: worlds.opponent, ..worlds }, id, 0, 1920, 4);
    rejected_explore_pair(worlds, id, 0, 999999, 5);
}
#[starknet::interface]
pub trait IParityAttempts<T> {
    fn native(
        ref self: T, season: ContractAddress, intent: Intent, context: ExecutionContext, r: felt252, s: felt252,
    ) -> bool;
    fn explore(ref self: T, movement: ContractAddress, id: u32, direction: crate::models::position::Direction) -> bool;
}
#[starknet::contract]
mod ParityAttempts {
    use starknet::ContractAddress;
    use eternum_randomness_protocol::{Intent, decode_envelope};
    use eternum_randomness_protocol::entrypoint::{ExecutionContext, IRecordedExecutionSafeDispatcher, IRecordedExecutionSafeDispatcherTrait, IRecordedExecutionViewsDispatcher, IRecordedExecutionViewsDispatcherTrait};
    use crate::models::position::Direction;
    use crate::systems::combat::contracts::troop_movement::{
        ITroopMovementSystemsSafeDispatcher, ITroopMovementSystemsSafeDispatcherTrait,
    };
    #[storage]
    struct Storage {}
    #[abi(embed_v0)]
    impl Attempts of super::IParityAttempts<ContractState> {
        #[feature("safe_dispatcher")]
        fn native(
            ref self: ContractState,
            season: ContractAddress,
            intent: Intent,
            context: ExecutionContext,
            r: felt252,
            s: felt252,
        ) -> bool {
            let order = decode_envelope(context.envelope.span()).unwrap().order;
            IRecordedExecutionSafeDispatcher { contract_address: season }.execute(intent, context, r, s).is_ok()
                && IRecordedExecutionViewsDispatcher { contract_address: season }.get_result(order).status == 1
        }
        #[feature("safe_dispatcher")]
        fn explore(ref self: ContractState, movement: ContractAddress, id: u32, direction: Direction) -> bool {
            ITroopMovementSystemsSafeDispatcher { contract_address: movement }
                .explorer_move(1, id, array![direction].span(), true)
                .is_ok()
        }
    }
}


#[test]
fn world_parity_travel_and_known_exploration() {
    let mut worlds = setup('travel');
    let home = provision(ref worlds, Coord { alt: false, x: 2147483626, y: 2147483626 });
    let id = create_explorer_pair(worlds, home);
    explore_pair(worlds, id, 0, 1920, 1, 2, 15);
    explore_pair(worlds, id, 3, 2040, 1, 3, 15);
    explore_pair(worlds, id, 0, 2160, 300, 4, 15);
    start_cheat_block_timestamp_global(2280);
    let before = ITroopsDispatcher { contract_address: worlds.peers.troops }
        .explorer(ExplorerKey { game_id: 1, explorer_id: id })
        .unwrap();
    let (address, _) = worlds.oracle.dns(@"troop_movement_systems").unwrap();
    start_cheat_caller_address(address, worlds.actor);
    ITroopMovementSystemsDispatcher { contract_address: address }
        .explorer_move(1, id, array![crate::models::position::Direction::West].span(), false);
    stop_cheat_caller_address(address);
    execute(worlds, Command::Move(Move { explorer_id: id, directions: array![3].span() }), 2280, 301);
    compare_home(worlds, 5, home);
    compare_explorer(worlds, 5, id);
    compare_tile(worlds, 5, before.coord);
}


fn inject_root(worlds: PairedWorld, root: felt252) -> felt252 {
    let tx_hash = IParityRootsDispatcher { contract_address: worlds.roots }.prepare(root);
    start_cheat_transaction_hash_global(tx_hash);
    tx_hash
}
fn assert_root_consumed(worlds: PairedWorld, tx_hash: felt252, root: felt252, step: u32) {
    let rng: crate::models::rng::RNG = ModelStorage::<
        WorldStorage, crate::models::rng::RNG,
    >::read_model(@worlds.oracle, tx_hash);
    let expected: u256 = root.into() + 1432;
    assert_eq!(rng.seed, expected);
    assert_eq!(IParityRootsDispatcher { contract_address: worlds.roots }.consumed(), 1);
    println!("PARITY_ROOT {} {} {} {}", worlds.case, step, root, rng.seed.low);
}
#[starknet::interface]
pub trait IParityRoots<T> {
    fn prepare(ref self: T, root: felt252) -> felt252;
    fn consume_random(ref self: T, source: crate::utils::cartridge::vrf::Source) -> felt252;
    fn consumed(self: @T) -> u32;
}
#[starknet::contract]
mod ParityRoots {
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};
    use crate::utils::cartridge::vrf::Source;
    #[storage]
    struct Storage {
        root: felt252,
        sequence: u64,
        consumed: u32,
    }
    #[abi(embed_v0)]
    impl Roots of super::IParityRoots<ContractState> {
        fn prepare(ref self: ContractState, root: felt252) -> felt252 {
            let sequence = self.sequence.read() + 1;
            self.sequence.write(sequence);
            self.root.write(root);
            self.consumed.write(0);
            sequence.into()
        }
        fn consume_random(ref self: ContractState, source: Source) -> felt252 {
            assert_eq!(self.consumed.read(), 0);
            self.consumed.write(1);
            self.root.read()
        }
        fn consumed(self: @ContractState) -> u32 {
            self.consumed.read()
        }
    }
}

#[starknet::contract]
mod ParityAccount {
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};
    #[storage]
    struct Storage {
        public_key: felt252,
    }
    #[constructor]
    fn constructor(ref self: ContractState, public_key: felt252) {
        self.public_key.write(public_key);
    }
    #[abi(embed_v0)]
    impl Key of world_native::season::IGameplayKey<ContractState> {
        fn get_public_key(self: @ContractState) -> felt252 {
            self.public_key.read()
        }
    }
}
#[starknet::contract]
mod ParityRegistry {
    use starknet::ContractAddress;
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};
    #[storage]
    struct Storage {
        actor: ContractAddress,
        opponent: ContractAddress,
    }
    #[constructor]
    fn constructor(ref self: ContractState, actor: ContractAddress, opponent: ContractAddress) {
        self.actor.write(actor);
        self.opponent.write(opponent);
    }
    #[abi(embed_v0)]
    impl Registry of world_native::season::IPlayerRegistry<ContractState> {
        fn account_of(self: @ContractState, owner: ContractAddress) -> ContractAddress {
            if owner == 0x333.try_into().unwrap() {
                self.actor.read()
            } else if owner == 0x334.try_into().unwrap() {
                self.opponent.read()
            } else {
                0.try_into().unwrap()
            }
        }
        fn owner_of(self: @ContractState, account: ContractAddress) -> ContractAddress {
            if account == self.actor.read() {
                0x333.try_into().unwrap()
            } else if account == self.opponent.read() {
                0x334.try_into().unwrap()
            } else {
                0.try_into().unwrap()
            }
        }
    }
}

#[starknet::interface]
pub trait IParityBootstrap<T> {
    fn producer(ref self: T, id: u32, output: u128);
    fn claim(ref self: T, id: u32);
    fn spire(ref self: T, coord: Coord) -> u32;
    fn bootstrap(ref self: T, actor: ContractAddress, coord: Coord, grants: Span<(u8, u128)>) -> u32;
}
#[dojo::contract]
pub mod parity_bootstrap_systems {
    use dojo::model::ModelStorage;
    use dojo::world::IWorldDispatcherTrait;
    use starknet::ContractAddress;
    use crate::constants::DEFAULT_NS;
    use crate::models::map::{Tile, TileOccupier};
    use crate::models::map2::TileOpt;
    use crate::models::position::{Coord, CoordTrait};
    use crate::models::resource::production::building::{BuildingCategory, BuildingImpl};
    use crate::models::resource::resource::{ResourceWeightImpl, SingleResourceStoreImpl, WeightStoreImpl};
    use crate::models::structure::{Structure, StructureCategory, StructureOwnerStoreImpl};
    use crate::system_libraries::biome_library::{IBiomeLibraryDispatcherTrait, biome_library};
    use crate::system_libraries::structure_libraries::structure_creation_library::{
        IStructureCreationlibraryDispatcherTrait, structure_creation_library,
    };
    use crate::systems::utils::map::IMapImpl;
    #[abi(embed_v0)]
    impl Bootstrap of super::IParityBootstrap<ContractState> {
        fn producer(ref self: ContractState, id: u32, output: u128) {
            let mut world = self.world(DEFAULT_NS());
            let structure: Structure = world.read_model((1_u32, id));
            let mut weight = WeightStoreImpl::retrieve(ref world, 1, id);
            let unit_weight = ResourceWeightImpl::grams(ref world, 1, 24);
            let mut resource = SingleResourceStoreImpl::retrieve(ref world, 1, id, 24, ref weight, unit_weight, true);
            resource.production.output_amount_left += output;
            resource.store(ref world);
            weight.store(ref world, 1, id);
            BuildingImpl::create(
                ref world,
                1,
                structure.owner,
                id,
                structure.category.into(),
                Coord { alt: false, x: structure.base.coord_x, y: structure.base.coord_y },
                BuildingCategory::ResourceEarthenShard,
                BuildingImpl::center(),
            );
        }
        fn claim(ref self: ContractState, id: u32) {
            let mut world = self.world(DEFAULT_NS());
            assert!(
                starknet::get_caller_address() == StructureOwnerStoreImpl::retrieve(ref world, 1, id),
                "actor does not own structure",
            );
            let mut weight = WeightStoreImpl::retrieve(ref world, 1, id);
            for resource_type in 1_u8..59 {
                if resource_type < 39 || resource_type > 56 {
                    let unit_weight = ResourceWeightImpl::grams(ref world, 1, resource_type);
                    SingleResourceStoreImpl::retrieve(ref world, 1, id, resource_type, ref weight, unit_weight, true);
                }
            }
        }
        fn spire(ref self: ContractState, coord: Coord) -> u32 {
            let mut world = self.world(DEFAULT_NS());
            let id = world.dispatcher.uuid();
            for alt in array![false, true] {
                let layer = Coord { alt, ..coord };
                seed_tile(ref world, layer, id);
                for direction in crate::models::position::DirectionTrait::all() {
                    seed_tile(ref world, layer.spire_neighbor(direction), 0);
                }
            }
            id
        }
        fn bootstrap(ref self: ContractState, actor: ContractAddress, coord: Coord, grants: Span<(u8, u128)>) -> u32 {
            let mut world = self.world(DEFAULT_NS());
            let id = world.dispatcher.uuid();
            structure_creation_library::get_dispatcher(@world)
                .make_structure(
                    world,
                    1,
                    coord,
                    actor,
                    id,
                    StructureCategory::Realm,
                    array![].span(),
                    Default::default(),
                    TileOccupier::RealmRegularLevel1,
                    false,
                );
            crate::utils::testing::helpers::tgrant_resources(ref world, id, grants);
            id
        }
    }
    fn seed_tile(ref world: dojo::world::WorldStorage, coord: Coord, spire_id: u32) {
        let opt: TileOpt = world.read_model((1_u32, coord.alt, coord.x, coord.y));
        let mut tile: Tile = opt.into();
        let biome = biome_library::get_dispatcher(@world)
            .get_biome(world, 1, coord.alt, coord.x.into(), coord.y.into());
        IMapImpl::explore(ref world, ref tile, biome);
        if spire_id != 0 {
            IMapImpl::occupy(ref world, ref tile, TileOccupier::Spire, spire_id);
        }
    }
}
