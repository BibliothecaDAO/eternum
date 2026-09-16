use dojo::model::{Model, ModelStorage, ModelStorageTest};
use dojo::world::{IWorldDispatcherTrait, WorldStorage, WorldStorageTrait};
use dojo_snf_test::{
    ContractDefTrait, NamespaceDef, TestResource, WorldStorageTestTrait, spawn_test_world,
};
use eternum_randomness_protocol::entrypoint::{
    ExecutionContext, IRecordedExecutionDispatcher, IRecordedExecutionDispatcherTrait,
    IRecordedExecutionViewsDispatcher, IRecordedExecutionViewsDispatcherTrait,
};
use eternum_randomness_protocol::{Intent, action_identity};
use snforge_std::signature::stark_curve::{
    StarkCurveKeyPair, StarkCurveKeyPairImpl, StarkCurveSignerImpl,
};
use snforge_std::signature::{KeyPairTrait, SignerTrait};
use snforge_std::{
    CheatSpan, ContractClassTrait, DeclareResultTrait, cheat_caller_address, declare,
    start_cheat_block_timestamp_global, start_cheat_caller_address, start_cheat_chain_id_global,
    start_cheat_transaction_hash_global, stop_cheat_caller_address,
};
use starknet::ContractAddress;
use world_native::commands::{Battle, Command, CreateExplorer, Explore, Move, ToggleAlternate};
use world_native::game::{IGameDispatcher, IGameDispatcherTrait};
use world_native::lifecycle::{IDomainDispatcher, IDomainDispatcherTrait, Peers};
use world_native::map::{IMapDispatcher, IMapDispatcherTrait};
use world_native::names::{
    INamesDispatcher, INamesDispatcherTrait, INamesSafeDispatcher, INamesSafeDispatcherTrait,
};
use world_native::ownership::{
    FaithfulStructure, IAgentOwnershipDispatcherTrait, IFaithOwnershipViewsDispatcherTrait,
    PlayerFaithPoints, WonderFaith,
};
use world_native::resources::{
    IResourcesDispatcher, IResourcesDispatcherTrait, ResourceKey, ResourceSlot,
};
use world_native::season::{ISeasonDispatcher, ISeasonDispatcherTrait};
use world_native::structures::{IStructuresDispatcher, IStructuresDispatcherTrait};
use world_native::troops::{ExplorerKey, ITroopsDispatcher, ITroopsDispatcherTrait};
use world_native::upgrades::{
    IStructureUpgradesSafeDispatcher, IStructureUpgradesSafeDispatcherTrait,
    IUpgradeRulesDispatcher, IUpgradeRulesDispatcherTrait, UpgradeLimits,
};
use crate::constants::{DEFAULT_NS, DEFAULT_NS_STR, RESOURCE_PRECISION};
use crate::models::config::{GameMapConfig, PresetConfig, WorldConfig};
use crate::models::game::GameRegistry;
use crate::models::hyperstructure::{Hyperstructure, HyperstructureGlobals, PlayerRegisteredPoints};
use crate::models::map2::TileOpt;
use crate::models::position::Coord;
use crate::models::resource::production::building::{Building, StructureBuildings};
use crate::models::structure::Structure;
use crate::models::troop::{ExplorerTroops, TroopTier, TroopType};
use crate::native_facts::*;
use crate::native_protocol;
use crate::systems::alt_movement::contracts::{
    IAltMovementSystemsDispatcher, IAltMovementSystemsDispatcherTrait,
};
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
            TestResource::Model("ChainConfig"), TestResource::Model("RNG"),
            TestResource::Model("Structure"), TestResource::Model("StructureOwnerStats"),
            TestResource::Model("StructureReservation"), TestResource::Model("StructureBuildings"),
            TestResource::Model("StructureVillageSlots"), TestResource::Model("Building"),
            TestResource::Model("Resource"), TestResource::Model("ResourceAllowance"),
            TestResource::Model("ResourceArrival"), TestResource::Contract("resource_systems"),
            TestResource::Event("ExplicitResourceBurn"), TestResource::Event("BurnDonkey"),
            TestResource::Model("ResourceFactoryConfig"), TestResource::Model("WeightConfig"),
            TestResource::Model("BuildingCategoryConfig"),
            TestResource::Model("ProductionBoostBonus"), TestResource::Model("ResourceList"),
            TestResource::Model("ExplorerTroops"), TestResource::Model("TileOpt"),
            TestResource::Model("PlayerRegisteredPoints"), TestResource::Model("SeasonPrize"),
            TestResource::Model("Hyperstructure"), TestResource::Model("HyperstructureGlobals"),
            TestResource::Model("CompletedHyperstructure"),
            TestResource::Model("HyperstructureIndex"), TestResource::Model("StructureLevelConfig"),
            TestResource::Contract("structure_systems"), TestResource::Model("AddressName"),
            TestResource::Contract("name_systems"), TestResource::Model("RealmAllocation"),
            TestResource::Model("RealmAllocationSlot"), TestResource::Model("RealmAllocationPool"),
            TestResource::Model("Wonder"), TestResource::Model("BlitzSettlement"),
            TestResource::Model("BlitzSettlementPosition"), TestResource::Model("PlayerSettlement"),
            TestResource::Model("LedgerRegistration"),
            TestResource::Model("BlitzCosmeticAttrsRegister"),
            TestResource::Event("BlitzSettlementEvent"),
            TestResource::Contract("blitz_realm_systems"),
            TestResource::Contract("realm_internal_systems"),
            TestResource::Contract("realm_systems"),
            TestResource::Contract("hyperstructure_create_systems"),
            TestResource::Contract("village_systems"), TestResource::Model("VillageTroop"),
            TestResource::Model("AgentConfig"), TestResource::Model("AgentCount"),
            TestResource::Model("AgentOwner"), TestResource::Model("WonderFaith"),
            TestResource::Model("FaithfulStructure"), TestResource::Model("PlayerFaithPoints"),
            TestResource::Model("WonderFaithWinners"), TestResource::Contract("ownership_systems"),
            TestResource::Contract("alt_movement_systems"),
            TestResource::Contract("parity_bootstrap_systems"),
            TestResource::Contract("troop_management_systems"),
            TestResource::Contract("troop_movement_systems"),
            TestResource::Contract("troop_movement_util_systems"),
            TestResource::Contract("troop_battle_systems"),
            TestResource::Contract("hyperstructure_discovery_systems"),
            TestResource::Contract("mine_discovery_systems"),
            TestResource::Contract("camp_discovery_systems"),
            TestResource::Contract("agent_discovery_systems"),
            TestResource::Contract("relic_chest_discovery_systems"),
            TestResource::Contract("bitcoin_mine_discovery_systems"),
            TestResource::Library(("structure_creation_library", "0_1_18")),
            TestResource::Library(("biome_library", "0_1_13")),
            TestResource::Library(("rng_library", "0_1_16")),
            TestResource::Library(("combat_library", "0_1_14")), TestResource::Event("StoryEvent"),
            TestResource::Event("ExplorerMoveEvent"), TestResource::Event("BattleEvent"),
        ]
            .span(),
    }
}

fn setup(case: felt252) -> PairedWorld {
    setup_game(case, false)
}

fn setup_game(case: felt252, blitz: bool) -> PairedWorld {
    setup_world(case, blitz, !blitz)
}

