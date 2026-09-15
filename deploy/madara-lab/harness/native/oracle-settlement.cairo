use world_native::settlement::{
    CosmeticsKey, EntryKey, ISettlementConfigurationDispatcher, ISettlementConfigurationDispatcherTrait,
    ISettlementPoolDispatcher, ISettlementPoolDispatcherTrait, ISettlementViewsDispatcher,
    ISettlementViewsDispatcherTrait, SettleBlitz, SettlementMode, SettlementRules,
};
use crate::models::config::{
    BlitzHypersSettlementConfigImpl, BlitzRegistrationGameConfig, BlitzSettlementConfigImpl, WorldConfigUtilImpl,
};
use crate::systems::realm::blitz::hyperstructure_create::contracts::{
    IBlitzHyperstructureCreateSystemsDispatcher, IBlitzHyperstructureCreateSystemsDispatcherTrait,
};
use super::*;

fn setup_blitz(case: felt252, mode: world_native::settlement::SettlementMode) -> PairedWorld {
    setup_blitz_entry(case, mode, false, false)
}

fn setup_blitz_entry(case: felt252, mode: SettlementMode, cosmetics: bool, ledger: bool) -> PairedWorld {
    configure_blitz_entry(setup_game(case, true), mode, cosmetics, ledger)
}

fn configure_blitz_entry(mut worlds: PairedWorld, mode: SettlementMode, cosmetics: bool, ledger: bool) -> PairedWorld {
    let collection = if cosmetics {
        deploy("ParityCosmetics", @array![worlds.actor.into(), worlds.opponent.into()])
    } else {
        0.try_into().unwrap()
    };
    let operator = if ledger {
        authority()
    } else {
        0.try_into().unwrap()
    };
    start_cheat_caller_address(worlds.peers.season, authority());
    ISettlementConfigurationDispatcher { contract_address: worlds.peers.season }
        .configure_settlement(
            1,
            SettlementRules {
                registration_start: 1700,
                registration_limit: 2,
                mode,
                reward_profile: 1,
                cosmetic_limit: 3,
                cosmetic_collection: collection,
                cosmetic_timelock: collection,
                ledger_operator: operator,
            },
            crate::native_inputs::realm_grants(),
        );
    stop_cheat_caller_address(worlds.peers.season);
    let ptr = Model::<WorldConfig>::ptr_from_keys(1_u32);
    worlds
        .oracle
        .write_member(
            ptr,
            selector!("blitz_registration_config"),
            BlitzRegistrationGameConfig {
                registration_count: 0, registration_count_max: 2, registration_start_at: 1700,
            },
        );
    worlds
        .oracle
        .write_member(
            ptr,
            selector!("blitz_settlement_config"),
            BlitzSettlementConfigImpl::new(6, mode == SettlementMode::Single, mode == SettlementMode::Duel),
        );
    worlds
        .oracle
        .write_member(ptr, selector!("blitz_hypers_settlement_config"), BlitzHypersSettlementConfigImpl::new());
    let mut preset: PresetConfig = worlds.oracle.read_model(1_u32);
    preset.blitz_exploration_config.reward_profile_id = 1;
    preset.blitz_registration_rules_config.collectibles_cosmetics_max = 3;
    worlds.oracle.write_model_test(@preset);
    let chain = Model::<crate::models::config::ChainConfig>::ptr_from_keys(crate::constants::WORLD_CONFIG_ID);
    worlds.oracle.write_member(chain, selector!("collectibles_cosmetics_address"), collection);
    worlds.oracle.write_member(chain, selector!("collectibles_timelock_address"), collection);
    worlds.oracle.write_member(chain, selector!("ledger_operator_address"), operator);
    if ledger {
        let registry = deploy("ParityRegistry", @array![worlds.actor.into(), worlds.opponent.into()]);
        worlds.oracle.write_member(chain, selector!("player_registry_address"), registry);
    }
    worlds
}

