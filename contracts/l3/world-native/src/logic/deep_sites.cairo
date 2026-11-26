use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess};
#[cfg(not(feature: "blitz"))]
use starknet::storage::{StoragePathEntry, StoragePointerReadAccess};
use crate::commands::ExecutionContext;
use crate::deep::{DeepBeast, DeepRing, DeepSettings, DeepSite};
use crate::guards::{Guard, GuardKey};
use crate::resources::ResourceKey;

#[cfg(feature: "blitz")]
pub fn rules() -> DeepSettings {
    panic!("this family has no Deep")
}

#[cfg(not(feature: "blitz"))]
pub fn rules() -> DeepSettings {
    crate::balance::deep::DEEP_SETTINGS
}

#[cfg(feature: "blitz")]
pub fn ring(_ring: u8) -> DeepRing {
    panic!("this family has no Deep")
}

#[cfg(not(feature: "blitz"))]
pub fn ring(ring: u8) -> DeepRing {
    *crate::balance::deep::DEEP_RINGS.span().at(ring.into())
}

#[cfg(feature: "blitz")]
pub fn beast(_kind: u8) -> DeepBeast {
    panic!("this family has no Deep")
}

#[cfg(not(feature: "blitz"))]
pub fn beast(kind: u8) -> DeepBeast {
    *crate::balance::deep::DEEP_BEASTS.span().at(kind.into())
}

pub fn site_count() -> u8 {
    rules().ring_count * crate::rules::DEEP_RING_SITES
}

pub fn site_id(game_id: u32, index: u8) -> u64 {
    crate::state::read().deep.site_ids.read((game_id, index))
}

pub fn site(key: ResourceKey) -> Option<DeepSite> {
    crate::state::read().deep.sites.read((key.game_id, key.entity_id))
}

pub fn is_open(game_id: u32, site: DeepSite) -> bool {
    crate::state::read().deep.realms_entered.read((game_id, site.day)) >= ring(site.ring).realms
}

pub fn open_by_kind(game_id: u32) -> Span<u8> {
    let mut open = array![];
    for index in 0..site_count() {
        let row = site(ResourceKey { game_id, entity_id: site_id(game_id, index) }).expect('missing Deep site');
        if is_open(game_id, row) {
            open.append(row.kind);
        }
    }
    let mut counts = array![];
    for kind in 0..crate::rules::DEEP_KIND_COUNT {
        let mut count = 0_u8;
        for held in open.span() {
            if *held == kind {
                count += 1;
            }
        }
        counts.append(count);
    }
    counts.span()
}

pub fn assert_open(game_id: u32, site: DeepSite) {
    assert!(is_open(game_id, site), "Deep ring closed");
}

pub fn count_entry(game_id: u32, home: u64, context: ExecutionContext) {
    let day = crate::days::day_of(
        context.game.unbox(), crate::clock::day_unit_seconds(context.game.unbox()), context.timestamp,
    )
        .index;
    let state = crate::state::write();
    if state.deep.realm_entered.read((game_id, day, home)) {
        return;
    }
    state.deep.realm_entered.write((game_id, day, home), true);
    let count = state.deep.realms_entered.read((game_id, day)) + 1;
    state.deep.realms_entered.write((game_id, day), count);
    crate::logic::troops::TroopState::emit(
        crate::logic::troops::TroopState::Event::RowSet(
            crate::events::RowSet {
                version: 1,
                model: 'DeepEntries',
                keys: array![game_id.into(), day.into()].span(),
                values: array![count.into()].span(),
            },
        ),
    );
}

pub fn dispatcher(game_id: u32) -> crate::deep::IDeepSitesLibraryDispatcher {
    let state = crate::state::read();
    let release = state.game_releases.read(game_id);
    assert!(release != 0, "game has no release");
    crate::deep::IDeepSitesLibraryDispatcher {
        class_hash: crate::logic::release::release_class(release, crate::slots::MAP),
    }
}

pub fn beast_size(key: ResourceKey) -> u128 {
    beast(site(key).expect('missing Deep site').kind).count
}

#[cfg(feature: "blitz")]
fn initialize(_game_id: u32) {}

#[cfg(not(feature: "blitz"))]
fn initialize(game_id: u32) {
    let state = crate::state::write();
    crate::logic::deep_ticks::initialize(game_id);
    let start = state.games.games.entry(game_id).start_main_at.read();
    let spacing = crate::logic::settlement::spacing();
    let seed: u256 = state.games.games.entry(game_id).seed.read().into();
    for index in 0..site_count() {
        if state.deep.site_ids.read((game_id, index)) != 0 {
            continue;
        }
        let band = index / crate::rules::DEEP_RING_SITES;
        let place = index % crate::rules::DEEP_RING_SITES;
        let entity_id: u64 = crate::logic::game::allocate_setup_entity(game_id).into();
        state.deep.site_ids.write((game_id, index), entity_id);
        let coord = crate::deep::place(ring(band).radius, place, spacing);
        crate::logic::structures::StructureState::create(ResourceKey { game_id, entity_id }, site_structure(start));
        crate::logic::map::MapState::occupy(
            crate::geometry::tile_key(game_id, coord), entity_id, crate::taxonomy::DEEP_SITE_OCCUPIER, true,
        );
        let kind = crate::deep::kind_at(crate::deep::ring_draw(seed, game_id, band, 0), place);
        let opening = DeepSite { kind, ring: band, day: 0, aspect: 0 };
        reset_beast(ResourceKey { game_id, entity_id }, opening, start);
    }
}

