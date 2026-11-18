use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess, StoragePathEntry, StoragePointerReadAccess};
use crate::commands::ExecutionContext;
use crate::deep::{DeepShare, DeepSite, IDeepBanesDispatcherTrait, IDeepRewardsDispatcherTrait};
use crate::race::IRaceDispatcherTrait;
use crate::resources::{IResourceOperationsDispatcherTrait, IResourceOperationsLibraryDispatcher, ResourceKey};
use crate::troops::{ExplorerKey, ExplorerTroops};

pub fn initialize(game_id: u32) {
    let state = crate::state::write();
    if state.deep.paid_tick.read(game_id).is_some() {
        return;
    }
    let tick = state.games.games.entry(game_id).start_main_at.read()
        / crate::logic::preset_record::for_game(game_id).rules.tick_config.armies_tick_in_seconds.read();
    save_cursor(game_id, tick);
}

pub fn settle(game_id: u32, context: ExecutionContext) {
    if crate::logic::deep_sites::rules_entry(game_id).is_none() {
        return;
    }
    let game = context.game.unbox();
    let race = race(game_id);
    let result = race.race_result(game_id);
    if context.timestamp < game.start_main_at {
        return;
    }
    let interval = context.rules.unbox().tick_config.armies_tick_in_seconds;
    let end = result.map(|value| value.ended_at).unwrap_or(game.end_at);
    let last = core::cmp::min(context.timestamp, end) / interval;
    let mut cursor = crate::state::read().deep.paid_tick.read(game_id).expect('missing Deep cursor');
    while cursor < last {
        if !has_guards(game_id) {
            cursor = last;
            break;
        }
        let boundary = (cursor + 1) * interval;
        settle_boundary(game_id, boundary, context);
        cursor += 1;
        if race.race_result(game_id).map(|value| boundary >= value.ended_at).unwrap_or(false) {
            break;
        }
    }
    if crate::state::read().deep.paid_tick.read(game_id) != Some(cursor) {
        save_cursor(game_id, cursor);
    }
    race.finish_expired_race(game_id, context.timestamp);
    if race.race_result(game_id).is_none() && context.timestamp < game.end_at {
        crate::logic::deep_sites::rollover(game_id, context);
    }
}

fn settle_boundary(game_id: u32, boundary: u64, context: ExecutionContext) {
    let historical = ExecutionContext { timestamp: boundary - 1, ..context };
    crate::logic::deep_sites::rollover(game_id, historical);
    for index in 0..crate::logic::deep_sites::site_count(game_id) {
        drain_site(game_id, crate::logic::deep_sites::site_id(game_id, index), boundary, historical);
    }
    for index in 0..crate::logic::deep_sites::site_count(game_id) {
        let site_id = crate::logic::deep_sites::site_id(game_id, index);
        let guards = guards(game_id, site_id);
        if !guards.is_empty() {
            let site = crate::logic::deep_sites::site(ResourceKey { game_id, entity_id: site_id })
                .expect('missing Deep site');
            pay_site(game_id, site, shares(guards), boundary, historical);
        }
    }
}

fn has_guards(game_id: u32) -> bool {
    let state = crate::state::read();
    for index in 0..crate::logic::deep_sites::site_count(game_id) {
        let site = state.deep.site_ids.read((game_id, index));
        for slot in 0..crate::rules::DEEP_GUARD_SLOTS {
            if state.deep.slots.read((game_id, site, slot)) != 0 {
                return true;
            }
        }
    }
    false
}

fn drain_site(game_id: u32, site: u64, boundary: u64, context: ExecutionContext) {
    let guards = guards(game_id, site);
    if guards.is_empty() {
        return;
    }
    let context = ExecutionContext { timestamp: boundary, ..context };
    for (key, army) in guards {
        let army = crate::logic::army_slots::resolve(*key, *army, None);
        crate::logic::deep_armies::settle(*key, army, context);
    }
}

