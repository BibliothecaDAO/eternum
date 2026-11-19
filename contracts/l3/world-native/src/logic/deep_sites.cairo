use starknet::storage::{
    StorageMapReadAccess, StorageMapWriteAccess, StoragePathEntry, StoragePointer, StoragePointerReadAccess,
    SubPointersForward,
};
use crate::commands::ExecutionContext;
use crate::deep::{DeepBeast, DeepRing, DeepSettings, DeepSite};
use crate::guards::{Guard, GuardKey};
use crate::resources::ResourceKey;
use crate::troops::ExplorerKey;

pub fn rules_entry(game_id: u32) -> Option<StoragePointer<DeepSettings>> {
    crate::logic::preset_record::for_game(game_id).deep_rules.sub_pointers()
}

pub fn ring(game_id: u32, ring: u8) -> DeepRing {
    let (radius, realms) = crate::logic::preset_record::for_game(game_id).deep_rings.read(ring);
    DeepRing { radius, realms }
}

pub fn beast(game_id: u32, kind: u8) -> DeepBeast {
    let (count, bow) = crate::logic::preset_record::for_game(game_id).deep_beasts.read(kind);
    DeepBeast { count, bow }
}

pub fn site_count(game_id: u32) -> u8 {
    rules_entry(game_id).expect('missing Deep rules').ring_count.read() * crate::rules::DEEP_KIND_COUNT
}

pub fn site_id(game_id: u32, index: u8) -> u64 {
    crate::state::read().deep.site_ids.read((game_id, index))
}

pub fn site(key: ResourceKey) -> Option<DeepSite> {
    crate::state::read().deep.sites.read((key.game_id, key.entity_id))
}

pub fn is_open(game_id: u32, site: DeepSite) -> bool {
    crate::state::read().deep.realms_entered.read((game_id, site.day)) >= ring(game_id, site.ring).realms
}

pub fn open_rings(game_id: u32, day: u64) -> u8 {
    let entered = crate::state::read().deep.realms_entered.read((game_id, day));
    let count = rules_entry(game_id).expect('missing Deep rules').ring_count.read();
    let mut open = 0;
    while open < count && entered >= ring(game_id, open).realms {
        open += 1;
    }
    open
}

pub fn assert_open(game_id: u32, site: DeepSite) {
    assert!(is_open(game_id, site), "Deep ring closed");
}

pub fn count_entry(game_id: u32, home: u64, context: ExecutionContext) {
    let day = crate::days::day_of(context.game.unbox(), context.rules.unbox().day_unit_seconds, context.timestamp)
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
    crate::deep::IDeepSitesLibraryDispatcher { class_hash: state.releases.entry(release).classes.map.read() }
}

pub fn reward_beast_clear(key: ExplorerKey, home: u64, cleared: ResourceKey, timestamp: u64) {
    let kind = site(cleared).expect('missing Deep site').kind;
    crate::logic::quest_progress::guarded_site_cleared(
        ResourceKey { game_id: key.game_id, entity_id: home }, beast(key.game_id, kind).count, timestamp,
    );
}

fn initialize(game_id: u32) {
    if rules_entry(game_id).is_none() {
        return;
    }
    let state = crate::state::write();
    crate::logic::deep_ticks::initialize(game_id);
    let start = state.games.games.entry(game_id).start_main_at.read();
    let spacing = crate::logic::preset_record::for_game(game_id).settlement_spacing.read();
    for index in 0..site_count(game_id) {
        if state.deep.site_ids.read((game_id, index)) != 0 {
            continue;
        }
        let band = index / crate::rules::DEEP_KIND_COUNT;
        let place = index % crate::rules::DEEP_KIND_COUNT;
        let entity_id: u64 = crate::logic::game::allocate_setup_entity(game_id).into();
        state.deep.site_ids.write((game_id, index), entity_id);
        let coord = crate::deep::place(band, ring(game_id, band).radius, place, spacing);
        crate::logic::map::MapState::occupy(
            crate::geometry::tile_key(game_id, coord), entity_id, crate::taxonomy::DEEP_SITE_OCCUPIER, false,
        );
        let opening = DeepSite { kind: crate::deep::kind_on(band, place, 0), ring: band, day: 0 };
        reset_beast(ResourceKey { game_id, entity_id }, opening, start);
    }
}

pub fn rollover(game_id: u32, context: ExecutionContext) {
    if rules_entry(game_id).is_none() {
        return;
    }
    let game = context.game.unbox();
    if context.timestamp < game.start_main_at || (game.end_at != 0 && context.timestamp >= game.end_at) {
        return;
    }
    let day = crate::days::day_of(game, context.rules.unbox().day_unit_seconds, context.timestamp);
    for index in 0..site_count(game_id) {
        let key = ResourceKey { game_id, entity_id: site_id(game_id, index) };
        let previous = site(key).expect('missing initialized Deep site');
        if previous.day != day.index {
            crate::logic::deep_guards::expire(key, context);
            let place = index % crate::rules::DEEP_KIND_COUNT;
            let kind = crate::deep::kind_on(previous.ring, place, day.index);
            reset_beast(key, DeepSite { kind, ring: previous.ring, day: day.index }, day.start);
        }
    }
}

fn reset_beast(key: ResourceKey, value: DeepSite, timestamp: u64) {
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
    let guard = beast(key.game_id, value.kind);
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
        fn join_deep_site(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            actor: starknet::ContractAddress,
            command: crate::relics::InteractSite,
            context: crate::commands::ActionContext,
        ) {
            let context = crate::commands::execution_context(game_id, context);
            crate::logic::combat::authorize(game_id, context);
            crate::logic::deep_ticks::assert_caught_up(game_id, context);
            let key = crate::troops::ExplorerKey { game_id, explorer_id: command.explorer_id };
            let explorer = crate::logic::troops::field_explorer(key, actor, context.timestamp, context);
            let occupied = crate::logic::map::occupancy(crate::geometry::tile_key(game_id, command.coord))
                .expect('missing Deep site tile');
            crate::logic::deep_guards::join(
                key, explorer, crate::resources::ResourceKey { game_id, entity_id: occupied.entity_id },
            );
        }
        fn initialize_deep(ref self: ComponentState<TContractState>, game_id: u32) {
            super::initialize(game_id);
        }
    }
}
