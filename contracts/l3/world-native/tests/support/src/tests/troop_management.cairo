pub use eternum_cubit::f128::types::fixed::FixedTrait;
pub use snforge_std::{
    EventSpyTrait, EventsFilterTrait, spy_events, start_cheat_caller_address, stop_cheat_caller_address,
};
pub use crate::combat::TroopsTrait;
pub use crate::commands::{Command, CreateExplorer, Move};
pub use crate::guards::{GuardKey, IGuardsDispatcher, IGuardsDispatcherTrait};
pub use crate::map::IMapLogicDispatcher;
pub use crate::names::{
    BASE_REALM_SKIN, DEFAULT_REALM_SKIN, DEVCON_REALM_SKIN, GOLDEN_DEVCON_REALM_SKIN, INamesDispatcher,
    INamesDispatcherTrait, SEASON_ONE_REALM_SKIN, SetEntityName, SetRealmSkin, WONDER_REALM_SKIN,
};
pub use crate::ownership::{GuardAddStory, Story};
pub use crate::resources::{IResourceOperationsDispatcher, ResourceKey, ResourceSlot};
pub use crate::rules::RESOURCE_PRECISION;
pub use crate::stamina::StaminaSourceTrait;
pub use crate::structures::IStructureOperationsDispatcher;
pub use crate::tests::state::{
    GameState, MapObservationTrait, ResourceObservationTrait, StructureObservationTrait, TroopObservationTrait,
};
pub use crate::troop_management::{Army, GuardSlot, ManageTroops, RecruitExplorer, RecruitGuard, TransferTroops};
pub use crate::troops::{ExplorerKey, ExplorerTroops, TroopTier, TroopType};
pub use super::resource_commands::{assert_terminal_rejection, execute, grant, set_fixture};
pub fn setup_homes() -> (super::Deployment, ResourceKey, ResourceKey, u64, u64) {
    let (d, home, other_home) = super::resource_commands::setup();
    let structures = IStructureOperationsDispatcher { contract_address: d.games };
    let ids = structures.home_armies(home);
    for (army, size) in array![(*ids.at(0), 10_u128), (*ids.at(1), 5)] {
        super::resource_commands::size_army(d, ExplorerKey { game_id: 3, explorer_id: army }, size);
    }
    (d, home, other_home, *ids.at(0), *ids.at(1))
}
pub fn setup() -> (super::Deployment, ResourceKey, u64, u64) {
    let (d, home, _, first, second) = setup_homes();
    (d, home, first, second)
}
pub fn replay_armies(record: bool) {
    let (d, home, other, first, second) = setup_homes();
    grant(d, home, 35, 1000 * RESOURCE_PRECISION);
    grant(d, home, 36, 1000 * RESOURCE_PRECISION);
    let origin = troop(d, first).unwrap().coord;
    let destination = crate::geometry::neighbor(origin, 0);
    let map = IMapLogicDispatcher { contract_address: d.games };
    map.reveal(crate::geometry::tile_key(3, destination), 11);
    let entities = array![home.entity_id, other.entity_id, first, second].span();
    let tiles = array![origin, troop(d, second).unwrap().coord, destination].span();
    let mut frames = array![super::spatial_replay::initial(d.games, 3, entities, tiles)];
    let mut spy = spy_events();
    for (command, timestamp) in array![
        (
            Command::Move(Move { explorer_id: first, directions: array![0_u8].span() }),
            super::play_fixture::FIXTURE_START + 120,
        ),
        (
            Command::Move(Move { explorer_id: first, directions: array![3_u8].span() }),
            super::play_fixture::FIXTURE_START + 140,
        ),
        (transfer(Army::Explorer(first), Army::Explorer(second), 10), super::play_fixture::FIXTURE_START + 140),
        (manage(ManageTroops::RemoveExplorer(second)), super::play_fixture::FIXTURE_START + 150),
    ] {
        assert!(execute(d, command, timestamp), "replay command refused at {}", timestamp);
        super::state::assert_spatial_indexes(d.games, 3, entities, tiles);
        frames.append(super::spatial_replay::capture(d.games, 3, entities, tiles, ref spy));
    }
    super::spatial_replay::compare("armies", frames, record);
}
pub fn troop(d: super::Deployment, id: u64) -> Option<ExplorerTroops> {
    GameState { contract_address: d.games }.resolved_explorer(ExplorerKey { game_id: 3, explorer_id: id })
}
pub fn guard(d: super::Deployment, home: ResourceKey, slot: u8) -> crate::guards::Guard {
    IGuardsDispatcher { contract_address: d.games }.guard(GuardKey { game_id: 3, structure_id: home.entity_id, slot })
}
pub fn manage(action: ManageTroops) -> Command {
    Command::ManageTroops(action)
}
pub fn transfer(source: Army, target: Army, amount: u128) -> Command {
    manage(ManageTroops::Transfer(TransferTroops { source, target, amount: amount * RESOURCE_PRECISION }))
}
pub fn recruit(home: ResourceKey, slot: u8, amount: u128) -> Command {
    manage(
        ManageTroops::RecruitGuard(
            RecruitGuard {
                guard: GuardSlot { structure_id: home.entity_id, slot },
                category: TroopType::Knight,
                tier: TroopTier::T1,
                amount: amount * RESOURCE_PRECISION,
            },
        ),
    )
}
pub fn resource(d: super::Deployment) -> IResourceOperationsDispatcher {
    IResourceOperationsDispatcher { contract_address: d.games }
}
pub fn count(d: super::Deployment, home: ResourceKey) -> u128 {
    resource(d).resource_balance(ResourceSlot { game_id: 3, entity_id: home.entity_id, resource_type: 26 })
}
