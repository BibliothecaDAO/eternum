pub use snforge_std::{
    EventSpyTrait, EventsFilterTrait, spy_events, start_cheat_block_timestamp_global, start_cheat_caller_address,
    stop_cheat_caller_address,
};
pub use crate::bitcoin::{
    ContributeLabor, ContributionKey, IBitcoinCommandsDispatcher, IBitcoinCommandsDispatcherTrait,
    IBitcoinCommandsSafeDispatcher, IBitcoinCommandsSafeDispatcherTrait, IBitcoinViewsDispatcher,
    IBitcoinViewsDispatcherTrait, PhaseKey, PhaseStatus,
};
pub use crate::commands::{Command, ExecutionContext};
pub use crate::game::{IGameDispatcher, IGameDispatcherTrait};
pub use crate::resources::{
    IResourceOperationsDispatcher, IResourceOperationsDispatcherTrait, ResourceKey, ResourceSlot,
};
pub use crate::tests::state::{MapObservationTrait, ResourceObservationTrait};
pub use crate::troops::Coord;
pub use super::resource_commands::{assert_terminal_rejection, execute, grant};
pub fn setup() -> (super::Deployment, ResourceKey, ResourceKey) {
    let mut rules = super::play_fixture::rules();
    rules.tick_config.bitcoin_phase_in_seconds = 10;
    rules.battle_config.regular_immunity_ticks = 0;
    rules.troop_stamina_config.stamina_initial = 120;
    rules.bitcoin_mine_config.min_labor_per_contribution = 10;
    rules.bitcoin_mine_config.prize_per_phase = 1000;
    let mut preset = super::resource_commands::fixture_preset(rules);
    preset.season_win_points = 1;
    let (deployment, first, second) = super::resource_commands::setup_with_preset(preset);
    grant(deployment, first, 23, 1000);
    grant(deployment, second, 23, 1000);
    (deployment, first, second)
}
pub fn contribute(key: ResourceKey, amount: u128) -> Command {
    Command::ContributeBitcoinLabor(ContributeLabor { structure_id: key.entity_id, amount })
}
pub fn balance(deployment: super::Deployment, key: ResourceKey) -> u128 {
    IResourceOperationsDispatcher { contract_address: deployment.games }
        .resource_balance(ResourceSlot { game_id: key.game_id, entity_id: key.entity_id, resource_type: 23 })
}
pub fn set_owner(deployment: super::Deployment, key: ResourceKey, owner: starknet::ContractAddress) {
    let structures = crate::structures::IStructureOperationsDispatcher { contract_address: deployment.games };
    let structure = crate::tests::state::StructureObservationTrait::structure(structures, key).unwrap();
    super::resource_commands::set_fixture(
        deployment.games,
        selector!("structures"),
        selector!("structures"),
        array![key.game_id.into(), key.entity_id.into()].span(),
        crate::structures::StructureRecord {
            owner, base: structure.base, resources_packed: structure.resources_packed, metadata: structure.metadata,
        },
    );
}
pub fn mine(deployment: super::Deployment, x: u32) -> ResourceKey {
    start_cheat_caller_address(deployment.games, deployment.games);
    let id = crate::structures::IStructureOperationsDispatcherTrait::create_discovery(
        crate::structures::IStructureOperationsDispatcher { contract_address: deployment.games },
        3,
        1,
        crate::troops::Coord { alt: true, x, y: 2000000 },
        crate::discovery::Discovery::BitcoinMine,
        99,
        30,
        crate::commands::action_context(
            crate::commands::ExecutionContext { timestamp: 30, ..crate::tests::context(deployment.games, 3) },
        ),
    );
    stop_cheat_caller_address(deployment.games);
    ResourceKey { game_id: 3, entity_id: id.into() }
}
pub fn capture(deployment: super::Deployment, mine: ResourceKey, owner: starknet::ContractAddress, timestamp: u64) {
    start_cheat_caller_address(deployment.games, deployment.games);
    crate::bitcoin::IBitcoinFundingDispatcherTrait::bitcoin_mine_captured(
        crate::bitcoin::IBitcoinFundingDispatcher { contract_address: deployment.games },
        mine,
        timestamp,
        crate::commands::action_context(
            crate::commands::ExecutionContext {
                timestamp: timestamp, ..crate::tests::context(deployment.games, (mine).game_id),
            },
        ),
    );
    stop_cheat_caller_address(deployment.games);
    set_owner(deployment, mine, owner);
}
pub fn close_and_bind(deployment: super::Deployment, phase: u64) {
    assert!(execute(deployment, Command::CloseBitcoinPhase(phase), (phase + 1) * 10 - 1));
    assert!(execute(deployment, Command::BindBitcoinPhase(phase), (phase + 1) * 10));
}
pub fn claim(phase: u64, ids: Span<u64>) -> Command {
    Command::ClaimBitcoinPhase(crate::bitcoin::ClaimPhase { phase, mine_ids: ids })
}
pub fn sat(deployment: super::Deployment, key: ResourceKey) -> u128 {
    IResourceOperationsDispatcher { contract_address: deployment.games }
        .resource_balance(ResourceSlot { game_id: key.game_id, entity_id: key.entity_id, resource_type: 58 })
}
pub fn attacking_explorer(deployment: super::Deployment, home: ResourceKey, x: u32) -> u64 {
    let id = 900000;
    let coord = crate::troops::Coord { alt: true, x, y: 2000000 };
    let explorer = crate::troops::ExplorerTroops {
        owner: home.entity_id,
        coord,
        troops: crate::troops::Troops {
            count: 3000 * crate::rules::RESOURCE_PRECISION,
            tier: crate::troops::TroopTier::T3,
            stamina: crate::troops::Stamina { amount: 120, settled_at: 0, remainder: 0 }.into(),
            ..Default::default(),
        },
    };
    crate::tests::resource_commands::set_explorer_fixture(
        deployment.games, crate::troops::ExplorerKey { game_id: 3, explorer_id: id }, explorer,
    );
    start_cheat_caller_address(deployment.games, deployment.games);
    IResourceOperationsDispatcher { contract_address: deployment.games }
        .initialize_resources(
            ResourceKey { game_id: 3, entity_id: id.into() },
            100000000000000000000,
            0,
            30,
            crate::commands::action_context(
                crate::commands::ExecutionContext { timestamp: 30, ..crate::tests::context(deployment.games, 3) },
            ),
        );
    stop_cheat_caller_address(deployment.games);
    id
}

#[inline(never)]
pub fn measured_claim(
    calls: IBitcoinCommandsDispatcher,
    actor: starknet::ContractAddress,
    command: crate::bitcoin::ClaimPhase,
    context: ExecutionContext,
) -> u128 {
    let before = core::testing::get_available_gas();
    calls.claim_bitcoin_phase(3, actor, command, crate::commands::action_context(context));
    before - core::testing::get_available_gas()
}
