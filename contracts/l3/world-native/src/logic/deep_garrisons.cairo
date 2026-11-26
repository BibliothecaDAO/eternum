use starknet::ContractAddress;
use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess};
use crate::deep::GarrisonSlot;
use crate::guards::GuardKey;
use crate::resources::ResourceKey;
use crate::troops::Troops;

pub fn home(key: GuardKey) -> u64 {
    crate::state::read().deep.slots.read((key.game_id, key.structure_id, key.slot))
}

pub fn is_site(game_id: u32, structure_id: u64) -> bool {
    crate::rules::DEEP_IN_PLAY
        && crate::logic::deep_sites::site(ResourceKey { game_id, entity_id: structure_id }).is_some()
}

pub fn assert_garrison(key: GuardKey, army_home: u64, troops: Troops) {
    let site = crate::logic::deep_sites::site(site_key(key)).expect('missing Deep site');
    assert!(site.aspect != 0, "site is not claimed");
    assert!(
        crate::logic::aspects::home_aspect(ResourceKey { game_id: key.game_id, entity_id: army_home }) == site.aspect,
        "only the owner and his Aspect garrison this site",
    );
    if !crate::rules::deep_allies_garrison(site.kind) {
        assert!(
            crate::logic::structures::owner(
                ResourceKey { game_id: key.game_id, entity_id: army_home },
            ) == crate::logic::structures::owner(site_key(key)),
            "only the owner garrisons this site",
        );
    }
    let holder = home(key);
    assert!(holder == 0 || holder == army_home, "slot belongs to another player");
    let held = crate::logic::guards::guard(key).troops;
    assert!(held.count == 0 || same_type(held, troops), "slot holds another troop type");
    for slot in 0..crate::rules::DEEP_GUARD_SLOTS {
        let other = GuardKey { slot, ..key };
        if slot != key.slot && home(other) == army_home {
            assert!(
                !same_type(crate::logic::guards::guard(other).troops, troops),
                "you already garrison this troop type here",
            );
        }
    }
}

pub fn assert_withdraw(key: GuardKey, army_home: u64) {
    assert!(home(key) == army_home, "slot belongs to another player");
}

pub fn record(key: GuardKey, army_home: u64) {
    if crate::logic::guards::guard(key).troops.count == 0 {
        vacate(key);
    } else if home(key) == 0 {
        occupy(key, army_home);
    }
}

pub fn claim(site: ResourceKey, army_home: u64) -> ContractAddress {
    let army_home = ResourceKey { game_id: site.game_id, entity_id: army_home };
    let owner = crate::logic::structures::owner(army_home);
    clear(site, owner);
    crate::logic::deep_sites::hold(site, crate::logic::aspects::home_aspect(army_home));
    owner
}

pub fn clear(site: ResourceKey, owner: ContractAddress) {
    for slot in 0..crate::rules::DEEP_GUARD_SLOTS {
        let key = GuardKey { game_id: site.game_id, structure_id: site.entity_id, slot };
        vacate(key);
        let guard = crate::logic::guards::guard(key);
        if guard.troops.count != 0 || guard.destroyed_tick != 0 {
            crate::logic::guards::GuardState::save(key, Default::default());
        }
    }
    if crate::logic::structures::owner(site) != owner {
        crate::logic::structures::StructureState::transfer_owner(site, owner);
    }
}

pub fn count(site: ResourceKey) -> u64 {
    let mut held = 0;
    for slot in 0..crate::rules::DEEP_GUARD_SLOTS {
        if home(GuardKey { game_id: site.game_id, structure_id: site.entity_id, slot }) != 0 {
            held += 1;
        }
    }
    held
}

fn same_type(a: Troops, b: Troops) -> bool {
    a.category == b.category && a.tier == b.tier
}

fn site_key(key: GuardKey) -> ResourceKey {
    ResourceKey { game_id: key.game_id, entity_id: key.structure_id }
}

fn occupy(key: GuardKey, army_home: u64) {
    crate::state::write().deep.slots.write((key.game_id, key.structure_id, key.slot), army_home);
    let mut keys = array![];
    key.serialize(ref keys);
    let mut values = array![];
    GarrisonSlot { home: army_home }.serialize(ref values);
    crate::logic::troops::TroopState::emit(
        crate::logic::troops::TroopState::Event::RowSet(
            crate::events::RowSet { version: 1, model: 'GarrisonSlot', keys: keys.span(), values: values.span() },
        ),
    );
}

fn vacate(key: GuardKey) {
    if home(key) == 0 {
        return;
    }
    crate::state::write().deep.slots.write((key.game_id, key.structure_id, key.slot), 0);
    let mut keys = array![];
    key.serialize(ref keys);
    crate::logic::troops::TroopState::emit(
        crate::logic::troops::TroopState::Event::RowDeleted(
            crate::events::RowDeleted { version: 1, model: 'GarrisonSlot', keys: keys.span() },
        ),
    );
}