fn reserve_pair(worlds: PairedWorld, count: u8, step: u32) {
    let (address, _) = worlds.oracle.dns(@"hyperstructure_create_systems").unwrap();
    start_cheat_block_timestamp_global(1800);
    start_cheat_caller_address(address, worlds.actor);
    IBlitzHyperstructureCreateSystemsDispatcher { contract_address: address }.reserve_hyperstructures(1, count);
    stop_cheat_caller_address(address);
    let (order, outcome) = execute_outcome(worlds, Command::ReserveHyperstructures(count), 1800, 0);
    assert!(outcome);
    println!("FACT_ACTION {} {} {} {} {}", worlds.case, order, 'reserve_hyperstructures', 1800, outcome);
    let rules = ISettlementViewsDispatcher { contract_address: worlds.peers.season }.settlement_rules(1);
    let placed = ISettlementPoolDispatcher { contract_address: worlds.peers.map }.reserved_hyperstructures(1);
    let center = world_native::troops::Coord { alt: false, x: 2147483626, y: 2147483626 };
    for index in 0..placed {
        compare_tile(
            worlds,
            step,
            world_native::settlement_grid::reservation_location(center, rules.mode, rules.reward_profile, index),
        );
    }
}

fn entry_owner(worlds: PairedWorld) -> ContractAddress {
    world_native::settlement::ISettlementEntryDispatcherTrait::settlement_admission(
        world_native::settlement::ISettlementEntryDispatcher { contract_address: worlds.peers.season }, 1, worlds.actor,
    )
        .owner
}

fn settle_pair(worlds: PairedWorld, grant: bool, root: felt252, step: u32) -> Span<u32> {
    settle_outcome_pair(
        worlds,
        SettleBlitz {
            cosmetics_block_hash: 0xabc,
            cosmetics_block_number: 2,
            name: 'settler',
            owner: entry_owner(worlds),
            cosmetics: array![].span(),
            grant_starting_troops: grant,
        },
        1800,
        root,
        step,
        true,
    )
}

#[feature("safe_dispatcher")]
fn settle_outcome_pair(
    worlds: PairedWorld, command: SettleBlitz, timestamp: u64, root: felt252, step: u32, expected: bool,
) -> Span<u32> {
    let (address, _) = worlds.oracle.dns(@"blitz_realm_systems").unwrap();
    let mut ids = array![];
    for cosmetic in command.cosmetics {
        ids.append(*cosmetic.token_id);
    }
    start_cheat_block_timestamp_global(timestamp);
    let tx_hash = inject_root(worlds, root);
    start_cheat_caller_address(address, worlds.actor);
    let attempts = IParityAttemptsDispatcher { contract_address: deploy("ParityAttempts", @array![]) };
    let original = attempts.settle(address, command.name, ids.span(), command.grant_starting_troops);
    stop_cheat_caller_address(address);
    if original {
        assert_root_consumed(worlds, tx_hash, root, step);
    } else {
        assert!(IParityRootsDispatcher { contract_address: worlds.roots }.consumed() == 0);
    }
    let (order, outcome) = execute_outcome(worlds, Command::SettleBlitz(command), timestamp, root.into());
    assert!(outcome == original && outcome == expected, "settlement outcome differs");
    println!("FACT_ACTION {} {} {} {} {}", worlds.case, order, 'settle', timestamp, outcome);
    let settled: crate::models::config::BlitzSettlement = ModelStorage::read_model(@worlds.oracle, (1, worlds.actor));
    for id in settled.structure_ids {
        compare_home(worlds, step, *id);
    }
    compare_blitz_entry(worlds, step);
    compare_name(worlds, step, worlds.actor);
    settled.structure_ids
}

