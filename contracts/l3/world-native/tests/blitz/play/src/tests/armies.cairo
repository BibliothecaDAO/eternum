pub use world_test_support::tests::troop_management::*;
use super::fixture::{GRASSLAND, REALM_COORD, blitz_realm};
use super::play_fixture::FIXTURE_START;
use super::resource_commands::{execute_in_game, grant};

const KNIGHT_T1: u8 = 26;
const NOW: u64 = FIXTURE_START + 40;
const DAYS_LATER: u64 = FIXTURE_START + 5 * 86400;
const EAST: u8 = 0;

fn troops(amount: u128) -> u128 {
    amount * RESOURCE_PRECISION
}

fn raise(home: ResourceKey, slot: u8, amount: u128) -> Command {
    Command::CreateExplorer(
        CreateExplorer {
            slot, structure_id: home.entity_id, category: 0, tier: 0, amount: troops(amount), direction: EAST,
        },
    )
}

fn stock(d: super::Deployment, home: ResourceKey) -> u128 {
    IResourceOperationsDispatcher { contract_address: d.games }
        .resource_balance(ResourceSlot { game_id: home.game_id, entity_id: home.entity_id, resource_type: KNIGHT_T1 })
}

fn armies(d: super::Deployment, home: ResourceKey) -> Span<u64> {
    IStructureOperationsDispatcher { contract_address: d.games }.home_armies(home)
}

fn army(d: super::Deployment, home: ResourceKey, id: u64) -> Option<ExplorerTroops> {
    GameState { contract_address: d.games }.explorer(ExplorerKey { game_id: home.game_id, explorer_id: id })
}

fn garrison(d: super::Deployment, home: ResourceKey) -> crate::guards::Guard {
    IGuardsDispatcher { contract_address: d.games }
        .guard(GuardKey { game_id: home.game_id, structure_id: home.entity_id, slot: 0 })
}

fn army_world() -> (super::Deployment, ResourceKey, u64) {
    let (d, home) = blitz_realm();
    grant(d, home, KNIGHT_T1, troops(500));
    assert!(execute_in_game(d, home.game_id, raise(home, 0, 100), NOW));
    (d, home, *armies(d, home).at(0))
}

fn initial_stamina() -> u64 {
    crate::balance::rules::TROOP_STAMINA_CONFIG.stamina_initial.into()
}

#[test]
fn an_army_is_raised_beside_its_realm_from_the_troop_stock_alone() {
    let (d, home, id) = army_world();
    let raised = army(d, home, id).unwrap();
    assert_eq!(stock(d, home), troops(400));
    assert_eq!(raised.owner, home.entity_id);
    assert_eq!(raised.troops.count, troops(100));
    assert_eq!(raised.coord, crate::geometry::neighbor(REALM_COORD, EAST));
    assert_eq!(raised.troops.stamina.inline().amount, initial_stamina());
    let tile = IMapLogicDispatcher { contract_address: d.games }
        .tile(crate::geometry::tile_key(home.game_id, raised.coord))
        .unwrap();
    assert_eq!(tile.data / crate::map::BIOME_SCALE % crate::map::BYTE_RANGE, GRASSLAND.into());
}

#[test]
fn an_army_is_raised_only_in_the_first_slot() {
    let (d, home) = blitz_realm();
    grant(d, home, KNIGHT_T1, troops(500));
    assert!(!execute_in_game(d, home.game_id, raise(home, 1, 100), NOW));
    assert_eq!(armies(d, home).len(), 0);
    assert_eq!(stock(d, home), troops(500));
}

#[test]
fn a_realm_raises_no_more_armies_than_its_limit() {
    let (d, home, _) = army_world();
    let second = Command::CreateExplorer(
        CreateExplorer {
            slot: 0, structure_id: home.entity_id, category: 0, tier: 0, amount: troops(100), direction: 1,
        },
    );
    assert!(!execute_in_game(d, home.game_id, second, NOW));
    assert_eq!(armies(d, home).len(), 1);
    assert_eq!(stock(d, home), troops(400));
}

#[test]
fn an_army_is_still_commanded_days_after_it_was_raised_and_a_reinforcement_tires_it() {
    let (d, home, id) = army_world();
    let reinforce = manage(
        ManageTroops::RecruitExplorer(RecruitExplorer { explorer_id: id, amount: troops(50), supply_post: None }),
    );
    assert!(execute_in_game(d, home.game_id, reinforce, DAYS_LATER));
    let reinforced = army(d, home, id).unwrap();
    assert_eq!(reinforced.troops.count, troops(150));
    assert_eq!(reinforced.troops.stamina.inline().amount, initial_stamina());
    assert_eq!(stock(d, home), troops(350));
}

#[test]
fn a_removed_army_frees_its_tile_and_its_place_at_the_realm() {
    let (d, home, id) = army_world();
    assert!(execute_in_game(d, home.game_id, manage(ManageTroops::RemoveExplorer(id)), DAYS_LATER));
    assert!(army(d, home, id).is_none());
    assert_eq!(armies(d, home).len(), 0);
    assert!(execute_in_game(d, home.game_id, raise(home, 0, 100), DAYS_LATER));
    assert_eq!(armies(d, home).len(), 1);
}

#[test]
fn a_guard_is_recruited_from_the_troop_stock_alone() {
    let (d, home) = blitz_realm();
    grant(d, home, KNIGHT_T1, troops(500));
    let recruit = manage(
        ManageTroops::RecruitGuard(
            RecruitGuard {
                guard: GuardSlot { structure_id: home.entity_id, slot: 0 },
                category: TroopType::Knight,
                tier: TroopTier::T1,
                amount: troops(200),
            },
        ),
    );
    assert!(execute_in_game(d, home.game_id, recruit, NOW));
    assert_eq!(garrison(d, home).troops.count, troops(200));
    assert_eq!(stock(d, home), troops(300));
}

#[test]
fn an_army_gives_troops_to_the_guard_of_its_realm() {
    let (d, home, id) = army_world();
    let give = manage(
        ManageTroops::Transfer(
            TransferTroops {
                source: Army::Explorer(id),
                target: Army::Guard(GuardSlot { structure_id: home.entity_id, slot: 0 }),
                amount: troops(40),
            },
        ),
    );
    assert!(execute_in_game(d, home.game_id, give, DAYS_LATER));
    assert_eq!(army(d, home, id).unwrap().troops.count, troops(60));
    assert_eq!(garrison(d, home).troops.count, troops(40));
}