fn setup_world(case: felt252, blitz: bool, development: bool) -> PairedWorld {
    setup_timed_world(case, blitz, development, 0, if blitz {
        2000
    } else {
        0
    }, 999999)
}
fn setup_timed_world(
    case: felt252,
    blitz: bool,
    development: bool,
    start_settling_at: u64,
    start_main_at: u64,
    end_at: u64,
) -> PairedWorld {
    start_cheat_block_timestamp_global(1800);
    start_cheat_chain_id_global('SN_TEST');
    native_protocol::deploy_submitter(submitter(), authority());
    let account = declare("ParityAccount").unwrap().contract_class();
    let (actor, _) = account.deploy(@array![pair().public_key]).unwrap();
    let (opponent, _) = account.deploy(@array![opponent_pair().public_key]).unwrap();
    let registry = deploy("ParityRegistry", @array![actor.into(), opponent.into()]);
    let season = deploy(
        "SeasonDomain",
        @array![
            authority().into(), submitter().into(), registry.into(), (*account.class_hash).into(),
        ],
    );
    let peers = Peers {
        season,
        map: deploy("MapDomain", @array![authority().into()]),
        structures: deploy("StructuresDomain", @array![authority().into()]),
        troops: deploy("TroopsDomain", @array![authority().into()]),
        settlement: deploy("SettlementDomain", @array![authority().into()]),
        resources: deploy("ResourcesDomain", @array![authority().into()]),
    };
    for address in array![
        peers.season, peers.map, peers.structures, peers.troops, peers.settlement, peers.resources,
    ] {
        start_cheat_caller_address(address, authority());
        IDomainDispatcher { contract_address: address }.configure(peers);
    }
    for address in array![
        peers.season, peers.map, peers.structures, peers.troops, peers.settlement, peers.resources,
    ] {
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
        dev_mode_on: development,
        start_settling_at,
        start_main_at,
        end_at,
        end_grace_seconds: 0,
        registration_grace_seconds: 0,
        final_trial_id: 0,
        seed: 1,
    };
    start_cheat_caller_address(peers.season, authority());
    let mut rules = crate::native_inputs::rules();
    rules.blitz_mode_on = blitz;
    IGameDispatcher { contract_address: peers.season }.create_game(1, game, rules);
    stop_cheat_caller_address(peers.season);
    start_cheat_caller_address(peers.structures, authority());
    start_cheat_caller_address(peers.resources, authority());
    IResourcesDispatcher { contract_address: peers.resources }
        .configure_resources(1, crate::native_inputs::resource_rules());
    stop_cheat_caller_address(peers.resources);
    stop_cheat_caller_address(peers.structures);
    let roots = deploy("ParityRoots", @array![]);
    let mut oracle = spawn_test_world([namespace()].span());
    let mut defs = array![];
    for name in array![
        "alt_movement_systems", "parity_bootstrap_systems", "troop_management_systems",
        "troop_movement_systems", "troop_movement_util_systems", "troop_battle_systems",
        "hyperstructure_discovery_systems", "mine_discovery_systems", "camp_discovery_systems",
        "agent_discovery_systems", "relic_chest_discovery_systems",
        "bitcoin_mine_discovery_systems", "ownership_systems", "name_systems", "structure_systems",
        "blitz_realm_systems", "realm_internal_systems", "realm_systems",
        "hyperstructure_create_systems", "village_systems", "resource_systems",
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
            Model::<
                crate::models::config::ChainConfig,
            >::ptr_from_keys(crate::constants::WORLD_CONFIG_ID),
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
    oracle
        .write_member(
            Model::<WorldConfig>::ptr_from_keys(1_u32), selector!("map_center_offset"), 20_u32,
        );
    oracle
        .write_member(
            Model::<WorldConfig>::ptr_from_keys(1_u32), selector!("blitz_mode_on"), blitz,
        );
    if blitz {
        oracle
            .write_member(
                Model::<
                    crate::models::config::ChainConfig,
                >::ptr_from_keys(crate::constants::WORLD_CONFIG_ID),
                selector!("player_registry_address"),
                registry,
            );
    }

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
        (26, 1000 * RESOURCE_PRECISION), (35, 50000 * RESOURCE_PRECISION),
        (36, 50000 * RESOURCE_PRECISION), (38, 100 * RESOURCE_PRECISION),
    ]
        .span()
}
fn provision(ref worlds: PairedWorld, coord: Coord) -> u32 {
    provision_with_resources(ref worlds, coord, grants())
}
fn provision_with_resources(
    ref worlds: PairedWorld, coord: Coord, initial_resources: Span<(u8, u128)>,
) -> u32 {
    let (address, _) = worlds.oracle.dns(@"parity_bootstrap_systems").unwrap();
    let id = IParityBootstrapDispatcher { contract_address: address }
        .bootstrap(worlds.actor, coord, initial_resources);
    start_cheat_caller_address(worlds.peers.structures, authority());
    let native_id = IStructuresDispatcher { contract_address: worlds.peers.structures }
        .provision_realm(1, worlds.actor, convert(coord), initial_resources);
    stop_cheat_caller_address(worlds.peers.structures);
    assert_eq!(id, native_id);
    id
}
fn execute(worlds: PairedWorld, command: Command, timestamp: u64, root: u256) {
    let (_, succeeded) = execute_outcome(worlds, command, timestamp, root);
    assert!(succeeded, "native gameplay rejected");
}
fn execute_outcome(
    worlds: PairedWorld, command: Command, timestamp: u64, root: u256,
) -> (u64, bool) {
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
    IRecordedExecutionDispatcher { contract_address: worlds.peers.season }
        .execute(intent, context, r, s);
    let succeeded = IRecordedExecutionViewsDispatcher { contract_address: worlds.peers.season }
        .get_result(order)
        .status == 1;
    stop_cheat_caller_address(worlds.peers.season);
    (order, succeeded)
}
fn compare_facts<A, +Observable<A>, +Drop<A>, B, +Observable<B>, +Drop<B>>(
    case: felt252, step: u32, model: felt252, keys: Span<felt252>, native: A, oracle: B,
) {
    let mut native_facts = keys.into();
    native_facts.append_span(native.observe().span());
    let mut oracle_facts = keys.into();
    oracle_facts.append_span(oracle.observe().span());
    let identity = core::poseidon::poseidon_hash_span(keys);
    println!(
        "FACT_SNAPSHOT {} {} {} {} {} {}",
        case,
        step,
        model,
        identity,
        keys.len(),
        native_facts.len(),
    );
    assert_eq!(native_facts.len(), oracle_facts.len(), "observable fact count differs");
    for index in 0..native_facts.len() {
        println!(
            "FACT_VALUE {} {} {} {} {} {} {}",
            case,
            step,
            model,
            identity,
            index,
            *native_facts.at(index),
            *oracle_facts.at(index),
        );
    }
    assert!(native_facts == oracle_facts, "observable facts differ: {} step {}", model, step);
}

fn compare_home(worlds: PairedWorld, step: u32, id: u32) {
    let structures = IStructuresDispatcher { contract_address: worlds.peers.structures };
    let key = ResourceKey { game_id: 1, entity_id: id };
    let mut original: Structure = ModelStorage::read_model(@worlds.oracle, (1, id));
    if original.base.category == 5 {
        let grant: crate::models::structure::VillageTroop = ModelStorage::read_model(
            @worlds.oracle, (1, id),
        );
        original.base.starting_troops_granted = grant.claimed;
    }
    compare_facts(
        worlds.case,
        step,
        'Structure',
        array![1, id.into()].span(),
        structures.structure(key).unwrap(),
        original,
    );
    compare_resources(worlds, step, id);
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
            CreateExplorer {
                structure_id: home,
                category: 0,
                tier: 0,
                amount: 100 * RESOURCE_PRECISION,
                direction: 0,
            },
        ),
        1800,
        101,
    );
    compare_home(worlds, 1, home);
    let explorer = ITroopsDispatcher { contract_address: worlds.peers.troops }
        .explorer(ExplorerKey { game_id: 1, explorer_id: id })
        .unwrap();
    compare_facts(
        worlds.case,
        1,
        'ExplorerTroops',
        array![1, id.into()].span(),
        explorer,
        ModelStorage::<WorldStorage, ExplorerTroops>::read_model(@worlds.oracle, (1, id)),
    );
    compare_resources(worlds, 1, id);
    let tile = world_native::map::IMapDispatcher { contract_address: worlds.peers.map };
    let key = world_native::geometry::tile_key(1, explorer.coord);
    let actual = world_native::map::IMapDispatcherTrait::tile(tile, key).unwrap();
    compare_facts(
        worlds.case,
        1,
        'TileOpt',
        array![1, 0, key.col.into(), key.row.into()].span(),
        actual,
        ModelStorage::<
            WorldStorage, TileOpt,
        >::read_model(@worlds.oracle, (1, false, key.col, key.row)),
    );
}


