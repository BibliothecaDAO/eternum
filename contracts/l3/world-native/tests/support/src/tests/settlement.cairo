pub use snforge_std::fs::{FileTrait, read_txt};
pub use snforge_std::start_cheat_caller_address;
pub use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess};
pub use crate::game::{IGameDispatcher, IGameDispatcherTrait};
pub use crate::map::IMapLogicDispatcher;
pub use crate::registrar::IRegistrarSafeDispatcherTrait;
pub use crate::settlement::{
    ISettlementEntrySafeDispatcherTrait, ISettlementPoolDispatcher, ISettlementPoolDispatcherTrait,
    ISettlementPoolSafeDispatcher, ISettlementViewsDispatcher, ISettlementViewsDispatcherTrait,
    ISettlementViewsSafeDispatcherTrait, SettlementMode, SettlementRules,
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
pub fn rules() -> SettlementRules {
    SettlementRules {
        registration_start: 10,
        registration_limit: 96,
        mode: SettlementMode::Single,
        spacing: crate::balance::settlement::SETTLEMENT_SPACING_STEPS,
    }
}
pub fn seed_settlement(deployment: Deployment, name: felt252, rules: SettlementRules) -> u32 {
    play_fixture::create_game(
        deployment.games,
        crate::registrar::CreateGameParams {
            registration_start: rules.registration_start, ..play_fixture::fixture_params(name),
        },
    )
}
pub fn remember_distinct(ref seen: Array<crate::troops::Coord>, added: Span<crate::troops::Coord>) {
    for coord in added {
        for previous in seen.span() {
            assert!(*previous != *coord, "realm and village reservation overlap");
        }
        seen.append(*coord);
    }
}
