pub use snforge_std::{EventSpyTrait, EventsFilterTrait};
pub use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess, StoragePathEntry, StoragePointerWriteAccess};
pub use crate::commands::Command;
pub use crate::tests::play_fixture::{IPlayFixtureSafeDispatcher, IPlayFixtureSafeDispatcherTrait, TestAction};
pub use crate::tests::{Deployment, play_fixture};
pub fn routes() -> u32 {
    crate::command_routes::COMMAND_IDS.span().len()
}
pub const ROOTS: u64 = 32;
pub fn fresh_world() -> Deployment {
    super::setup_with_domains(true, "StructuresLogic", "TroopsLogic")
}
#[derive(Drop, PartialEq, Debug)]
pub enum Verdict {
    Applied,
    Rejected: ByteArray,
    Refused: Array<felt252>,
}
#[feature("safe_dispatcher")]
pub fn verdict(games: starknet::ContractAddress, action: TestAction, root: u256, timestamp: u64) -> Verdict {
    let release = play_fixture::pins(games, action.game_id);
    play_fixture::caller(games, action.actor, timestamp);
    let fixture = IPlayFixtureSafeDispatcher { contract_address: games };
    let mut spy = snforge_std::spy_events();
    let played = fixture.play_with_root(action.game_id, release, play_fixture::encode(action.command), root);
    match played {
        Ok(()) => if fixture.last_applied().unwrap() {
            Verdict::Applied
        } else {
            let rejected = play_fixture::rejection(ref spy, games);
            assert_eq!(rejected.status_class, 'GAMEPLAY_REJECTED');
            assert_eq!(rejected.actor, action.actor);
            Verdict::Rejected(rejected.reason)
        },
        Err(error) => Verdict::Refused(error),
    }
}
pub fn release_enables(index: u32) -> bool {
    let id = *crate::command_routes::COMMAND_IDS.span().at(index);
    crate::rules::command_enabled(crate::balance::rules::SWITCHES.command_mask, id.into())
}
pub fn assert_route(command: Command, index: u32) {
    let encoded = play_fixture::encode(command);
    let (actual, _, _) = crate::commands::validated_command(encoded).expect('INVALID_TYPED_VECTOR');
    assert_eq!(actual, *crate::command_routes::COMMAND_IDS.span().at(index));
}
pub fn draw_case(case: u8) -> (Deployment, TestAction, u64) {
    match case {
        0 => explorer_case(false),
        1 => explorer_case(true),
        3 => season_case(),
        _ => panic!("unknown draw case"),
    }
}
pub fn explorer_case(explore: bool) -> (Deployment, TestAction, u64) {
    let (d, home) = super::camps::setup();
    for resource in array![26_u8, 35, 36] {
        super::resource_commands::grant(d, home, resource, 100 * crate::rules::RESOURCE_PRECISION);
    }
    let create = Command::CreateExplorer(
        crate::commands::CreateExplorer {
            slot: 2,
            structure_id: home.entity_id,
            category: 0,
            tier: 0,
            amount: crate::rules::RESOURCE_PRECISION,
            direction: 2,
        },
    );
    let command = if explore {
        let army = crate::tests::state::StructureObservationTrait::home_armies(
            crate::structures::IStructureOperationsDispatcher { contract_address: d.games }, home,
        );
        Command::Explore(crate::commands::Explore { explorer_id: *army.at(0), direction: 0 })
    } else {
        create
    };
    (d, TestAction { game_id: 3, actor: d.actor, command }, play_fixture::FIXTURE_START + 140)
}
pub fn season_case() -> (Deployment, TestAction, u64) {
    let d = super::registrar::setup();
    let game_id = play_fixture::create_game(d.games, play_fixture::fixture_params('season'));
    (d, play_fixture::settle_action(d, game_id, d.actor, 1), play_fixture::FIXTURE_START + 50)
}
