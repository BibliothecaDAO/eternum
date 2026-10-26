pub use snforge_std::fs::{FileTrait, read_txt};
pub use snforge_std::{EventSpyTrait, EventsFilterTrait, start_cheat_caller_address, stop_cheat_caller_address};
pub use crate::commands::Command;
pub use crate::game::{
    GameStatus, IGameDispatcher, IGameDispatcherTrait, IPointsDispatcher, IPointsDispatcherTrait,
    ISeasonLifecycleSafeDispatcher, ISeasonLifecycleSafeDispatcherTrait,
};
pub use crate::hyperstructures::{IHyperstructuresDispatcher, IHyperstructuresDispatcherTrait};
pub use crate::registrar::IRegistrarSafeDispatcherTrait;
pub use super::resource_commands::{assert_terminal_rejection, execute, setup_with_rules};
pub fn setup_with_threshold(
    rules: crate::rules::SliceRules, points: u128,
) -> (super::Deployment, crate::resources::ResourceKey, crate::resources::ResourceKey) {
    let mut preset = super::resource_commands::fixture_preset(rules);
    preset.season_win_points = points;
    super::resource_commands::setup_with_preset(preset)
}
pub fn games(deployment: super::Deployment) -> IGameDispatcher {
    IGameDispatcher { contract_address: deployment.games }
}
pub fn hypers(deployment: super::Deployment) -> IHyperstructuresDispatcher {
    IHyperstructuresDispatcher { contract_address: deployment.games }
}
pub fn nine_completed_hyperstructures(threshold: u128) -> (super::Deployment, Array<crate::resources::ResourceKey>) {
    let (d, hyper, home, _) = super::hyperstructures::setup_with_threshold(threshold);
    super::hyperstructures::complete(d, hyper, home);
    let mut keys = array![hyper];
    for offset in 1_u32..9 {
        start_cheat_caller_address(d.games, d.games);
        let id = crate::structures::IStructureOperationsDispatcherTrait::create_discovery(
            crate::structures::IStructureOperationsDispatcher { contract_address: d.games },
            3,
            1,
            crate::troops::Coord { alt: false, x: 2000200 + offset * 10, y: 2000000 },
            crate::discovery::Discovery::Hyperstructure,
            101,
            50,
            crate::commands::action_context(
                crate::commands::ExecutionContext { timestamp: 50, ..crate::tests::context(d.games, 3) },
            ),
        );
        stop_cheat_caller_address(d.games);
        let key = crate::resources::ResourceKey { game_id: 3, entity_id: id };
        super::hyperstructures::owner(d, key, d.actor);
        let storage_key = array![3, id.into()].span();
        super::resource_commands::set_fixture(
            d.games,
            selector!("hyperstructures"),
            selector!("hyper_states"),
            storage_key,
            crate::hyperstructures::Hyperstructure {
                stage: crate::hyperstructures::Stage::Complete,
                access: crate::hyperstructures::ConstructionAccess::Public,
                seed: 101,
            },
        );
        super::resource_commands::set_fixture(
            d.games, selector!("hyperstructures"), selector!("hyper_share_count"), storage_key, 1_u32,
        );
        super::resource_commands::set_fixture(
            d.games, selector!("hyperstructures"), selector!("hyper_share_start"), storage_key, 50_u64,
        );
        super::resource_commands::set_fixture(
            d.games, selector!("hyperstructures"), selector!("hyper_multiplier"), storage_key, 1_u8,
        );
        super::resource_commands::set_fixture(
            d.games,
            selector!("hyperstructures"),
            selector!("hyper_shares"),
            array![3, id.into(), 0].span(),
            crate::hyperstructures::Share { player: d.actor, bps: 10000 },
        );
        keys.append(key);
    }
    (d, keys)
}
pub fn execute_batch(d: super::Deployment, command: Command, timestamp: u64, expected: u64) {
    execute_batch_in_game(d, 3, command, timestamp, expected);
}
pub fn execute_batch_in_game(d: super::Deployment, game_id: u32, command: Command, timestamp: u64, expected: u64) {
    let tx_hash = 54321;
    snforge_std::start_cheat_transaction_hash(d.games, tx_hash);
    let mut spy = snforge_std::spy_events();
    if !super::resource_commands::execute_in_game(d, game_id, command, timestamp) {
        let rejected = super::play_fixture::rejection(ref spy, d.games);
        panic!("batch rejected: {}", rejected.reason);
    }
    let mut count = 0;
    for (_, event) in spy.get_events().emitted_by(d.games).events.span() {
        if event.keys.span() == array![selector!("BatchProgress"), game_id.into()].span() {
            assert_eq!(event.data.span(), array![d.actor.into(), tx_hash, expected.into()].span());
            count += 1;
        }
    }
    assert_eq!(count, 1);
}
pub fn final_checkpoint(d: super::Deployment) -> u32 {
    snforge_std::cheat_caller_address(d.games, d.games, snforge_std::CheatSpan::TargetCalls(1));
    crate::registrar::IGameSettlementDispatcherTrait::mark_game_settled(
        crate::registrar::IGameSettlementDispatcher { contract_address: d.games },
        3,
        super::authority(),
        crate::commands::action_context(
            crate::commands::ExecutionContext { timestamp: 1000, ..super::context(d.games, 3) },
        ),
    )
        .try_into()
        .unwrap()
}
pub fn points(deployment: super::Deployment) -> IPointsDispatcher {
    IPointsDispatcher { contract_address: deployment.games }
}
