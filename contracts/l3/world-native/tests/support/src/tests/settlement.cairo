pub use snforge_std::fs::{FileTrait, read_txt};
pub use snforge_std::start_cheat_caller_address;
pub use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess};
pub use crate::game::{IGameDispatcher, IGameDispatcherTrait};
pub use crate::map::IMapLogicDispatcher;
pub use crate::realms::{ISeasonPlacementDispatcher, ISeasonPlacementDispatcherTrait, ISeasonPlacementSafeDispatcher};
pub use crate::registrar::IRegistrarSafeDispatcherTrait;
pub use crate::settlement::{
    IBlitzReservationsSafeDispatcher, IBlitzReservationsSafeDispatcherTrait, ISettlementEntrySafeDispatcherTrait,
    ISettlementPoolDispatcher, ISettlementPoolDispatcherTrait, ISettlementPoolSafeDispatcher,
    ISettlementViewsDispatcher, ISettlementViewsDispatcherTrait, ISettlementViewsSafeDispatcherTrait, SettlementMode,
    SettlementRules,
};
pub use crate::tests::state::MapObservationTrait;
pub use super::{Deployment, authority, context, play_fixture, setup};
pub fn grants() -> crate::settlement::RealmGrants {
    let data = read_txt(@FileTrait::new("../fixtures/settlement.txt"));
    let mut fields = data.span();
    let grants = Serde::deserialize(ref fields).unwrap();
    assert!(fields.is_empty(), "trailing settlement fixture");
    grants
}
pub fn grants_for(entry_rule: u8) -> crate::settlement::RealmGrants {
    if entry_rule == crate::rules::ENTRY_ROSTER {
        crate::settlement::RealmGrants { starting_troops: array![].span(), ..grants() }
    } else {
        grants()
    }
}
pub fn rules() -> SettlementRules {
    SettlementRules { registration_start: 10, registration_limit: 96, mode: SettlementMode::Single, spacing: 6 }
}
pub fn seed_settlement(deployment: Deployment, game_id: u32, rules: SettlementRules) {
    let games = IGameDispatcher { contract_address: deployment.games };
    let mut preset = play_fixture::fixture_preset(games.rules(game_id));
    if rules.mode != SettlementMode::Single {
        preset.rules.entry_rule = crate::rules::ENTRY_ROSTER;
    }
    preset.settlement.mode = rules.mode;
    preset.settlement.spacing = rules.spacing;
    preset.settlement.realms = grants_for(preset.rules.entry_rule);
    play_fixture::seed_game_with_preset(deployment.games, game_id, games.game(game_id), preset);
    snforge_std::interact_with_state(
        deployment.games,
        || {
            let state = crate::state::write();
            let previous = state.games.overrides.read(game_id);
            state
                .games
                .overrides
                .write(
                    game_id, crate::game::GameOverrides { registration_start: rules.registration_start, ..previous },
                );
            state.registrar.roster_sizes.write(game_id, rules.registration_limit.into());
        },
    );
}
pub fn remember_distinct(ref seen: Array<crate::troops::Coord>, added: Span<crate::troops::Coord>) {
    for coord in added {
        for previous in seen.span() {
            assert!(*previous != *coord, "realm and village reservation overlap");
        }
        seen.append(*coord);
    }
}