fn compare_blitz_entry(worlds: PairedWorld, step: u32) {
    let views = ISettlementViewsDispatcher { contract_address: worlds.peers.season };
    compare_facts(
        worlds.case,
        step,
        'SettlementPool',
        array![1].span(),
        ISettlementPoolDispatcher { contract_address: worlds.peers.map }.settlement_pool(1),
        OracleSettlementPool { world: worlds.oracle, game_id: 1 },
    );
    let registration: crate::models::config::BlitzRegistrationGameConfig = WorldConfigUtilImpl::get_member(
        worlds.oracle, 1, selector!("blitz_registration_config"),
    );
    let realms: crate::models::config::RealmCountConfig = WorldConfigUtilImpl::get_member(
        worlds.oracle, 1, selector!("realm_count_config"),
    );
    compare_facts(
        worlds.case,
        step,
        'SettlementProgress',
        array![1].span(),
        views.settlement_progress(1),
        OracleSettlementProgress { registered: registration.registration_count, realm_count: realms.count },
    );
    compare_facts(
        worlds.case,
        step,
        'PlayerEntry',
        array![1, entry_owner(worlds).into()].span(),
        views
            .player_entry(EntryKey { game_id: 1, owner: entry_owner(worlds) })
            .unwrap_or(world_native::settlement::PlayerEntry { player: 0.try_into().unwrap() }),
        ModelStorage::<
            WorldStorage, crate::models::ledger::PlayerSettlement,
        >::read_model(@worlds.oracle, (1, entry_owner(worlds))),
    );
    compare_facts(
        worlds.case,
        step,
        'PlayerCosmetics',
        array![1, worlds.actor.into()].span(),
        views.player_cosmetics(CosmeticsKey { game_id: 1, player: worlds.actor }),
        ModelStorage::<
            WorldStorage, crate::models::config::BlitzCosmeticAttrsRegister,
        >::read_model(@worlds.oracle, (1, worlds.actor)),
    );
}

#[feature("safe_dispatcher")]
pub fn settlement() {
    let worlds = setup_blitz('blitz_settlement', world_native::settlement::SettlementMode::Single);
    reserve_pair(worlds, 255, 0);
    let first = *settle_pair(worlds, false, 1234, 1).at(0);
    let second_worlds = PairedWorld { actor: worlds.opponent, opponent: worlds.actor, ..worlds };
    let second = *settle_pair(second_worlds, true, 5678, 2).at(0);
    let (address, _) = worlds.oracle.dns(@"blitz_realm_systems").unwrap();
    let attempts = IParityAttemptsDispatcher { contract_address: deploy("ParityAttempts", @array![]) };
    let mut step = 3;
    for (player, id) in array![(worlds.actor, first), (worlds.opponent, second)].span() {
        let player_worlds = PairedWorld { actor: *player, ..worlds };
        for expected in array![true, false].span() {
            start_cheat_block_timestamp_global(2040);
            start_cheat_caller_address(address, *player);
            let original = attempts.provision(address, *id);
            stop_cheat_caller_address(address);
            let (order, native) = execute_outcome(player_worlds, Command::ProvisionRealm(*id), 2040, 0);
            println!("FACT_ACTION {} {} {} {} {}", worlds.case, order, 'provision_realm', 2040, native);
            assert!(original == *expected && native == original, "provisioning rejection differs");
            compare_home(worlds, step, *id);
            let home = IStructuresDispatcher { contract_address: worlds.peers.structures }
                .structure(ResourceKey { game_id: 1, entity_id: *id })
                .unwrap();
            let coord = world_native::troops::Coord { alt: false, x: home.base.coord_x, y: home.base.coord_y };
            compare_realm_buildings(worlds, step, *id, coord);
            compare_tile(worlds, step, coord);
            for direction in 0_u8..6 {
                compare_tile(worlds, step, world_native::geometry::neighbor(coord, direction));
            }
            step += 1;
        }
    }
}


