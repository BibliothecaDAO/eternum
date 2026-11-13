use starknet::storage::{
    StorageMapReadAccess, StorageMapWriteAccess, StoragePathEntry, StoragePointer, StoragePointerReadAccess,
    SubPointersForward,
};
use crate::deep::DeepGuard;
use crate::resources::ResourceKey;
use crate::troops::{ExplorerKey, ExplorerTroops, IBattleResolutionDispatcherTrait};

pub fn entry(key: ExplorerKey) -> Option<StoragePointer<DeepGuard>> {
    crate::state::read().deep.guards.entry((key.game_id, key.explorer_id)).sub_pointers()
}

pub fn assert_field(key: ExplorerKey) {
    assert!(entry(key).is_none(), "army is guarding a Deep site");
}

pub fn join(key: ExplorerKey, explorer: ExplorerTroops, site: ResourceKey) {
    assert_joinable(key, explorer, site);
    let slot = available_slot(site, explorer.owner);
    crate::logic::map::MapState::vacate(crate::geometry::tile_key(key.game_id, explorer.coord), key.explorer_id);
    occupy_slot(key, DeepGuard { site_id: site.entity_id, slot });
}

fn assert_joinable(key: ExplorerKey, explorer: ExplorerTroops, site: ResourceKey) {
    assert!(key.game_id == site.game_id, "foreign Deep site");
    let target = crate::logic::deep_sites::site(site).expect('missing Deep site');
    assert!(entry(key).is_none(), "army already guarding");
    assert!(explorer.troops.count != 0, "dead Deep guard");
    assert!(crate::logic::army_days::require(key) == target.day, "Deep guard day mismatch");
    let destination = crate::logic::map::entity_coord(site).expect('missing Deep site position');
    assert!(crate::geometry::adjacent(explorer.coord, destination), "Deep site requires adjacency");
    assert!(
        crate::logic::guards::guard(
            crate::guards::GuardKey { game_id: site.game_id, structure_id: site.entity_id, slot: 0 },
        )
            .troops
            .count == 0,
        "Deep beast still guards site",
    );
}

fn occupy_slot(key: ExplorerKey, value: DeepGuard) {
    let state = crate::state::write();
    state.deep.guards.write((key.game_id, key.explorer_id), Some(value));
    state.deep.slots.write((key.game_id, value.site_id, value.slot), key.explorer_id);
    let mut keys = array![];
    key.serialize(ref keys);
    let mut values = array![];
    value.serialize(ref values);
    crate::logic::troops::TroopState::emit(
        crate::logic::troops::TroopState::Event::RowSet(
            crate::events::RowSet { version: 1, model: 'DeepGuard', keys: keys.span(), values: values.span() },
        ),
    );
}

fn available_slot(site: ResourceKey, home: u64) -> u8 {
    let state = crate::state::read();
    let owner = crate::logic::structures::record(ResourceKey { game_id: site.game_id, entity_id: home }).owner;
    let aspect = crate::logic::aspects::home_aspect(ResourceKey { game_id: site.game_id, entity_id: home });
    let mut vacant = None;
    for slot in 0..crate::rules::DEEP_GUARD_SLOTS {
        let explorer_id = state.deep.slots.read((site.game_id, site.entity_id, slot));
        if explorer_id == 0 {
            if vacant.is_none() {
                vacant = Some(slot);
            }
            continue;
        }
        let held = crate::logic::troops::explorer(ExplorerKey { game_id: site.game_id, explorer_id })
            .expect('missing Deep guard army');
        let holder = ResourceKey { game_id: site.game_id, entity_id: held.owner };
        assert!(crate::logic::aspects::home_aspect(holder) == aspect, "Deep site belongs to another Aspect");
        assert!(crate::logic::structures::record(holder).owner != owner, "player already guards site");
    }
    vacant.expect('Deep site has four guards')
}

pub fn remove(key: ExplorerKey) {
    let Some(value) = entry(key) else {
        return;
    };
    let site_id = value.site_id.read();
    let slot = value.slot.read();
    let state = crate::state::write();
    assert!(state.deep.slots.read((key.game_id, site_id, slot)) == key.explorer_id, "Deep guard index mismatch");
    state.deep.guards.write((key.game_id, key.explorer_id), None);
    state.deep.slots.write((key.game_id, site_id, slot), 0);
    let mut keys = array![];
    key.serialize(ref keys);
    crate::logic::troops::TroopState::emit(
        crate::logic::troops::TroopState::Event::RowDeleted(
            crate::events::RowDeleted { version: 1, model: 'DeepGuard', keys: keys.span() },
        ),
    );
}

pub fn expire(site: ResourceKey, context: crate::commands::ExecutionContext) {
    let state = crate::state::read();
    for slot in 0..crate::rules::DEEP_GUARD_SLOTS {
        let explorer_id = state.deep.slots.read((site.game_id, site.entity_id, slot));
        if explorer_id == 0 {
            continue;
        }
        let key = ExplorerKey { game_id: site.game_id, explorer_id };
        let army = crate::logic::troops::explorer(key).expect('missing expired Deep guard');
        crate::logic::combat::combat_troops(key.game_id)
            .expire_explorer(key, army, crate::commands::action_context(context));
    }
}