fn guards(game_id: u32, site: u64) -> Span<(ExplorerKey, ExplorerTroops)> {
    let state = crate::state::read();
    let mut result = array![];
    for slot in 0..crate::rules::DEEP_GUARD_SLOTS {
        let explorer_id = state.deep.slots.read((game_id, site, slot));
        if explorer_id == 0 {
            continue;
        }
        let key = ExplorerKey { game_id, explorer_id };
        let army = crate::logic::troops::explorer(key).expect('missing Deep guard');
        assert!(army.troops.count != 0, "dead guard occupies Deep slot");
        result.append((key, army));
    }
    result.span()
}

fn shares(guards: Span<(ExplorerKey, ExplorerTroops)>) -> Span<DeepShare> {
    let mut shares = array![];
    for (_, army) in guards {
        shares.append(DeepShare { home: *army.owner, troops: *army.troops.count });
    }
    shares.span()
}

fn pay_site(game_id: u32, site: DeepSite, shares: Span<DeepShare>, boundary: u64, context: ExecutionContext) {
    let kind = site.kind;
    if kind == crate::rules::DEEP_CORE || kind == crate::rules::DEEP_MINE {
        pay_resource(game_id, kind, shares, boundary, context);
        return;
    }
    let aspect = crate::logic::aspects::home_aspect(ResourceKey { game_id, entity_id: *shares.at(0).home });
    let amount = crate::deep::building_pay(
        crate::logic::deep_sites::rules_entry(game_id).expect('missing Deep rules').building_pay.read(),
        crate::logic::deep_sites::open_rings(game_id, site.day),
    );
    let state = crate::state::read();
    let release = state.releases.entry(state.game_releases.read(game_id)).classes;
    if race(game_id).race_rules(game_id).is_some() {
        crate::deep::IDeepRewardsLibraryDispatcher { class_hash: release.economy.read() }
            .pay_deep_tick(game_id, kind, aspect, shares, amount, boundary);
    }
    if kind == crate::rules::DEEP_ALTAR {
        crate::deep::IDeepBanesLibraryDispatcher { class_hash: release.bridge.read() }
            .credit_altar(game_id, aspect, amount, boundary);
    }
}

fn pay_resource(game_id: u32, kind: u8, shares: Span<DeepShare>, boundary: u64, context: ExecutionContext) {
    let rules = crate::logic::deep_sites::rules_entry(game_id).expect('missing Deep rules');
    let (resource, amount) = if kind == crate::rules::DEEP_CORE {
        (crate::resources::ESSENCE, rules.core_per_tick.read())
    } else {
        (crate::resources::LABOR, rules.mine_per_tick.read())
    };
    let payments = crate::race::split_payment(amount, shares);
    let state = crate::state::read();
    let release = state.releases.entry(state.game_releases.read(game_id)).classes;
    let resources = IResourceOperationsLibraryDispatcher { class_hash: release.resources.read() };
    for index in 0..shares.len() {
        let home = ResourceKey { game_id, entity_id: *shares.at(index).home };
        resources
            .grant_resource(home, resource, *payments.at(index), boundary, crate::commands::resource_context(context));
    }
}

fn save_cursor(game_id: u32, tick: u64) {
    crate::state::write().deep.paid_tick.write(game_id, Some(tick));
    crate::logic::map::MapState::emit(
        crate::logic::map::MapState::Event::RowSet(
            crate::events::RowSet {
                version: 1, model: 'DeepTick', keys: array![game_id.into()].span(), values: array![tick.into()].span(),
            },
        ),
    );
}

fn race(game_id: u32) -> crate::race::IRaceLibraryDispatcher {
    let state = crate::state::read();
    let release = state.game_releases.read(game_id);
    assert!(release != 0, "game has no release");
    crate::race::IRaceLibraryDispatcher { class_hash: state.releases.entry(release).classes.economy.read() }
}