fn compare_realm_buildings(worlds: PairedWorld, step: u32, id: u32, coord: world_native::troops::Coord) {
    let structures = IStructuresDispatcher { contract_address: worlds.peers.structures };
    let key = world_native::buildings::BuildingKey {
        game_id: 1, alt: false, outer_col: coord.x, outer_row: coord.y, inner_col: 10, inner_row: 10,
    };
    compare_facts(
        worlds.case,
        step,
        'Building',
        array![1, 0, coord.x.into(), coord.y.into(), 10, 10].span(),
        structures.building(key).unwrap(),
        ModelStorage::<
            WorldStorage, Building,
        >::read_model(@worlds.oracle, (1, false, coord.x, coord.y, 10_u32, 10_u32)),
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

#[feature("safe_dispatcher")]
pub fn reservations() {
    let worlds = setup_blitz('blitz_reservations', SettlementMode::Single);
    reserve_pair(worlds, 1, 0);
    reserve_pair(worlds, 0, 1);
    reserve_pair(worlds, 255, 2);
    reserve_pair(worlds, 255, 3);
    let (address, _) = worlds.oracle.dns(@"hyperstructure_create_systems").unwrap();
    let original =
        crate::systems::realm::blitz::hyperstructure_create::contracts::IBlitzHyperstructureCreateSystemsSafeDispatcher {
        contract_address: address,
    };
    let coord = world_native::troops::Coord { alt: false, x: 2147483626, y: 2147483626 };
    let mut step = 4;
    for expected in array![true, false].span() {
        start_cheat_block_timestamp_global(1800);
        start_cheat_caller_address(address, worlds.actor);
        let oracle =
            crate::systems::realm::blitz::hyperstructure_create::contracts::IBlitzHyperstructureCreateSystemsSafeDispatcherTrait::create_hyperstructure(
            original, 1, convert(coord),
        )
            .is_ok();
        stop_cheat_caller_address(address);
        let (order, native) = execute_outcome(worlds, Command::CreateReservedHyperstructure(coord), 1800, 98765);
        assert!(native == oracle && native == *expected, "reserved hyperstructure outcome differs");
        println!("FACT_ACTION {} {} {} {} {}", worlds.case, order, 'create_hyperstructure', 1800, native);
        compare_tile(worlds, step, coord);
        let tile = IMapDispatcher { contract_address: worlds.peers.map }
            .tile(world_native::geometry::tile_key(1, coord))
            .unwrap();
        let id: u32 = ((tile.data / 512) % 0x100000000).try_into().unwrap();
        compare_home(worlds, step, id);
        let structures = IStructuresDispatcher { contract_address: worlds.peers.structures };
        compare_facts(
            worlds.case,
            step,
            'Hyperstructure',
            array![1, id.into()].span(),
            structures.hyperstructure(ResourceKey { game_id: 1, entity_id: id }).unwrap(),
            ModelStorage::<WorldStorage, Hyperstructure>::read_model(@worlds.oracle, (1, id)),
        );
        for direction in 0_u8..6 {
            compare_tile(worlds, step, world_native::geometry::neighbor(coord, direction));
        }
        step += 1;
    }
}


#[feature("safe_dispatcher")]
pub fn entry_rejections() {
    let worlds = setup_blitz('blitz_entry_rejections', SettlementMode::Single);
    let command = SettleBlitz {
        cosmetics_block_hash: 0xabc,
        cosmetics_block_number: 2,
        name: 'settler',
        owner: entry_owner(worlds),
        cosmetics: array![].span(),
        grant_starting_troops: false,
    };
    settle_outcome_pair(worlds, SettleBlitz { name: 0, ..command }, 1800, 50, 0, false);
    settle_outcome_pair(worlds, command, 1699, 50, 1, false);
    settle_outcome_pair(worlds, command, 2000, 50, 2, false);
    settle_outcome_pair(worlds, command, 1800, 50, 3, false);
    reserve_pair(worlds, 255, 4);
    settle_outcome_pair(worlds, command, 1700, 50, 5, true);
    settle_outcome_pair(worlds, command, 1800, 50, 6, false);
    let other = PairedWorld { actor: worlds.opponent, ..worlds };
    settle_pair(other, false, 99, 7);
    settle_outcome_pair(worlds, command, 1800, 50, 8, false);
}

#[feature("safe_dispatcher")]
pub fn entry_ledger() {
    let mut worlds = setup_blitz_entry('blitz_entry_ledger', SettlementMode::Single, false, true);
    reserve_pair(worlds, 255, 9);
    let command = SettleBlitz {
        cosmetics_block_hash: 0xabc,
        cosmetics_block_number: 2,
        name: 'ledger',
        owner: entry_owner(worlds),
        cosmetics: array![].span(),
        grant_starting_troops: false,
    };
    settle_outcome_pair(worlds, command, 1800, 50, 10, false);
    worlds
        .oracle
        .write_model_test(
            @crate::models::ledger::LedgerRegistration {
                game_id: 1,
                owner: entry_owner(worlds),
                realm_id: 7,
                metadata: (8, 9, 10),
                pass_kind: 0,
                registered: true,
            },
        );
    start_cheat_caller_address(worlds.peers.season, authority());
    world_native::settlement::ISettlementEntryDispatcherTrait::register_entitlement(
        world_native::settlement::ISettlementEntryDispatcher { contract_address: worlds.peers.season },
        EntryKey { game_id: 1, owner: entry_owner(worlds) },
        world_native::settlement::EntryEntitlement {
            realm_id: 7, metadata_1: 8, metadata_2: 9, metadata_3: 10, pass_kind: 0,
        },
    );
    stop_cheat_caller_address(worlds.peers.season);
    settle_outcome_pair(worlds, command, 1800, 50, 11, true);
}

#[feature("safe_dispatcher")]
pub fn cosmetics() {
    let worlds = setup_blitz_entry('blitz_cosmetics', SettlementMode::Single, true, false);
    reserve_pair(worlds, 255, 0);
    let valid = world_native::settlement::AcceptedCosmetic { token_id: 1, owner: entry_owner(worlds), attributes: 321 };
    let command = SettleBlitz {
        cosmetics_block_hash: 0xabc,
        cosmetics_block_number: 2,
        name: 'cosmetics',
        owner: entry_owner(worlds),
        cosmetics: array![valid].span(),
        grant_starting_troops: false,
    };
    settle_outcome_pair(
        worlds, SettleBlitz { cosmetics: array![valid, valid, valid, valid].span(), ..command }, 1800, 7, 1, false,
    );
    settle_outcome_pair(
        worlds,
        SettleBlitz {
            cosmetics: array![
                world_native::settlement::AcceptedCosmetic { token_id: 2, owner: worlds.opponent, ..valid },
            ]
                .span(),
            ..command,
        },
        1800,
        7,
        2,
        false,
    );
    settle_outcome_pair(
        worlds,
        SettleBlitz {
            cosmetics: array![world_native::settlement::AcceptedCosmetic { token_id: 3, attributes: 0, ..valid }]
                .span(),
            ..command,
        },
        1800,
        7,
        3,
        false,
    );
    settle_outcome_pair(worlds, SettleBlitz { cosmetics: array![valid, valid].span(), ..command }, 1800, 7, 4, true);
}

#[feature("safe_dispatcher")]
pub fn cosmetics_disabled() {
    let worlds = setup_blitz('blitz_cosmetics_disabled', SettlementMode::Single);
    let command = SettleBlitz {
        cosmetics_block_hash: 0xabc,
        cosmetics_block_number: 2,
        name: 'ignored',
        owner: entry_owner(worlds),
        cosmetics: array![].span(),
        grant_starting_troops: false,
    };
    reserve_pair(worlds, 255, 5);
    let invalid = world_native::settlement::AcceptedCosmetic { token_id: 2, owner: worlds.opponent, attributes: 0 };
    settle_outcome_pair(
        worlds,
        SettleBlitz {
            owner: entry_owner(worlds), cosmetics: array![invalid, invalid, invalid, invalid].span(), ..command,
        },
        1800,
        7,
        6,
        true,
    );
}

#[starknet::interface]
pub trait IParityCosmetics<T> {
    fn owner_of(self: @T, token_id: u256) -> ContractAddress;
    fn get_metadata_raw(self: @T, token_id: u256) -> u128;
    fn token_lock_state(self: @T, token_id: u256) -> (felt252, felt252);
    fn create_lock(ref self: T, collection: ContractAddress, lock_end_time: u64);
}
#[starknet::contract]
mod ParityCosmetics {
    use starknet::ContractAddress;
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};
    #[storage]
    struct Storage {
        owner: ContractAddress,
        other: ContractAddress,
    }
    #[constructor]
    fn constructor(ref self: ContractState, owner: ContractAddress, other: ContractAddress) {
        self.owner.write(owner);
        self.other.write(other);
    }
    #[abi(embed_v0)]
    impl Cosmetics of super::IParityCosmetics<ContractState> {
        fn owner_of(self: @ContractState, token_id: u256) -> ContractAddress {
            if token_id == 2 {
                self.other.read()
            } else {
                self.owner.read()
            }
        }
        fn get_metadata_raw(self: @ContractState, token_id: u256) -> u128 {
            if token_id == 3 {
                0
            } else {
                321
            }
        }
        fn token_lock_state(self: @ContractState, token_id: u256) -> (felt252, felt252) {
            (999999, 999999)
        }
        fn create_lock(ref self: ContractState, collection: ContractAddress, lock_end_time: u64) {
            assert!(collection == starknet::get_contract_address());
            assert!(lock_end_time > starknet::get_block_timestamp());
        }
    }
}


#[feature("safe_dispatcher")]
pub fn settlement_modes(mode: SettlementMode, case: felt252) {
    let worlds = setup_blitz(case, mode);
    reserve_pair(worlds, 255, 0);
    let first = settle_pair(worlds, false, 19, 1);
    let second = settle_pair(PairedWorld { actor: worlds.opponent, ..worlds }, false, 999, 2);
    assert!(first.len() == 3 && second.len() == 3, "three-realm settlement changed");
}


#[feature("safe_dispatcher")]
pub fn displacement(blocked: bool, agent: bool, case: felt252) {
    let mut worlds = configure_blitz_entry(setup_world(case, true, true), SettlementMode::Single, false, false);
    reserve_pair(worlds, 255, 0);
    let mut root = 19_u256;
    let seed = world_native::random::game_root(ref root, 1, 1);
    let count = world_native::settlement_grid::target_pool_size(0, 2, SettlementMode::Single);
    let candidate: u32 = world_native::random::range(seed, 98139, count.into()).try_into().unwrap();
    let center = world_native::troops::Coord { alt: false, x: 2147483626, y: 2147483626 };
    let coord = *world_native::settlement_grid::settlement_location(center, SettlementMode::Single, 1, candidate).at(0);
    let home = provision(ref worlds, convert(world_native::geometry::neighbor(coord, 3)));
    let explorer_id = create_explorer_pair(worlds, home);
    let troops = ITroopsDispatcher { contract_address: worlds.peers.troops };
    let explorer = troops.explorer(ExplorerKey { game_id: 1, explorer_id }).unwrap();
    assert!(explorer.coord == coord, "blocking fixture missed the selected settlement");
    if agent {
        promote_fixture_agent(ref worlds, home, explorer_id);
        compare_agent(worlds, 1, explorer_id);
    }
    if blocked {
        for direction in 0_u8..6 {
            if direction != 3 {
                provision_with_resources(
                    ref worlds, convert(world_native::geometry::neighbor(coord, direction)), array![].span(),
                );
            }
        }
    }
    let ids = settle_pair(worlds, false, 19, 2);
    let realm = IStructuresDispatcher { contract_address: worlds.peers.structures }
        .structure(ResourceKey { game_id: 1, entity_id: *ids.at(0) })
        .unwrap();
    assert!(realm.base.coord_x == coord.x && realm.base.coord_y == coord.y);
    compare_home(worlds, 3, home);
    compare_tile(worlds, 3, coord);
    if blocked {
        assert!(troops.explorer(ExplorerKey { game_id: 1, explorer_id }).is_none());
        let original: ExplorerTroops = ModelStorage::read_model(@worlds.oracle, (1, explorer_id));
        assert!(original.owner == 0 && original.troops.count == 0);
        assert!(
            !IStructuresDispatcher { contract_address: worlds.peers.structures }
                .has_resource(ResourceKey { game_id: 1, entity_id: explorer_id }),
        );
        compare_resources(worlds, 3, explorer_id);
        println!("FACT_DELETE {} {} {} {} {}", worlds.case, 3, 'ExplorerTroops', 1, explorer_id);
        println!("FACT_DELETE {} {} {} {} {}", worlds.case, 3, 'ResourceWeight', 1, explorer_id);
    } else {
        let moved = compare_explorer(worlds, 3, explorer_id);
        assert!(moved.coord == world_native::geometry::neighbor(coord, 0));
        assert!(moved.troops == explorer.troops, "displacement charged movement or changed troops");
    }
    if agent {
        compare_agent(worlds, 3, explorer_id);
    }
    for direction in 0_u8..6 {
        compare_tile(worlds, 3, world_native::geometry::neighbor(coord, direction));
    }
}


fn promote_fixture_agent(ref worlds: PairedWorld, home: u32, id: u32) {
    let mut original: ExplorerTroops = worlds.oracle.read_model((1, id));
    original.owner = world_native::troops::AGENT_HOME;
    worlds.oracle.write_model_test(@original);
    set_native_fixture(
        worlds.peers.troops,
        selector!("explorers"),
        array![1, id.into()].span(),
        world_native::troops::ExplorerTroops {
            owner: original.owner, troops: convert(original.troops), coord: convert(original.coord),
        },
    );
    worlds.oracle.write_model_test(@crate::models::agent::AgentCount { game_id: 1, count: 1 });
    worlds
        .oracle
        .write_model_test(@crate::models::agent::AgentOwner { game_id: 1, explorer_id: id, address: worlds.actor });
    set_native_fixture(worlds.peers.troops, selector!("agent_count"), array![1].span(), 1_u16);
    set_native_fixture(worlds.peers.troops, selector!("agent_owners"), array![1, id.into()].span(), worlds.actor);
    let mut original_home: Structure = worlds.oracle.read_model((1, home));
    original_home.base.troop_explorer_count = 0;
    original_home.troop_explorers = array![].span();
    worlds.oracle.write_model_test(@original_home);
    let mut native = IStructuresDispatcher { contract_address: worlds.peers.structures }
        .structure(ResourceKey { game_id: 1, entity_id: home })
        .unwrap();
    native.base.troop_explorer_count = 0;
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
            category: native.category,
        },
    );
    set_native_fixture(worlds.peers.structures, selector!("explorers"), array![1, home.into(), 0].span(), 0_u32);
    let coord = original.coord;
    let mut tile: TileOpt = worlds.oracle.read_model((1, coord.alt, coord.x, coord.y));
    const AGENT_KNIGHT_T1: u8 = 24;
    tile.data = crate::models::map2::TileOptDataWriteImpl::with_occupier_type(tile.data, AGENT_KNIGHT_T1);
    worlds.oracle.write_model_test(@tile);
    let map = IMapDispatcher { contract_address: worlds.peers.map };
    let key = world_native::geometry::tile_key(1, convert(coord));
    start_cheat_caller_address(worlds.peers.map, worlds.peers.troops);
    map.vacate(key, id);
    map.occupy(key, id, AGENT_KNIGHT_T1, false);
    stop_cheat_caller_address(worlds.peers.map);
}
fn compare_agent(worlds: PairedWorld, step: u32, id: u32) {
    compare_facts(
        worlds.case,
        step,
        'AgentPopulation',
        array![1].span(),
        ITroopsDispatcher { contract_address: worlds.peers.troops }.agent_population(1),
        ModelStorage::<WorldStorage, crate::models::agent::AgentCount>::read_model(@worlds.oracle, 1_u32),
    );
    let owner = world_native::ownership::IAgentOwnershipDispatcher { contract_address: worlds.peers.troops }
        .agent_owner(1, id);
    compare_facts(
        worlds.case,
        step,
        'AgentOwner',
        array![1, id.into()].span(),
        owner,
        ModelStorage::<WorldStorage, crate::models::agent::AgentOwner>::read_model(@worlds.oracle, (1, id)),
    );
}

#[feature("safe_dispatcher")]
pub fn occupied() {
    let mut worlds = configure_blitz_entry(
        setup_world('blitz_settlement_occupied', true, true), SettlementMode::Single, false, false,
    );
    reserve_pair(worlds, 255, 0);
    let mut root = 19_u256;
    let seed = world_native::random::game_root(ref root, 1, 1);
    let count = world_native::settlement_grid::target_pool_size(0, 2, SettlementMode::Single);
    let candidate: u32 = world_native::random::range(seed, 98139, count.into()).try_into().unwrap();
    let center = world_native::troops::Coord { alt: false, x: 2147483626, y: 2147483626 };
    let coord = *world_native::settlement_grid::settlement_location(center, SettlementMode::Single, 1, candidate).at(0);
    let home = provision(ref worlds, convert(coord));
    let command = SettleBlitz {
        cosmetics_block_hash: 0xabc,
        cosmetics_block_number: 2,
        name: 'blocked',
        owner: entry_owner(worlds),
        cosmetics: array![].span(),
        grant_starting_troops: false,
    };
    settle_outcome_pair(worlds, command, 1800, 19, 1, false);
    compare_home(worlds, 1, home);
    compare_tile(worlds, 1, coord);
}
