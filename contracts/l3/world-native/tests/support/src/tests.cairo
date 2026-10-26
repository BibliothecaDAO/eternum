pub use fixtures::{IFixtureDispatcher, IFixtureDispatcherTrait};
pub use play_fixture::{IPlayFixtureSafeDispatcher, IPlayFixtureSafeDispatcherTrait, TestAction};
pub use snforge_std::{
    ContractClassTrait, DeclareResultTrait, EventSpyTrait, EventsFilterTrait, declare, spy_events,
    start_cheat_block_timestamp, start_cheat_caller_address,
};
pub use starknet::storage::StorageMapReadAccess;
pub use starknet::{ClassHash, ContractAddress};
pub use crate::commands::{
    Command, CreateExplorer, ExecutionContext, ICreateExplorerSafeDispatcher, ICreateExplorerSafeDispatcherTrait,
    ICreateExplorerSafeLibraryDispatcher,
};
pub use crate::game::IGameDispatcherTrait;
pub use crate::games::{
    IGamesAuthenticationDispatcher, IGamesAuthenticationDispatcherTrait, IGamesPlaySafeDispatcher,
    IGamesPlaySafeDispatcherTrait, IGamesRandomnessDispatcherTrait, IGamesRolesDispatcher, IGamesRolesDispatcherTrait,
    IGamesRolesSafeDispatcher, IGamesRolesSafeDispatcherTrait,
};
pub use crate::logic::release::{IReleasesDispatcher, IReleasesDispatcherTrait};
pub use crate::tests::state::{GameState, TroopObservationTrait};
pub use crate::troops::ExplorerKey;
pub use crate::upgrades::{
    IUpgradeRulesDispatcher, IUpgradeRulesDispatcherTrait, IUpgradeRulesSafeDispatcher,
    IUpgradeRulesSafeDispatcherTrait, UpgradeLimits, UpgradeRecipe,
};
pub mod army_merge;
pub mod artificer;
pub mod bitcoin;
pub mod blitz_results;
pub mod bridge;
pub mod building_commands;
pub mod camps;
pub mod combat_actions;
pub mod combat_formula;
pub mod days;
pub mod discovery_guards;
pub mod entity_ids;
pub mod entry;
pub mod explore_rewards;
pub mod fact_wire;
pub mod faith;
pub mod fixtures;
pub mod frontier_combat_vectors;
pub mod frontier_discovery;
pub mod frontier_economy;
pub mod frontier_explore_chest;
pub mod frontier_guards;
pub mod frontier_reveal;
pub mod games_fixture;
pub mod games_host;
pub mod guilds;
pub mod hyperstructures;
pub mod lords_budget;
pub mod market;
pub mod mines;
pub mod play_fixture;
pub mod preset_projection;
pub mod production;
pub mod progression;
pub mod random_vectors;
pub mod realms;
pub mod registrar;
pub mod releases;
pub mod relics;
pub mod resource_commands;
pub mod resources;
pub mod roll_independence;
pub mod rule_storage;
pub mod season_lifecycle;
pub mod settlement;
pub mod shared_storage;
pub mod spatial_replay;
pub mod spires;
pub mod stamina;
pub mod state;
pub mod structure_rules;
pub mod structure_storage;
pub mod terrain;
pub mod trade;
pub mod troop_management;
pub mod unlimited_production;
pub mod village;