fn site_structure(start: u64) -> crate::structures::StructureRecord {
    crate::structures::StructureRecord {
        owner: 0.try_into().unwrap(),
        base: crate::structures::StructureBase {
            troop_max_guard_count: crate::rules::DEEP_GUARD_SLOTS,
            troop_max_explorer_count: 0,
            created_at: start.try_into().unwrap(),
            category: crate::taxonomy::DEEP_SITE_CATEGORY,
            level: 0,
            starting_troops_granted: false,
        },
        resources_packed: 0,
        metadata: Default::default(),
    }
}

#[cfg(feature: "blitz")]
pub fn rollover(_game_id: u32, _context: ExecutionContext) -> bool {
    true
}

#[cfg(not(feature: "blitz"))]
pub fn rollover(game_id: u32, context: ExecutionContext) -> bool {
    let game = context.game.unbox();
    if context.timestamp < game.start_main_at || (game.end_at != 0 && context.timestamp >= game.end_at) {
        return true;
    }
    let day = crate::days::day_of(game, crate::clock::day_unit_seconds(game), context.timestamp);
    let draw = day_draw(game_id, day.index, context.raw_root);
    let mut spent = 0;
    for band in 0..rules().ring_count {
        let first = band * crate::rules::DEEP_RING_SITES;
        if site(ResourceKey { game_id, entity_id: site_id(game_id, first) }).unwrap().day == day.index {
            continue;
        }
        let cost = ring_guards(game_id, band) * crate::rules::DEEP_CATCH_UP_DEATH_TICKS + 1;
        if spent != 0 && spent + cost > crate::rules::DEEP_CATCH_UP_GUARD_TICKS {
            return false;
        }
        spent += cost;
        let ring_draw = crate::deep::ring_draw(draw, game_id, band, day.index);
        for place in 0..crate::rules::DEEP_RING_SITES {
            let key = ResourceKey { game_id, entity_id: site_id(game_id, first + place) };
            crate::logic::deep_garrisons::clear(key, 0.try_into().unwrap());
            let kind = crate::deep::kind_at(ring_draw, place);
            reset_beast(key, DeepSite { kind, ring: band, day: day.index, aspect: 0 }, day.start);
        }
    }
    true
}

fn day_draw(game_id: u32, day: u64, raw_root: u256) -> u256 {
    let state = crate::state::write();
    if let Some(draw) = state.deep.day_draws.read((game_id, day)) {
        return draw;
    }
    state.deep.day_draws.write((game_id, day), Some(raw_root));
    raw_root
}

fn ring_guards(game_id: u32, band: u8) -> u64 {
    let mut guards = 0;
    for place in 0..crate::rules::DEEP_RING_SITES {
        let entity_id = site_id(game_id, band * crate::rules::DEEP_RING_SITES + place);
        guards += crate::logic::deep_garrisons::count(ResourceKey { game_id, entity_id });
    }
    guards
}

pub fn hold(key: ResourceKey, aspect: u8) {
    write_site(key, DeepSite { aspect, ..site(key).expect('missing Deep site') });
}

fn reset_beast(key: ResourceKey, value: DeepSite, timestamp: u64) {
    write_site(key, value);
    let guard = beast(value.kind);
    crate::logic::guards::GuardState::save(
        GuardKey { game_id: key.game_id, structure_id: key.entity_id, slot: 0 },
        Guard {
            troops: crate::troops::Troops {
                category: if guard.bow {
                    crate::troops::TroopType::Crossbowman
                } else {
                    crate::troops::TroopType::Knight
                },
                count: guard.count,
                stamina: crate::troops::Stamina { amount: 0, settled_at: timestamp.try_into().unwrap(), remainder: 0 }
                    .into(),
                ..Default::default(),
            },
            destroyed_tick: 0,
        },
    );
}

fn write_site(key: ResourceKey, value: DeepSite) {
    crate::state::write().deep.sites.write((key.game_id, key.entity_id), Some(value));
    let mut keys = array![];
    key.serialize(ref keys);
    let mut values = array![];
    value.serialize(ref values);
    crate::logic::troops::TroopState::emit(
        crate::logic::troops::TroopState::Event::RowSet(
            crate::events::RowSet { version: 1, model: 'DeepSite', keys: keys.span(), values: values.span() },
        ),
    );
}

#[starknet::component]
pub mod DeepSites {
    #[storage]
    pub struct Storage {}
    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {}
    #[embeddable_as(DeepSitesImpl)]
    pub impl Sites<
        TContractState, +HasComponent<TContractState>, +Drop<TContractState>,
    > of crate::deep::IDeepSites<ComponentState<TContractState>> {
        fn initialize_deep(ref self: ComponentState<TContractState>, game_id: u32) {
            super::initialize(game_id);
        }
        fn rollover_deep(
            ref self: ComponentState<TContractState>, game_id: u32, context: crate::commands::ActionContext,
        ) -> bool {
            super::rollover(game_id, crate::commands::execution_context(game_id, context))
        }
    }
}