fn compare_tile(worlds: PairedWorld, step: u32, coord: world_native::troops::Coord) {
    let key = world_native::geometry::tile_key(1, coord);
    let actual = IMapDispatcher { contract_address: worlds.peers.map }
        .tile(key)
        .unwrap_or(world_native::map::TileOpt { data: 0 });
    compare_facts(
        worlds.case,
        step,
        'TileOpt',
        array![1, coord.alt.into(), coord.x.into(), coord.y.into()].span(),
        actual,
        ModelStorage::<
            WorldStorage, TileOpt,
        >::read_model(@worlds.oracle, (1, coord.alt, coord.x, coord.y)),
    );
}
fn compare_explorer(
    worlds: PairedWorld, step: u32, id: u32,
) -> world_native::troops::ExplorerTroops {
    let explorer = ITroopsDispatcher { contract_address: worlds.peers.troops }
        .explorer(ExplorerKey { game_id: 1, explorer_id: id })
        .unwrap();
    compare_facts(
        worlds.case,
        step,
        'ExplorerTroops',
        array![1, id.into()].span(),
        explorer,
        ModelStorage::<WorldStorage, ExplorerTroops>::read_model(@worlds.oracle, (1, id)),
    );
    compare_tile(worlds, step, explorer.coord);
    compare_resources(worlds, step, id);
    explorer
}
fn explore_pair(
    worlds: PairedWorld,
    id: u32,
    direction: u8,
    timestamp: u64,
    root: felt252,
    step: u32,
    expected_occupier: u8,
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
    execute(
        worlds, Command::Explore(Explore { explorer_id: id, direction }), timestamp, root.into(),
    );
    compare_home(worlds, step, explorer.owner);
    compare_explorer(worlds, step, id);
    compare_tile(worlds, step, explorer.coord);
    compare_tile(worlds, step, target);
    let tile = IMapDispatcher { contract_address: worlds.peers.map }
        .tile(world_native::geometry::tile_key(1, target))
        .unwrap();
    assert_eq!((tile.data / 2) % 256, expected_occupier.into());
    let game = IGameDispatcher { contract_address: worlds.peers.season };
    compare_facts(
        worlds.case,
        step,
        'SeasonPrize',
        array![1].span(),
        game.season_points(1),
        ModelStorage::<
            WorldStorage, crate::models::season::SeasonPrize,
        >::read_model(@worlds.oracle, 1_u32),
    );
    compare_facts(
        worlds.case,
        step,
        'PlayerRegisteredPoints',
        array![1, worlds.actor.into()].span(),
        game.player_points(1, worlds.actor),
        ModelStorage::<
            WorldStorage, PlayerRegisteredPoints,
        >::read_model(@worlds.oracle, (1, worlds.actor)),
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
            CreateExplorer {
                structure_id: home,
                category: 0,
                tier: 0,
                amount: 100 * RESOURCE_PRECISION,
                direction: 0,
            },
        ),
        1800,
        101,
    );
    compare_home(worlds, 1, home);
    compare_explorer(worlds, 1, id);
    id
}
fn compare_discovery(
    worlds: PairedWorld, step: u32, coord: world_native::troops::Coord, mine: bool,
) {
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
        compare_facts(
            worlds.case,
            step,
            'Hyperstructure',
            array![1, id.into()].span(),
            structures.hyperstructure(key).unwrap(),
            ModelStorage::<WorldStorage, Hyperstructure>::read_model(@worlds.oracle, (1, id)),
        );
        compare_facts(
            worlds.case,
            step,
            'HyperstructureGlobals',
            array![1].span(),
            structures.hyperstructure_count(1),
            ModelStorage::<WorldStorage, HyperstructureGlobals>::read_model(@worlds.oracle, 1_u32),
        );
    }
    if mine {
        let key = world_native::buildings::BuildingKey {
            game_id: 1,
            alt: coord.alt,
            outer_col: coord.x,
            outer_row: coord.y,
            inner_col: 10,
            inner_row: 10,
        };
        compare_facts(
            worlds.case,
            step,
            'Building',
            array![1, coord.alt.into(), coord.x.into(), coord.y.into(), 10, 10].span(),
            structures.building(key).unwrap(),
            ModelStorage::<
                WorldStorage, Building,
            >::read_model(@worlds.oracle, (1, coord.alt, coord.x, coord.y, 10_u32, 10_u32)),
        );
        compare_facts(
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
    let actual = IStructuresDispatcher { contract_address: worlds.peers.structures }
        .provision_spire(1, convert(spire));
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
    IAltMovementSystemsDispatcher { contract_address: address }
        .toggle_alternate(1, id, convert(direction));
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
    production_settlement_case('production', 1860, 180, false, 1800);
}
#[test]
fn world_parity_production_cap() {
    production_settlement_case('production_cap', 2100, 300, false, 1800);
}
#[test]
fn world_parity_production_capacity() {
    production_settlement_case('production_capacity', 1860, 180, true, 1800);
}
#[test]
fn world_parity_production_activation() {
    production_settlement_case('production_activation', 1860, 60, false, 1840);
}
fn production_settlement_case(
    case: felt252, claim_at: u64, expected_balance: u128, limited: bool, activate_at: u64,
) {
    let mut worlds = setup(case);
    let initial = if limited {
        let capacity = crate::native_inputs::rules().structure_capacity_config.realm_capacity.into()
            * RESOURCE_PRECISION;
        array![(1_u8, capacity / 1000 - 5 * RESOURCE_PRECISION)].span()
    } else {
        grants()
    };
    let home = provision_with_resources(
        ref worlds, Coord { alt: false, x: 2147483626, y: 2147483626 }, initial,
    );
    let (bootstrap, _) = worlds.oracle.dns(@"parity_bootstrap_systems").unwrap();
    let dispatcher = IParityBootstrapDispatcher { contract_address: bootstrap };
    start_cheat_block_timestamp_global(activate_at);
    dispatcher.producer(home, 300 * RESOURCE_PRECISION);
    start_cheat_caller_address(worlds.peers.structures, authority());
    let structures = IStructuresDispatcher { contract_address: worlds.peers.structures };
    let resource_store = IResourcesDispatcher { contract_address: worlds.peers.resources };
    let key = ResourceKey { game_id: 1, entity_id: home };
    structures.provision_producer(key, 300 * RESOURCE_PRECISION);
    stop_cheat_caller_address(worlds.peers.structures);
    compare_home(worlds, 0, home);
    start_cheat_block_timestamp_global(1860);
    let before = resource_snapshot(resource_store, key);
    assert_eq!(before, resource_snapshot(resource_store, key));
    assert_eq!(
        resource_store
            .resource_balance(ResourceSlot { game_id: 1, entity_id: home, resource_type: 24 }),
        0,
    );
    for (step, timestamp) in array![(1_u32, claim_at), (2, claim_at)] {
        start_cheat_block_timestamp_global(timestamp);
        start_cheat_caller_address(bootstrap, worlds.actor);
        dispatcher.claim(home);
        stop_cheat_caller_address(bootstrap);
        execute(worlds, Command::ClaimProduction(home), timestamp, (400 + step).into());
        compare_home(worlds, step, home);
    }
    let slot = ResourceSlot { game_id: 1, entity_id: home, resource_type: 24 };
    assert_eq!(
        resource_store.resource_balance(slot),
        (if limited {
            50
        } else {
            expected_balance
        }) * RESOURCE_PRECISION,
    );
    assert_eq!(
        resource_store.resource_production(slot).output_amount_left,
        (300 - expected_balance) * RESOURCE_PRECISION,
    );
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
            CreateExplorer {
                structure_id: enemy_home,
                category: 0,
                tier: 0,
                amount: RESOURCE_PRECISION,
                direction: 3,
            },
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
    execute(
        worlds, Command::Battle(Battle { attacker_id: attacker, defender_id: defender }), 1920, 501,
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
        !IResourcesDispatcher { contract_address: worlds.peers.resources }
            .has_resource(ResourceKey { game_id: 1, entity_id: defender }),
    );
    let deleted: ExplorerTroops = ModelStorage::<
        WorldStorage, ExplorerTroops,
    >::read_model(@worlds.oracle, (1, defender));
    assert_eq!(deleted.owner, 0, "oracle explorer still has a home");
    assert_eq!(deleted.troops.count, 0, "oracle explorer still has troops");
    compare_resources(worlds, step, defender);
    println!("FACT_DELETE {} {} {} {} {}", worlds.case, step, 'ExplorerTroops', 1, defender);
    println!("FACT_DELETE {} {} {} {} {}", worlds.case, step, 'ResourceWeight', 1, defender);
    compare_tile(worlds, step, before.coord);
}


fn rejected_explore_pair(worlds: PairedWorld, id: u32, direction: u8, timestamp: u64, step: u32) {
    let attempts = IParityAttemptsDispatcher {
        contract_address: deploy("ParityAttempts", @array![]),
    };
    let season = ISeasonDispatcher { contract_address: worlds.peers.season };
    let troops = ITroopsDispatcher { contract_address: worlds.peers.troops };
    let structures = IStructuresDispatcher { contract_address: worlds.peers.structures };
    let resource_store = IResourcesDispatcher { contract_address: worlds.peers.resources };
    let map = IMapDispatcher { contract_address: worlds.peers.map };
    let key = ExplorerKey { game_id: 1, explorer_id: id };
    let before = troops.explorer(key).unwrap();
    let home_key = ResourceKey { game_id: 1, entity_id: before.owner };
    let resource_before = resource_snapshot(resource_store, home_key);
    let home_before = structures.structure(home_key).unwrap();
    let target = world_native::geometry::tile_key(
        1, world_native::geometry::neighbor(before.coord, direction),
    );
    let target_before = map.tile(target);
    let nonce = season.next_nonce(1, worlds.actor);
    start_cheat_block_timestamp_global(timestamp);
    let tx_hash = inject_root(worlds, 1);
    let (movement, _) = worlds.oracle.dns(@"troop_movement_systems").unwrap();
    cheat_caller_address(movement, worlds.actor, CheatSpan::TargetCalls(1));
    assert!(!attempts.explore(movement, id, convert(direction)));
    let intent = native_protocol::action(
        worlds.peers.season,
        worlds.actor,
        Command::Explore(Explore { explorer_id: id, direction }),
        timestamp,
    );
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
    assert_eq!(
        ModelStorage::<WorldStorage, crate::models::rng::RNG>::read_model(@worlds.oracle, tx_hash)
            .seed,
        0,
    );
    assert_eq!(troops.explorer(key).unwrap(), before);
    assert_eq!(resource_snapshot(resource_store, home_key), resource_before);
    assert_eq!(structures.structure(home_key).unwrap(), home_before);
    assert_eq!(map.tile(target), target_before);
    compare_home(worlds, step, before.owner);
    compare_explorer(worlds, step, id);
    compare_tile(
        worlds, step, world_native::troops::Coord { alt: target.alt, x: target.col, y: target.row },
    );
    println!("PARITY_REJECTION {} {} {} {}", worlds.case, step, id, timestamp);
}
#[test]
fn world_parity_rejected_actions_preserve_rows() {
    let mut worlds = setup('rejections');
    let home = provision_with_resources(
        ref worlds,
        Coord { alt: false, x: 2147483626, y: 2147483626 },
        array![(26, 1000 * RESOURCE_PRECISION)].span(),
    );
    let id = create_explorer_pair(worlds, home);
    rejected_explore_pair(worlds, id, 0, 1920, 2);
    rejected_explore_pair(worlds, id, 3, 1920, 3);
    rejected_explore_pair(PairedWorld { actor: worlds.opponent, ..worlds }, id, 0, 1920, 4);
    rejected_explore_pair(worlds, id, 0, 999999, 5);
}
#[starknet::interface]
pub trait IParityAttempts<T> {
    fn settle_season(
        ref self: T, target: ContractAddress, name: felt252, selected: Option<u32>,
    ) -> bool;
    fn settle(
        ref self: T, target: ContractAddress, name: felt252, tokens: Span<u128>, grant: bool,
    ) -> bool;
    fn provision(ref self: T, target: ContractAddress, id: u32) -> bool;
    fn level_up(ref self: T, target: ContractAddress, id: u32) -> bool;
    fn name(ref self: T, target: ContractAddress, name: felt252) -> bool;
    fn ownership(
        ref self: T, target: ContractAddress, selector: felt252, id: u32, owner: ContractAddress,
    ) -> bool;
    fn native(
        ref self: T,
        season: ContractAddress,
        intent: Intent,
        context: ExecutionContext,
        r: felt252,
        s: felt252,
    ) -> bool;
    fn explore(
        ref self: T,
        movement: ContractAddress,
        id: u32,
        direction: crate::models::position::Direction,
    ) -> bool;
}
#[starknet::contract]
mod ParityAttempts {
    use eternum_randomness_protocol::entrypoint::{
        ExecutionContext, IRecordedExecutionSafeDispatcher, IRecordedExecutionSafeDispatcherTrait,
        IRecordedExecutionViewsDispatcher, IRecordedExecutionViewsDispatcherTrait,
    };
    use eternum_randomness_protocol::{Intent, decode_envelope};
    use starknet::ContractAddress;
    use crate::models::position::Direction;
    use crate::systems::combat::contracts::troop_movement::{
        ITroopMovementSystemsSafeDispatcher, ITroopMovementSystemsSafeDispatcherTrait,
    };
    #[storage]
    struct Storage {}
    #[abi(embed_v0)]
    impl Attempts of super::IParityAttempts<ContractState> {
        fn settle_season(
            ref self: ContractState, target: ContractAddress, name: felt252, selected: Option<u32>,
        ) -> bool {
            let mut args = array![1, name];
            let entrypoint = match selected {
                Some(realm_id) => {
                    args.append(realm_id.into());
                    selector!("settle_dev")
                },
                None => selector!("settle"),
            };
            starknet::syscalls::call_contract_syscall(target, entrypoint, args.span()).is_ok()
        }
        fn settle(
            ref self: ContractState,
            target: ContractAddress,
            name: felt252,
            tokens: Span<u128>,
            grant: bool,
        ) -> bool {
            let mut args = array![1, name];
            tokens.serialize(ref args);
            grant.serialize(ref args);
            starknet::syscalls::call_contract_syscall(target, selector!("settle"), args.span())
                .is_ok()
        }
        fn provision(ref self: ContractState, target: ContractAddress, id: u32) -> bool {
            starknet::syscalls::call_contract_syscall(
                target, selector!("provision_realm"), array![1, id.into()].span(),
            )
                .is_ok()
        }
        fn level_up(ref self: ContractState, target: ContractAddress, id: u32) -> bool {
            starknet::syscalls::call_contract_syscall(
                target, selector!("level_up"), array![1, id.into()].span(),
            )
                .is_ok()
        }
        fn name(ref self: ContractState, target: ContractAddress, name: felt252) -> bool {
            starknet::syscalls::call_contract_syscall(
                target, selector!("set_address_name"), array![1, name].span(),
            )
                .is_ok()
        }
        fn ownership(
            ref self: ContractState,
            target: ContractAddress,
            selector: felt252,
            id: u32,
            owner: ContractAddress,
        ) -> bool {
            starknet::syscalls::call_contract_syscall(
                target, selector, array![1, id.into(), owner.into()].span(),
            )
                .is_ok()
        }
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
            IRecordedExecutionSafeDispatcher { contract_address: season }
                .execute(intent, context, r, s)
                .is_ok()
                && IRecordedExecutionViewsDispatcher { contract_address: season }
                    .get_result(order)
                    .status == 1
        }
        #[feature("safe_dispatcher")]
        fn explore(
            ref self: ContractState, movement: ContractAddress, id: u32, direction: Direction,
        ) -> bool {
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
    execute(
        worlds, Command::Move(Move { explorer_id: id, directions: array![3].span() }), 2280, 301,
    );
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
    fn bootstrap(
        ref self: T, actor: ContractAddress, coord: Coord, grants: Span<(u8, u128)>,
    ) -> u32;
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
    use crate::models::resource::resource::{
        ResourceWeightImpl, SingleResourceStoreImpl, WeightStoreImpl,
    };
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
            let mut resource = SingleResourceStoreImpl::retrieve(
                ref world, 1, id, 24, ref weight, unit_weight, true,
            );
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
                starknet::get_caller_address() == StructureOwnerStoreImpl::retrieve(
                    ref world, 1, id,
                ),
                "actor does not own structure",
            );
            let mut weight = WeightStoreImpl::retrieve(ref world, 1, id);
            for resource_type in 1_u8..59 {
                if resource_type < 39 || resource_type > 56 {
                    let unit_weight = ResourceWeightImpl::grams(ref world, 1, resource_type);
                    SingleResourceStoreImpl::retrieve(
                        ref world, 1, id, resource_type, ref weight, unit_weight, true,
                    );
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
        fn bootstrap(
            ref self: ContractState, actor: ContractAddress, coord: Coord, grants: Span<(u8, u128)>,
        ) -> u32 {
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

fn set_native_fixture<T, +starknet::storage_access::Store<T>, +Drop<T>>(
    address: ContractAddress, name: felt252, keys: Span<felt252>, value: T,
) {
    let base = starknet::storage_access::storage_base_address_from_felt252(
        snforge_std::map_entry_address(name, keys),
    );
    // ABI serialization does not describe packed persistent storage.
    snforge_std::interact_with_state(
        address, || starknet::storage_access::Store::<T>::write(0, base, value).unwrap(),
    );
}

fn ownership_rules(ref worlds: PairedWorld, blitz: bool, faith: bool, controller: ContractAddress) {
    let mut rules = crate::native_inputs::rules();
    rules.blitz_mode_on = blitz;
    rules.faith_enabled = faith;
    start_cheat_caller_address(worlds.peers.season, authority());
    (ISeasonDispatcher { contract_address: worlds.peers.season }).set_agent_controller(controller);
    stop_cheat_caller_address(worlds.peers.season);
    set_native_fixture(worlds.peers.season, selector!("rules"), array![1].span(), rules);
    let mut preset: PresetConfig = worlds.oracle.read_model(1_u32);
    preset.faith_config.enabled = faith;
    worlds.oracle.write_model_test(@preset);
    worlds
        .oracle
        .write_member(
            Model::<WorldConfig>::ptr_from_keys(1_u32), selector!("blitz_mode_on"), blitz,
        );
    worlds
        .oracle
        .write_member(
            Model::<
                crate::models::config::ChainConfig,
            >::ptr_from_keys(crate::constants::WORLD_CONFIG_ID),
            selector!("agent_controller_config"),
            crate::models::config::AgentControllerConfig { address: controller },
        );
}

fn transfer(
    ref worlds: PairedWorld, id: u32, owner: ContractAddress, agent: bool, now: u64, succeeds: bool,
) {
    start_cheat_block_timestamp_global(now);
    let (address, _) = worlds.oracle.dns(@"ownership_systems").unwrap();
    start_cheat_caller_address(address, worlds.actor);
    let selector = if agent {
        selector!("transfer_agent_ownership")
    } else {
        selector!("transfer_structure_ownership")
    };
    let attempts = IParityAttemptsDispatcher {
        contract_address: deploy("ParityAttempts", @array![]),
    };
    assert_eq!(
        attempts.ownership(address, selector, id, owner), succeeds, "oracle ownership outcome",
    );
    stop_cheat_caller_address(address);
    let value = world_native::ownership::TransferOwnership { entity_id: id, new_owner: owner };
    let command = if agent {
        Command::TransferAgentOwnership(value)
    } else {
        Command::TransferStructureOwnership(value)
    };
    let (order, outcome) = execute_outcome(worlds, command, now, 1234);
    assert_eq!(outcome, succeeds, "native ownership outcome");
    let action = if agent {
        'agent_transfer'
    } else {
        'structure_transfer'
    };
    println!("FACT_ACTION {} {} {} {} {}", worlds.case, order, action, now, outcome);
}

fn compare_ownership(worlds: PairedWorld, step: u32, id: u32) {
    compare_home(worlds, step, id);
    let faith = world_native::ownership::IFaithOwnershipViewsDispatcher {
        contract_address: worlds.peers.structures,
    };
    let key = ResourceKey { game_id: 1, entity_id: id };
    compare_facts(
        worlds.case,
        step,
        'WonderFaith',
        array![1, id.into()].span(),
        faith.wonder_faith(key),
        ModelStorage::<
            WorldStorage, crate::models::faith::WonderFaith,
        >::read_model(@worlds.oracle, (1, id)),
    );
    compare_facts(
        worlds.case,
        step,
        'FaithfulStructure',
        array![1, id.into()].span(),
        faith.faithful_structure(key),
        ModelStorage::<
            WorldStorage, crate::models::faith::FaithfulStructure,
        >::read_model(@worlds.oracle, (1, id)),
    );
    compare_facts(
        worlds.case,
        step,
        'WonderFaithWinners',
        array![1].span(),
        faith.wonder_faith_winners(1),
        ModelStorage::<
            WorldStorage, crate::models::faith::WonderFaithWinners,
        >::read_model(@worlds.oracle, 1_u32),
    );
    for owner in array![worlds.actor, worlds.opponent] {
        for wonder in array![id, 999] {
            compare_facts(
                worlds.case,
                step,
                'PlayerFaithPoints',
                array![1, owner.into(), wonder.into()].span(),
                faith
                    .player_faith_points(
                        world_native::ownership::PlayerFaithKey {
                            game_id: 1, player: owner, wonder_id: wonder,
                        },
                    ),
                ModelStorage::<
                    WorldStorage, crate::models::faith::PlayerFaithPoints,
                >::read_model(@worlds.oracle, (1, owner, wonder)),
            );
        }
    }
}

fn prepare_faith(ref worlds: PairedWorld, id: u32) {
    let wonder = WonderFaith {
        last_recorded_owner: worlds.actor,
        claimed_points: 0,
        claim_per_sec: 500,
        claim_last_at: 1800,
        owner_claim_per_sec: 100,
        num_structures_pledged: 1,
    };
    let pledge = FaithfulStructure {
        wonder_id: 999,
        faithful_since: 1800,
        fp_to_wonder_owner_per_sec: 70,
        fp_to_struct_owner_per_sec: 30,
        last_recorded_owner: worlds.actor,
    };
    set_native_fixture(
        worlds.peers.structures, selector!("faith_wonders"), array![1, id.into()].span(), wonder,
    );
    set_native_fixture(
        worlds.peers.structures, selector!("faith_pledges"), array![1, id.into()].span(), pledge,
    );
    worlds
        .oracle
        .write_model_test(
            @crate::models::faith::WonderFaith {
                game_id: 1,
                wonder_id: id,
                last_recorded_owner: worlds.actor,
                claimed_points: 0,
                claim_per_sec: 500,
                claim_last_at: 1800,
                owner_claim_per_sec: 100,
                num_structures_pledged: 1,
            },
        );
    worlds
        .oracle
        .write_model_test(
            @crate::models::faith::FaithfulStructure {
                game_id: 1,
                structure_id: id,
                wonder_id: 999,
                faithful_since: 1800,
                fp_to_wonder_owner_per_sec: 70,
                fp_to_struct_owner_per_sec: 30,
                last_recorded_owner: worlds.actor,
            },
        );
    for (wonder_id, owner_rate, pledger_rate) in array![(id, 100_u32, 0_u32), (999, 0, 30)] {
        let points = PlayerFaithPoints {
            points_claimed: 0,
            points_per_sec_as_owner: owner_rate,
            points_per_sec_as_pledger: pledger_rate,
            last_updated_at: 1800,
        };
        set_native_fixture(
            worlds.peers.structures,
            selector!("faith_players"),
            array![1, worlds.actor.into(), wonder_id.into()].span(),
            points,
        );
        worlds
            .oracle
            .write_model_test(
                @crate::models::faith::PlayerFaithPoints {
                    game_id: 1,
                    player: worlds.actor,
                    wonder_id,
                    points_claimed: 0,
                    points_per_sec_as_owner: owner_rate,
                    points_per_sec_as_pledger: pledger_rate,
                    last_updated_at: 1800,
                },
            );
    }
}

#[test]
fn world_parity_ownership() {
    let mut worlds = setup('ownership');
    let coord = Coord { alt: false, x: 2147483626, y: 2147483626 };
    let home = provision(ref worlds, coord);
    ownership_rules(ref worlds, false, true, worlds.actor);
    compare_ownership(worlds, 0, home);
    transfer(ref worlds, home, worlds.actor, false, 1800, true);
    compare_ownership(worlds, 1, home);
    transfer(ref worlds, home, 0.try_into().unwrap(), false, 1800, false);
    compare_ownership(worlds, 2, home);
    ownership_rules(ref worlds, true, true, worlds.actor);
    transfer(ref worlds, home, worlds.opponent, false, 1800, false);
    compare_ownership(worlds, 3, home);
    ownership_rules(ref worlds, false, true, worlds.actor);
    prepare_faith(ref worlds, home);
    compare_ownership(worlds, 4, home);
    transfer(ref worlds, home, worlds.opponent, false, 1860, true);
    compare_ownership(worlds, 5, home);
    transfer(ref worlds, home, worlds.actor, false, 1900, false);
    compare_ownership(worlds, 6, home);
    let owner = worlds.actor;
    worlds.actor = worlds.opponent;
    worlds.opponent = owner;
    transfer(ref worlds, home, worlds.opponent, false, 1920, true);
    compare_ownership(worlds, 7, home);
    for (step, recipient) in array![(8, worlds.opponent), (9, 0.try_into().unwrap())] {
        ownership_rules(ref worlds, false, true, worlds.actor);
        transfer(ref worlds, 54321, recipient, true, 1920, true);
        compare_ownership(worlds, step, home);
        let agents = world_native::ownership::IAgentOwnershipDispatcher {
            contract_address: worlds.peers.troops,
        };
        compare_facts(
            worlds.case,
            step,
            'AgentOwner',
            array![1, 54321].span(),
            agents.agent_owner(1, 54321),
            ModelStorage::<
                WorldStorage, crate::models::agent::AgentOwner,
            >::read_model(@worlds.oracle, (1, 54321)),
        );
        assert_eq!(agents.agent_owner(2, 54321), 0.try_into().unwrap());
    }
    transfer(ref worlds, home, worlds.actor, false, 999999, false);
    compare_ownership(worlds, 10, home);
}

fn ownership_category(ref worlds: PairedWorld, id: u32, category: u8) {
    let mut structure: Structure = worlds.oracle.read_model((1, id));
    structure.base.category = category;
    structure.category = category;
    worlds.oracle.write_model_test(@structure);
    let mut native = (IStructuresDispatcher { contract_address: worlds.peers.structures })
        .structure(ResourceKey { game_id: 1, entity_id: id })
        .unwrap();
    native.base.category = category;
    set_native_fixture(
        worlds.peers.structures,
        selector!("structures"),
        array![1, id.into()].span(),
        world_native::structures::StructureRecord {
            owner: native.owner,
            base: native.base,
            troop_guards: native.troop_guards,
            resources_packed: native.resources_packed,
            metadata: native.metadata,
        },
    );
}

#[test]
fn world_parity_ownership_rejections() {
    let mut worlds = setup('ownership_rejections');
    let home = provision(ref worlds, Coord { alt: false, x: 2147483626, y: 2147483626 });
    ownership_rules(ref worlds, false, true, worlds.opponent);
    transfer(ref worlds, 99, worlds.opponent, true, 1800, false);
    compare_ownership(worlds, 1, home);
    let direct = starknet::syscalls::call_contract_syscall(
        worlds.peers.structures,
        selector!("transfer_structure_ownership"),
        array![1, worlds.actor.into(), home.into(), worlds.opponent.into(), 1234, 0, 1800].span(),
    );
    assert!(direct.is_err(), "foreign domain transferred ownership");
    compare_ownership(worlds, 2, home);
    ownership_category(ref worlds, home, 5);
    transfer(ref worlds, home, worlds.opponent, false, 1800, false);
    compare_ownership(worlds, 3, home);
    ownership_category(ref worlds, home, 1);
    let mut game: GameRegistry = worlds.oracle.read_model(1_u32);
    game.dev_mode_on = false;
    game.start_settling_at = 1900;
    game.start_main_at = 2000;
    worlds.oracle.write_model_test(@game);
    set_native_fixture(
        worlds.peers.season,
        selector!("games"),
        array![1].span(),
        world_native::game::GameRegistry {
            name: game.name,
            series_id: game.series_id,
            game_number_in_series: game.game_number_in_series,
            preset_id: game.preset_id,
            creator: game.creator,
            status: convert(game.status),
            dev_mode_on: game.dev_mode_on,
            start_settling_at: game.start_settling_at,
            start_main_at: game.start_main_at,
            end_at: game.end_at,
            end_grace_seconds: game.end_grace_seconds,
            registration_grace_seconds: game.registration_grace_seconds,
            final_trial_id: game.final_trial_id,
            seed: game.seed,
        },
    );
    transfer(ref worlds, home, worlds.opponent, false, 1999, false);
    compare_ownership(worlds, 4, home);
    transfer(ref worlds, home, worlds.opponent, false, 2000, true);
    compare_ownership(worlds, 5, home);
    let owner = worlds.actor;
    worlds.actor = worlds.opponent;
    worlds.opponent = owner;
    transfer(ref worlds, home, worlds.opponent, false, game.end_at - 1, true);
    compare_ownership(worlds, 6, home);
    worlds.opponent = worlds.actor;
    worlds.actor = owner;
    transfer(ref worlds, home, worlds.actor, false, game.end_at, false);
    compare_ownership(worlds, 7, home);
}

#[test]
fn world_parity_ownership_faith() {
    let mut worlds = setup('ownership_faith');
    let home = provision(ref worlds, Coord { alt: false, x: 2147483626, y: 2147483626 });
    ownership_rules(ref worlds, false, true, worlds.actor);
    prepare_faith(ref worlds, home);
    worlds
        .oracle
        .write_model_test(
            @crate::models::faith::WonderFaithWinners {
                game_id: 1, high_score: 30000, wonder_ids: array![999],
            },
        );
    set_native_fixture(
        worlds.peers.structures, selector!("faith_high_scores"), array![1].span(), 30000_u128,
    );
    set_native_fixture(
        worlds.peers.structures, selector!("faith_winner_counts"), array![1].span(), 1_u32,
    );
    set_native_fixture(
        worlds.peers.structures, selector!("faith_winner_ids"), array![1, 0].span(), 999_u32,
    );
    transfer(ref worlds, home, worlds.opponent, false, 1860, true);
    compare_ownership(worlds, 1, home);
    let mut wonder: crate::models::faith::WonderFaith = worlds.oracle.read_model((1, home));
    wonder.claim_per_sec = 0;
    worlds.oracle.write_model_test(@wonder);
    set_native_fixture(
        worlds.peers.structures,
        selector!("faith_wonders"),
        array![1, home.into()].span(),
        WonderFaith {
            last_recorded_owner: wonder.last_recorded_owner,
            claimed_points: wonder.claimed_points,
            claim_per_sec: wonder.claim_per_sec,
            claim_last_at: wonder.claim_last_at,
            owner_claim_per_sec: wonder.owner_claim_per_sec,
            num_structures_pledged: wonder.num_structures_pledged,
        },
    );
    let owner = worlds.actor;
    worlds.actor = worlds.opponent;
    worlds.opponent = owner;
    transfer(ref worlds, home, worlds.opponent, false, 1920, true);
    compare_ownership(worlds, 2, home);
    worlds.opponent = worlds.actor;
    worlds.actor = owner;
    ownership_rules(ref worlds, false, false, worlds.actor);
    transfer(ref worlds, home, worlds.opponent, false, 1980, true);
    compare_ownership(worlds, 3, home);
    // A late pledge-rate underflow must undo wonder accrual, winner updates and history.
    let owner = worlds.actor;
    worlds.actor = worlds.opponent;
    worlds.opponent = owner;
    ownership_rules(ref worlds, false, true, worlds.actor);
    prepare_faith(ref worlds, home);
    let mut points: crate::models::faith::PlayerFaithPoints = worlds
        .oracle
        .read_model((1, worlds.actor, 999));
    points.points_per_sec_as_pledger = 0;
    worlds.oracle.write_model_test(@points);
    set_native_fixture(
        worlds.peers.structures,
        selector!("faith_players"),
        array![1, worlds.actor.into(), 999].span(),
        PlayerFaithPoints {
            points_claimed: points.points_claimed,
            points_per_sec_as_owner: points.points_per_sec_as_owner,
            points_per_sec_as_pledger: points.points_per_sec_as_pledger,
            last_updated_at: points.last_updated_at,
        },
    );
    transfer(ref worlds, home, worlds.opponent, false, 2040, false);
    compare_ownership(worlds, 4, home);
}

#[test]
fn world_parity_projection_ignores_storage_bookkeeping() {
    let native = WonderFaith {
        last_recorded_owner: 0.try_into().unwrap(),
        claimed_points: 100,
        claim_per_sec: 20,
        claim_last_at: 1800,
        owner_claim_per_sec: 5,
        num_structures_pledged: 2,
    };
    let oracle = crate::models::faith::WonderFaith {
        game_id: 77,
        wonder_id: 99,
        last_recorded_owner: 0x123.try_into().unwrap(),
        claimed_points: 100,
        claim_per_sec: 20,
        claim_last_at: 1800,
        owner_claim_per_sec: 5,
        num_structures_pledged: 2,
    };
    assert_eq!(native.observe(), oracle.observe());
    let changed = WonderFaith { claimed_points: 101, ..native };
    assert!(
        changed.observe() != oracle.observe(),
        "changed player points must change the fact projection",
    );
}


fn compare_name(worlds: PairedWorld, step: u32, address: ContractAddress) {
    let oracle: crate::models::name::AddressName = worlds
        .oracle
        .read_model(Into::<ContractAddress, felt252>::into(address));
    compare_facts(
        worlds.case,
        step,
        'AddressName',
        array![address.into()].span(),
        INamesDispatcher { contract_address: worlds.peers.structures }.address_name(address),
        oracle,
    );
}

fn rename(ref worlds: PairedWorld, step: u32, home: u32, name: felt252, now: u64, succeeds: bool) {
    start_cheat_block_timestamp_global(now);
    let (address, _) = worlds.oracle.dns(@"name_systems").unwrap();
    start_cheat_caller_address(address, worlds.actor);
    let attempts = IParityAttemptsDispatcher {
        contract_address: deploy("ParityAttempts", @array![]),
    };
    assert_eq!(attempts.name(address, name), succeeds, "oracle name outcome");
    stop_cheat_caller_address(address);
    let command = Command::SetAddressName(
        world_native::names::SetAddressName { owned_structure_id: home, name },
    );
    let (order, outcome) = execute_outcome(worlds, command, now, 1234);
    assert_eq!(outcome, succeeds, "native name outcome");
    println!("FACT_ACTION {} {} {} {} {}", worlds.case, order, 'set_address_name', now, outcome);
    compare_name(worlds, step, worlds.actor);
    compare_name(worlds, step, worlds.opponent);
    compare_home(worlds, step, home);
}

#[test]
#[feature("safe_dispatcher")]
fn world_parity_name() {
    let mut worlds = setup('name');
    let home = provision(ref worlds, Coord { alt: false, x: 2147483626, y: 2147483626 });
    let commands = INamesSafeDispatcher { contract_address: worlds.peers.structures };
    let name = world_native::names::SetAddressName { owned_structure_id: home, name: 'forged' };
    let context = world_native::commands::ExecutionContext { raw_root: 1234, timestamp: 1800 };
    start_cheat_caller_address(worlds.peers.structures, worlds.actor);
    assert!(
        commands.set_address_name(1, worlds.actor, name, context).is_err(),
        "direct player call accepted",
    );
    start_cheat_caller_address(worlds.peers.structures, worlds.peers.season);
    assert!(
        commands.set_address_name(2, worlds.actor, name, context).is_err(),
        "foreign-game ownership accepted",
    );
    stop_cheat_caller_address(worlds.peers.structures);
    compare_name(worlds, 0, worlds.actor);
    rename(ref worlds, 1, home, 'Explorer', 1800, true);
    rename(ref worlds, 2, home, 'New name', 1800, true);
    rename(ref worlds, 3, home, 0, 1800, true);
    let owner = worlds.actor;
    worlds.actor = worlds.opponent;
    worlds.opponent = owner;
    rename(ref worlds, 4, home, 'Denied', 1800, false);
    worlds.opponent = worlds.actor;
    worlds.actor = owner;
    rename(ref worlds, 5, home, 'After end', 1000000, true);
}

fn upgrade_pair(ref worlds: PairedWorld, step: u32, home: u32, now: u64, succeeds: bool) {
    start_cheat_block_timestamp_global(now);
    let (target, _) = worlds.oracle.dns(@"structure_systems").unwrap();
    start_cheat_caller_address(target, worlds.actor);
    let attempts = IParityAttemptsDispatcher {
        contract_address: deploy("ParityAttempts", @array![]),
    };
    assert_eq!(attempts.level_up(target, home), succeeds, "oracle upgrade outcome");
    stop_cheat_caller_address(target);
    let (order, outcome) = execute_outcome(worlds, Command::LevelUp(home), now, 1234);
    assert_eq!(outcome, succeeds, "native upgrade outcome");
    println!("FACT_ACTION {} {} {} {} {}", worlds.case, order, 'level_up', now, outcome);
    compare_home(worlds, step, home);
    let preset: PresetConfig = worlds.oracle.read_model(1_u32);
    let rules = IUpgradeRulesDispatcher { contract_address: worlds.peers.season };
    compare_facts(
        worlds.case,
        step,
        'UpgradeLimits',
        array![1].span(),
        rules.upgrade_limits(1),
        preset.structure_max_level_config,
    );
    for level in 1_u8..4 {
        compare_facts(
            worlds.case,
            step,
            'UpgradeRecipe',
            array![1, level.into()].span(),
            rules.upgrade_recipe(1, level),
            OracleUpgradeRecipe { world: worlds.oracle, game_id: 1, level },
        );
    }
    let structure = IStructuresDispatcher { contract_address: worlds.peers.structures }
        .structure(ResourceKey { game_id: 1, entity_id: home })
        .unwrap();
    compare_tile(
        worlds,
        step,
        world_native::troops::Coord {
            alt: false, x: structure.base.coord_x, y: structure.base.coord_y,
        },
    );
}

#[test]
fn world_parity_structure() {
    let mut worlds = setup('structure');
    configure_upgrades(ref worlds);
    let poor = provision_with_resources(
        ref worlds,
        Coord { alt: false, x: 2147483626, y: 2147483626 },
        array![
            (23, 100000 * RESOURCE_PRECISION), (35, 100000 * RESOURCE_PRECISION),
            (36, 100000 * RESOURCE_PRECISION),
        ]
            .span(),
    );
    let home = provision_with_resources(
        ref worlds,
        Coord { alt: false, x: 2147483628, y: 2147483626 },
        array![
            (23, 100000 * RESOURCE_PRECISION), (35, 100000 * RESOURCE_PRECISION),
            (36, 100000 * RESOURCE_PRECISION), (38, 100000 * RESOURCE_PRECISION),
            (2, 100000 * RESOURCE_PRECISION), (3, 100000 * RESOURCE_PRECISION),
            (4, 100000 * RESOURCE_PRECISION),
        ]
            .span(),
    );
    let owner = worlds.actor;
    worlds.actor = worlds.opponent;
    upgrade_pair(ref worlds, 1, poor, 1800, false);
    worlds.actor = owner;
    upgrade_pair(ref worlds, 2, poor, 1800, false);
    upgrade_pair(ref worlds, 3, home, 1800, true);
    upgrade_pair(ref worlds, 4, home, 1800, true);
    upgrade_pair(ref worlds, 5, home, 1800, true);
    upgrade_pair(ref worlds, 6, home, 1800, false);
    upgrade_pair(ref worlds, 7, home, 1000000, false);
}

fn configure_upgrades(ref worlds: PairedWorld) {
    crate::native_inputs::configure_upgrade_rows(ref worlds.oracle);
    start_cheat_caller_address(worlds.peers.season, authority());
    let preset: PresetConfig = worlds.oracle.read_model(1_u32);
    let limits = preset.structure_max_level_config;
    IUpgradeRulesDispatcher { contract_address: worlds.peers.season }
        .configure_upgrades(
            1,
            UpgradeLimits { realm_max: limits.realm_max, village_max: limits.village_max },
            crate::native_inputs::upgrade_recipes(),
        );
    stop_cheat_caller_address(worlds.peers.season);
}

#[test]
#[feature("safe_dispatcher")]
fn world_parity_structure_rejections() {
    let mut worlds = setup('structure_rejections');
    configure_upgrades(ref worlds);
    let home = provision_with_resources(
        ref worlds,
        Coord { alt: false, x: 2147483626, y: 2147483626 },
        array![
            (23, 100000 * RESOURCE_PRECISION), (35, 100000 * RESOURCE_PRECISION),
            (36, 100000 * RESOURCE_PRECISION), (38, 100000 * RESOURCE_PRECISION),
        ]
            .span(),
    );
    let commands = IStructureUpgradesSafeDispatcher { contract_address: worlds.peers.structures };
    let context = world_native::commands::ExecutionContext { raw_root: 1, timestamp: 1800 };
    start_cheat_caller_address(worlds.peers.structures, worlds.actor);
    assert!(
        commands.level_up(1, worlds.actor, home, context).is_err(),
        "direct player upgrade accepted",
    );
    start_cheat_caller_address(worlds.peers.structures, worlds.peers.season);
    assert!(
        commands.level_up(2, worlds.actor, home, context).is_err(), "foreign-game upgrade accepted",
    );
    stop_cheat_caller_address(worlds.peers.structures);
    ownership_category(ref worlds, home, 2);
    upgrade_pair(ref worlds, 1, home, 1800, false);
    ownership_category(ref worlds, home, 5);
    upgrade_pair(ref worlds, 2, home, 1800, false);
    ownership_category(ref worlds, home, 1);
    let mut game: GameRegistry = worlds.oracle.read_model(1_u32);
    game.dev_mode_on = false;
    game.start_main_at = 2000;
    worlds.oracle.write_model_test(@game);
    set_native_fixture(
        worlds.peers.season,
        selector!("games"),
        array![1].span(),
        world_native::game::GameRegistry {
            name: game.name,
            series_id: game.series_id,
            game_number_in_series: game.game_number_in_series,
            preset_id: game.preset_id,
            creator: game.creator,
            status: convert(game.status),
            dev_mode_on: false,
            start_settling_at: game.start_settling_at,
            start_main_at: game.start_main_at,
            end_at: game.end_at,
            end_grace_seconds: game.end_grace_seconds,
            registration_grace_seconds: game.registration_grace_seconds,
            final_trial_id: game.final_trial_id,
            seed: game.seed,
        },
    );
    upgrade_pair(ref worlds, 3, home, 1999, false);
    let mut structure: Structure = worlds.oracle.read_model((1, home));
    structure.metadata.has_wonder = true;
    worlds.oracle.write_model_test(@structure);
    let mut native = IStructuresDispatcher { contract_address: worlds.peers.structures }
        .structure(ResourceKey { game_id: 1, entity_id: home })
        .unwrap();
    native.metadata.has_wonder = true;
    set_native_fixture(
        worlds.peers.structures,
        selector!("structures"),
        array![1, home.into()].span(),
        world_native::structures::StructureRecord {
            owner: native.owner,
            base: native.base,
            troop_guards: native.troop_guards,
            resources_packed: native.resources_packed,
            metadata: native.metadata,
        },
    );
    upgrade_pair(ref worlds, 4, home, 2000, true);
}

fn resource_snapshot(resource_store: IResourcesDispatcher, key: ResourceKey) -> Array<felt252> {
    let mut values = array![];
    resource_store.resource_weight(key).serialize(ref values);
    for resource_type in 1_u8..59 {
        let slot = ResourceSlot { game_id: key.game_id, entity_id: key.entity_id, resource_type };
        resource_store.resource_balance(slot).serialize(ref values);
        if resource_type < 39 || resource_type > 56 {
            resource_store.resource_production(slot).serialize(ref values);
        }
    }
    values
}

fn compare_resources(worlds: PairedWorld, step: u32, id: u32) {
    let resource_store = IResourcesDispatcher { contract_address: worlds.peers.resources };
    let key = ResourceKey { game_id: 1, entity_id: id };
    let present = resource_store.has_resource(key);
    let mut oracle = worlds.oracle;
    let weight = if present {
        resource_store.resource_weight(key)
    } else {
        Default::default()
    };
    compare_facts(
        worlds.case,
        step,
        'ResourceWeight',
        array![1, id.into()].span(),
        weight,
        crate::models::resource::resource::ResourceImpl::read_weight(ref oracle, 1, id),
    );
    for resource_type in 1_u8..59 {
        let slot = ResourceSlot { game_id: 1, entity_id: id, resource_type };
        let keys = array![1, id.into(), resource_type.into()].span();
        let balance = if present {
            resource_store.resource_balance(slot)
        } else {
            0
        };
        compare_facts(
            worlds.case,
            step,
            'ResourceBalance',
            keys,
            balance,
            crate::models::resource::resource::ResourceImpl::read_balance(
                ref oracle, 1, id, resource_type,
            ),
        );
        if (resource_type < 39 || resource_type > 56) && resource_type != 37 {
            let production = if present {
                resource_store.resource_production(slot)
            } else {
                Default::default()
            };
            compare_facts(
                worlds.case,
                step,
                'ResourceProduction',
                keys,
                production,
                crate::models::resource::resource::ResourceImpl::read_production(
                    ref oracle, 1, id, resource_type,
                ),
            );
        }
    }
}


mod settlement;

#[test]
#[feature("safe_dispatcher")]
fn world_parity_blitz_settlement() {
    settlement::settlement();
}

#[test]
#[feature("safe_dispatcher")]
fn world_parity_blitz_reservations() {
    settlement::reservations();
}

#[test]
#[feature("safe_dispatcher")]
fn world_parity_blitz_entry_rejections() {
    settlement::entry_rejections();
}

#[test]
#[feature("safe_dispatcher")]
fn world_parity_blitz_cosmetics() {
    settlement::cosmetics();
}

#[test]
#[feature("safe_dispatcher")]
fn world_parity_blitz_settlement_modes() {
    settlement::settlement_modes(
        world_native::settlement::SettlementMode::Triple, 'blitz_settlement_modes',
    );
}

#[test]
#[feature("safe_dispatcher")]
fn world_parity_blitz_entry_ledger() {
    settlement::entry_ledger();
}

#[test]
#[feature("safe_dispatcher")]
fn world_parity_blitz_cosmetics_disabled() {
    settlement::cosmetics_disabled();
}

#[test]
#[feature("safe_dispatcher")]
fn world_parity_blitz_settlement_duel() {
    settlement::settlement_modes(
        world_native::settlement::SettlementMode::Duel, 'blitz_settlement_duel',
    );
}

#[test]
#[feature("safe_dispatcher")]
fn world_parity_blitz_settlement_displacement() {
    settlement::displacement(false, false, 'blitz_settlement_displacement');
}

#[test]
#[feature("safe_dispatcher")]
fn world_parity_blitz_settlement_blocked() {
    settlement::displacement(true, false, 'blitz_settlement_blocked');
}

#[test]
#[feature("safe_dispatcher")]
fn world_parity_blitz_settlement_agent_blocked() {
    settlement::displacement(true, true, 'blitz_settlement_agent_blocked');
}

#[test]
#[feature("safe_dispatcher")]
fn world_parity_blitz_settlement_occupied() {
    settlement::occupied();
}

mod season_settlement;

#[test]
#[feature("safe_dispatcher")]
fn world_parity_season_settlement() {
    season_settlement::settlement();
}

#[test]
#[feature("safe_dispatcher")]
fn world_parity_season_settlement_dev() {
    season_settlement::development();
}

#[test]
#[feature("safe_dispatcher")]
fn world_parity_season_settlement_ledger() {
    season_settlement::ledger();
}

#[test]
#[feature("safe_dispatcher")]
fn world_parity_season_settlement_rejections() {
    season_settlement::rejections();
}

#[test]
#[feature("safe_dispatcher")]
fn world_parity_season_settlement_occupied() {
    season_settlement::occupied_candidates('season_settlement_occupied', 6, true);
}

#[test]
fn world_parity_canonical_realm_traits() {
    season_settlement::canonical_traits();
}

#[test]
#[feature("safe_dispatcher")]
fn world_parity_realm_allocation() {
    season_settlement::allocation();
}

#[test]
#[feature("safe_dispatcher")]
fn world_parity_season_ledger_pass() {
    season_settlement::invalid_ledger('season_ledger_pass', 0, 3, false);
}

#[test]
#[feature("safe_dispatcher")]
fn world_parity_season_ledger_order() {
    season_settlement::invalid_ledger('season_ledger_order', 1, 17, false);
}

#[test]
#[feature("safe_dispatcher")]
fn world_parity_season_ledger_empty() {
    season_settlement::invalid_ledger('season_ledger_empty', 1, 3, true);
}

#[test]
#[feature("safe_dispatcher")]
fn world_parity_season_wrong_mode() {
    season_settlement::wrong_mode();
}

#[test]
#[feature("safe_dispatcher")]
fn world_parity_season_triple() {
    season_settlement::wrong_planner(
        'season_triple', world_native::settlement::SettlementMode::Triple,
    );
}

#[test]
#[feature("safe_dispatcher")]
fn world_parity_season_duel() {
    season_settlement::wrong_planner('season_duel', world_native::settlement::SettlementMode::Duel);
}

#[test]
#[feature("safe_dispatcher")]
fn world_parity_season_pre_main() {
    season_settlement::before_main();
}

#[test]
#[feature("safe_dispatcher")]
fn world_parity_season_explorer_occupied() {
    season_settlement::explorer_occupied();
}

#[test]
#[feature("safe_dispatcher")]
fn world_parity_season_search_limit() {
    season_settlement::search_limit();
}

mod village;
#[test]
#[feature("safe_dispatcher")]
fn world_parity_village() {
    village::village();
}
#[test]
fn world_parity_village_resource_draws() {
    village::resource_draws();
}

mod resources;
#[test]
#[feature("safe_dispatcher")]
fn world_parity_resources_approvals() {
    resources::approvals();
}
#[test]
#[feature("safe_dispatcher")]
fn world_parity_resources_burns() {
    resources::burns();
}
#[test]
#[feature("safe_dispatcher")]
fn world_parity_resources_regularize() {
    resources::regularize();
}
#[test]
#[feature("safe_dispatcher")]
fn world_parity_resources_transfers() {
    resources::transfers();
}
#[test]
#[feature("safe_dispatcher")]
fn world_parity_resources_knight() {
    resources::troop_exclusion('resources_knight', 26);
}
#[test]
#[feature("safe_dispatcher")]
fn world_parity_resources_crossbow() {
    resources::troop_exclusion('resources_crossbow', 29);
}
#[test]
#[feature("safe_dispatcher")]
fn world_parity_resources_paladin() {
    resources::troop_exclusion('resources_paladin', 32);
}

#[test]
#[feature("safe_dispatcher")]
fn world_parity_resources_offload() {
    resources::offload();
}

#[test]
#[feature("safe_dispatcher")]
fn world_parity_resources_offload_rejections() {
    resources::offload_rejections();
}

#[test]
#[feature("safe_dispatcher")]
fn world_parity_resources_offload_capacity() {
    resources::offload_capacity();
}

#[test]
#[feature("safe_dispatcher")]
fn world_parity_resources_send() {
    resources::sending();
}

#[test]
#[feature("safe_dispatcher")]
fn world_parity_resources_pickup() {
    resources::pickup(false);
}

#[test]
#[feature("safe_dispatcher")]
fn world_parity_resources_pickup_unlimited() {
    resources::pickup(true);
}

#[test]
#[feature("safe_dispatcher")]
fn world_parity_resources_duplicates() {
    resources::duplicate_rejection();
}

#[test]
#[feature("safe_dispatcher")]
fn world_parity_resources_village_blitz() {
    resources::village_reinforcement(true);
}

#[test]
#[feature("safe_dispatcher")]
fn world_parity_resources_village_eternum() {
    resources::village_reinforcement(false);
}
