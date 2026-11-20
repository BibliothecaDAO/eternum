pub use snforge_std::fs::{FileTrait, read_txt};
pub use snforge_std::{EventSpyTrait, EventsFilterTrait, start_cheat_caller_address, stop_cheat_caller_address};
pub use crate::commands::Command;
pub use crate::game::{IPointsDispatcher, IPointsDispatcherTrait};
pub use super::resource_commands::{assert_terminal_rejection, execute, setup_with_rules};
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
pub fn points(deployment: super::Deployment) -> IPointsDispatcher {
    IPointsDispatcher { contract_address: deployment.games }
}
