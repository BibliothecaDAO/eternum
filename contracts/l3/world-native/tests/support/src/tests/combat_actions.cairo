pub use snforge_std::{
    EventSpyTrait, EventsFilterTrait, spy_events, start_cheat_caller_address, stop_cheat_caller_address,
};
pub use crate::combat::TroopsTrait;
pub use crate::combat_actions::{AttackExplorer, GuardAttack};
pub use crate::commands::{Command, CreateExplorer};
pub use crate::guards::{Guard, GuardKey, IGuardsDispatcher, IGuardsDispatcherTrait};
pub use crate::map::{IMapLogicDispatcher, IMapLogicDispatcherTrait};
pub use crate::resources::{IResourceOperationsDispatcher, ResourceAmount, ResourceKey, ResourceSlot};
pub use crate::rules::RESOURCE_PRECISION;
pub use crate::structures::{IStructureOperationsDispatcher, StructureRecord};
pub use crate::tests::state::{
    GameState, MapObservationTrait, ResourceObservationTrait, StructureObservationTrait, TroopObservationTrait,
};
pub use crate::troops::{Coord, ExplorerKey, ExplorerTroops, Stamina, Troops};
pub use super::resource_commands::{assert_terminal_rejection, execute, grant, set_fixture};
pub fn setup() -> (super::Deployment, ResourceKey, ResourceKey, u64, u64) {
    setup_with_counts((100, 1))
}
pub fn setup_with_counts(counts: (u128, u128)) -> (super::Deployment, ResourceKey, ResourceKey, u64, u64) {
    let (d, home, target) = super::resource_commands::setup();
    let mut ids = array![];
    let (attacker_count, defender_count) = counts;
    for (key, amount) in array![(home, attacker_count), (target, defender_count)] {
        let army = *IStructureOperationsDispatcher { contract_address: d.games }.home_armies(key).at(0);
        super::resource_commands::size_army(d, ExplorerKey { game_id: key.game_id, explorer_id: army }, amount);
        ids.append(army);
    }
    let attacker = *ids.at(0);
    let defender = *ids.at(1);
    move_fixture(d, attacker, 2000009);
    move_fixture(d, defender, 2000008);
    let original = IStructureOperationsDispatcher { contract_address: d.games }.structure(target).unwrap();
    set_fixture(
        d.games,
        selector!("structures"),
        selector!("structures"),
        array![3, target.entity_id.into()].span(),
        StructureRecord {
            owner: 999.try_into().unwrap(),
            base: original.base,
            resources_packed: original.resources_packed,
            metadata: original.metadata,
        },
    );
    (d, home, target, attacker, defender)
}
pub fn into_deep(d: super::Deployment, home: ResourceKey, target: ResourceKey, attacker: u64, defender: u64) {
    let center = crate::deep::center(crate::logic::settlement::spacing());
    move_to(d, attacker, center);
    move_to(d, defender, crate::geometry::neighbor(center, 0));
    let context = crate::commands::ExecutionContext {
        timestamp: super::play_fixture::FIXTURE_START, ..crate::tests::context(d.games, 3),
    };
    snforge_std::interact_with_state(
        d.games,
        || {
            crate::logic::deep_armies::enter(
                ExplorerKey { game_id: 3, explorer_id: attacker }, home.entity_id, context,
            );
            crate::logic::deep_armies::enter(
                ExplorerKey { game_id: 3, explorer_id: defender }, target.entity_id, context,
            );
            let own = crate::logic::aspects::home_aspect(home);
            let packed = crate::logic::aspects::rules();
            let mut order = 1;
            while crate::aspects::order_aspect(packed, order) == own {
                order += 1;
            }
            starknet::storage::StorageMapWriteAccess::write(
                crate::state::write().settlements.home_aspects,
                (target.game_id, target.entity_id),
                crate::aspects::order_aspect(packed, order),
            );
        },
    );
}
pub fn troop(d: super::Deployment, id: u64) -> Option<ExplorerTroops> {
    GameState { contract_address: d.games }.explorer(ExplorerKey { game_id: 3, explorer_id: id })
}
pub fn move_fixture(d: super::Deployment, id: u64, x: u32) {
    move_to(d, id, Coord { alt: false, x, y: 2000000 });
}
pub fn move_to(d: super::Deployment, id: u64, coord: Coord) {
    let mut explorer = troop(d, id).unwrap();
    let map = IMapLogicDispatcher { contract_address: d.games };
    start_cheat_caller_address(d.games, d.games);
    map.vacate(crate::geometry::tile_key(3, explorer.coord), id);
    explorer.coord = coord;
    map.occupy(crate::geometry::tile_key(3, explorer.coord), id, 2, false);
    stop_cheat_caller_address(d.games);
    crate::tests::resource_commands::set_explorer_fixture(
        d.games, crate::troops::ExplorerKey { game_id: 3, explorer_id: id }, explorer,
    );
}
pub fn balance(d: super::Deployment, id: u64, resource_type: u8) -> u128 {
    IResourceOperationsDispatcher { contract_address: d.games }
        .resource_balance(ResourceSlot { game_id: 3, entity_id: id, resource_type })
}
pub fn resources(amount: u128) -> Span<ResourceAmount> {
    array![ResourceAmount { resource_type: 2, amount }].span()
}
pub fn set_guard(d: super::Deployment, key: ResourceKey, slot: u8, count: u128) {
    set_fixture(
        d.games,
        selector!("guards"),
        selector!("guards"),
        array![3, key.entity_id.into(), slot.into()].span(),
        Guard {
            troops: Troops {
                count: count * RESOURCE_PRECISION,
                stamina: Stamina { amount: 120, settled_at: 80, remainder: 0 }.into(),
                ..Default::default(),
            },
            destroyed_tick: 0,
        },
    );
}
pub fn guard(d: super::Deployment, key: ResourceKey, slot: u8) -> Guard {
    IGuardsDispatcher { contract_address: d.games }.guard(GuardKey { game_id: 3, structure_id: key.entity_id, slot })
}
pub fn limit_guards(d: super::Deployment, key: ResourceKey, maximum: u8) {
    let original = IStructureOperationsDispatcher { contract_address: d.games }.structure(key).unwrap();
    set_fixture(
        d.games,
        selector!("structures"),
        selector!("structures"),
        array![3, key.entity_id.into()].span(),
        StructureRecord {
            owner: original.owner,
            base: crate::structures::StructureBase { troop_max_guard_count: maximum, ..original.base },
            resources_packed: original.resources_packed,
            metadata: original.metadata,
        },
    );
}
