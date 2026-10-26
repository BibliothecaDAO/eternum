pub use snforge_std::{EventSpyTrait, EventsFilterTrait, start_cheat_caller_address, stop_cheat_caller_address};
pub use starknet::ContractAddress;
pub use crate::blitz_results::{
    IBlitzResultsDispatcher, IBlitzResultsDispatcherTrait, IBlitzResultsSafeDispatcher,
    IBlitzResultsSafeDispatcherTrait, RankedPlayer,
};
pub use crate::commands::{Command, ExecutionContext};
pub use crate::game::{IGameDispatcher, IGameDispatcherTrait};
pub use crate::registrar::RosterPlayer;
pub use super::resource_commands::{execute, set_fixture, setup_with_rules};
pub fn player(index: u32) -> ContractAddress {
    Into::<u32, felt252>::into(100 + index).try_into().unwrap()
}
pub fn result(index: u32, rank: u16) -> RankedPlayer {
    RankedPlayer { wallet: player(index), rank }
}
pub fn view(d: super::Deployment) -> IBlitzResultsDispatcher {
    IBlitzResultsDispatcher { contract_address: d.games }
}
pub fn games(d: super::Deployment) -> IGameDispatcher {
    IGameDispatcher { contract_address: d.games }
}
pub fn setup(scores: Span<u128>) -> super::Deployment {
    let (d, _, _) = setup_with_rules(
        crate::rules::SliceRules {
            mode_rules: super::play_fixture::BLITZ_RULES,
            entry_rule: crate::rules::ENTRY_ROSTER,
            command_mask: super::play_fixture::BLITZ_COMMAND_MASK,
            ..super::play_fixture::rules(),
        },
    );
    set_fixture(d.games, selector!("registrar"), selector!("roster_sizes"), array![3].span(), scores.len());
    for index in 0..scores.len() {
        set_fixture(
            d.games,
            selector!("registrar"),
            selector!("roster_players"),
            array![3, index.into()].span(),
            RosterPlayer { account: player(index), wallet: player(index) },
        );
        set_fixture(
            d.games,
            selector!("season"),
            selector!("player_points"),
            array![3, player(index).into()].span(),
            *scores.at(index),
        );
    }
    set_fixture(
        d.games,
        selector!("games"),
        selector!("games"),
        array![3].span(),
        crate::game::GameRegistry { settled: true, ..games(d).game(3) },
    );
    d
}
pub fn submit(d: super::Deployment) -> bool {
    execute(d, Command::RecordBlitzResults, 500)
}