#[derive(Drop, Copy)]
pub struct Deployment {
    pub games: ContractAddress,
    pub actor: ContractAddress,
    pub account_class: ClassHash,
}
pub const GUARDIAN: felt252 = 98765;
pub const TEST_L2_GAS_BOUND: u64 = 1200000000;
pub fn vrf_key() -> realms_vrf_verifier::vendor::ecvrf::Point {
    realms_vrf_verifier::vendor::ecvrf::Point { x: core::ec::stark_curve::GEN_X, y: core::ec::stark_curve::GEN_Y }
}
pub fn append_vrf_configuration(ref calldata: Array<felt252>) {
    vrf_key().serialize(ref calldata);
    calldata.append(TEST_L2_GAS_BOUND.into());
}
pub fn player_address(realms_id: felt252) -> ContractAddress {
    crate::games::player_account_address(realms_id, declare_logic("AccountFixture"), GUARDIAN)
}
pub fn deploy_player(realms_id: felt252, guardian: felt252) -> (ContractAddress, ClassHash) {
    let class = declare_logic("AccountFixture");
    let address = crate::games::player_account_address(realms_id, class, guardian);
    if starknet::syscalls::get_class_hash_at_syscall(address).unwrap() == 0.try_into().unwrap() {
        let (deployed, _) = starknet::syscalls::deploy_syscall(
            class, realms_id, array![realms_id, guardian].span(), true,
        )
            .unwrap();
        assert_eq!(deployed, address);
    }
    (address, class)
}
pub fn authority() -> ContractAddress {
    player_address(2)
}
pub fn deploy(name: ByteArray, calldata: @Array<felt252>) -> (ContractAddress, ClassHash) {
    let class = declare(name).unwrap().contract_class();
    let (address, _) = class.deploy(calldata).unwrap();
    (address, *class.class_hash)
}
pub fn setup(seed_games: bool) -> Deployment {
    setup_with_structures(seed_games, "MapLogic")
}
pub fn setup_with_structures(seed_games: bool, structures_class: ByteArray) -> Deployment {
    setup_with_domains(seed_games, structures_class, "TroopFixture")
}
pub fn bind_authority(d: Deployment) -> Deployment {
    deploy_player(2, GUARDIAN);
    Deployment { actor: authority(), ..d }
}
pub fn declare_logic(name: ByteArray) -> ClassHash {
    *declare(name).unwrap().contract_class().class_hash
}
pub fn setup_with_domains(seed_games: bool, structures_class: ByteArray, troops_class: ByteArray) -> Deployment {
    setup_with_host(seed_games, structures_class, troops_class, "GamesTest")
}
pub fn setup_with_host(
    seed_games: bool, structures_class: ByteArray, troops_class: ByteArray, host: ByteArray,
) -> Deployment {
    let (actor, account_class) = deploy_player(1, GUARDIAN);
    let movement = if troops_class == "TroopFixture" {
        declare_logic("TroopFixture")
    } else {
        declare_logic("MovementLogic")
    };
    let classes = games_storage::release::LogicClasses {
        season: declare_logic("SeasonLogic"),
        map: declare_logic("MapLogic"),
        placement: declare_logic("PlacementLogic"),
        construction: declare_logic("ConstructionLogic"),
        production: declare_logic("ProductionLogic"),
        structures: declare_logic(structures_class),
        troops: declare_logic(troops_class),
        settlement: declare_logic("SettlementLogic"),
        resources: declare_logic("ResourcesLogic"),
        economy: declare_logic("EconomyLogic"),
        prizes: declare_logic("PrizesLogic"),
        registry: declare_logic("RegistryLogic"),
        combat: declare_logic("CombatLogic"),
        raid: declare_logic("RaidLogic"),
        bridge: declare_logic("BridgeLogic"),
        relics: declare_logic("RelicsLogic"),
        movement,
    };
    let authentication = crate::games::Authentication { account_class, guardian_public_key: GUARDIAN };
    let mut calldata = array![authority().into(), authority().into()];
    authentication.serialize(ref calldata);
    calldata.append(1);
    classes.serialize(ref calldata);
    calldata.append(0);
    append_vrf_configuration(ref calldata);
    let (games, _) = deploy(host, @calldata);
    if seed_games {
        play_fixture::create_games(games);
    }
    start_cheat_caller_address(games, actor);
    snforge_std::start_cheat_account_contract_address(games, actor);
    start_cheat_block_timestamp(games, 100);
    Deployment { games, actor, account_class }
}
pub fn context(games: ContractAddress, game_id: u32) -> ExecutionContext {
    if starknet::get_contract_address() == games {
        read_context(game_id)
    } else {
        snforge_std::interact_with_state(games, || read_context(game_id))
    }
}
pub fn read_context(game_id: u32) -> ExecutionContext {
    let state = crate::state::read();
    ExecutionContext {
        raw_root: 987654321,
        timestamp: 100,
        game_id,
        game: BoxTrait::new(state.games.games.read(game_id)),
        rules: BoxTrait::new(crate::logic::game::rules(game_id)),
    }
}
pub fn map_center(games: ContractAddress, game_id: u32) -> crate::troops::Coord {
    crate::settlement_grid::map_center(context(games, game_id).rules.unbox().map_center_offset)
}
pub fn action(deployment: Deployment, game_id: u32) -> TestAction {
    TestAction {
        game_id,
        actor: deployment.actor,
        command: Command::CreateExplorer(
            CreateExplorer { slot: 0, structure_id: 7, category: 0, tier: 0, amount: 0, direction: 0 },
        ),
    }
}
pub fn execute(deployment: Deployment, action: TestAction) {
    assert!(play_fixture::play(deployment.games, action, 987654321, 100));
}
pub fn set_launcher(deployment: Deployment, launcher: ContractAddress) {
    start_cheat_caller_address(deployment.games, authority());
    IGamesRolesDispatcher { contract_address: deployment.games }.set_launcher(launcher);
}

#[feature("safe_dispatcher")]
pub fn assert_entry_refusal(
    deployment: Deployment, game_id: u32, release: u32, preset: felt252, command: Span<felt252>, message: ByteArray,
) {
    let before = play_fixture::pins(deployment.games, 1);
    let mut spy = spy_events();
    let error = IPlayFixtureSafeDispatcher { contract_address: deployment.games }
        .play_with_root(game_id, release, preset, command, 987654321)
        .unwrap_err();
    let mut expected = array![core::byte_array::BYTE_ARRAY_MAGIC];
    message.serialize(ref expected);
    expected.append('ENTRYPOINT_FAILED');
    assert_eq!(error, expected);
    assert_eq!(play_fixture::pins(deployment.games, 1), before);
    assert!(
        GameState { contract_address: deployment.games }.explorer(ExplorerKey { game_id: 1, explorer_id: 7 }).is_none(),
    );
    assert!(spy.get_events().emitted_by(deployment.games).events.is_empty());
}
