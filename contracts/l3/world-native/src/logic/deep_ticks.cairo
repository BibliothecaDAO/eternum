use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess, StoragePathEntry, StoragePointerReadAccess};
use crate::commands::ExecutionContext;
use crate::deep::{DeepShare, IDeepBanesDispatcherTrait, IDeepRewardsDispatcherTrait};
use crate::resources::{IResourceOperationsDispatcherTrait, IResourceOperationsLibraryDispatcher, ResourceKey};
use crate::troops::{ExplorerKey, ExplorerTroops, IBattleResolutionDispatcherTrait};

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
    if context.timestamp < game.start_main_at {
        return;
    }
    let interval = context.rules.unbox().tick_config.armies_tick_in_seconds;
    let last = core::cmp::min(context.timestamp, game.end_at) / interval;
    let mut cursor = crate::state::read().deep.paid_tick.read(game_id).expect('missing Deep cursor');
    while cursor < last {
        if !has_guards(game_id) {
            cursor = last;
            break;
        }
        let boundary = (cursor + 1) * interval;
        let historical = ExecutionContext {
            timestamp: boundary - 1, game: BoxTrait::new(crate::logic::deep::calendar_game(game_id, game)), ..context,
        };
        crate::logic::deep_sites::rollover(game_id, historical);
        for kind in 0..crate::rules::DEEP_SITE_COUNT {
            settle_site(game_id, kind, boundary, historical);
        }
        cursor += 1;
        if boundary >= crate::state::read().games.games.entry(game_id).end_at.read() {
            break;
        }
    }
    if crate::state::read().deep.paid_tick.read(game_id) != Some(cursor) {
        save_cursor(game_id, cursor);
    }
    if context.timestamp < crate::state::read().games.games.entry(game_id).end_at.read() {
        crate::logic::deep_sites::rollover(game_id, context);
    }
}

fn has_guards(game_id: u32) -> bool {
    let state = crate::state::read();
    for kind in 0..crate::rules::DEEP_SITE_COUNT {
        let site = state.deep.site_ids.read((game_id, kind));
        for slot in 0..crate::rules::DEEP_GUARD_SLOTS {
            if state.deep.slots.read((game_id, site, slot)) != 0 {
                return true;
            }
        }
    }
    false
}

fn settle_site(game_id: u32, kind: u8, boundary: u64, context: ExecutionContext) {
    let guards = guards(game_id, kind);
    if guards.is_empty() {
        return;
    }
    let shares = shares(guards);
    pay_site(game_id, kind, shares, boundary, context);
    let context = ExecutionContext { timestamp: boundary, ..context };
    for (key, army) in guards {
        crate::logic::combat::combat_troops(game_id)
            .settle_deep_army(*key, *army, crate::commands::action_context(context));
    }
}

fn guards(game_id: u32, kind: u8) -> Span<(ExplorerKey, ExplorerTroops)> {
    let state = crate::state::read();
    let site = state.deep.site_ids.read((game_id, kind));
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

fn pay_site(game_id: u32, kind: u8, shares: Span<DeepShare>, boundary: u64, context: ExecutionContext) {
    if kind == crate::rules::DEEP_QUARRY {
        pay_quarry(game_id, shares, boundary, context);
        return;
    }
    let aspect = crate::logic::aspects::home_aspect(ResourceKey { game_id, entity_id: *shares.at(0).home });
    let state = crate::state::read();
    let release = state.releases.entry(state.game_releases.read(game_id)).classes;
    crate::deep::IDeepRewardsLibraryDispatcher { class_hash: release.economy.read() }
        .pay_deep_tick(game_id, kind, aspect, shares, boundary);
    if kind == crate::rules::DEEP_ALTAR {
        crate::deep::IDeepBanesLibraryDispatcher { class_hash: release.bridge.read() }
            .credit_altar(game_id, aspect, boundary);
    }
}

fn pay_quarry(game_id: u32, shares: Span<DeepShare>, boundary: u64, context: ExecutionContext) {
    let amount = crate::logic::deep_sites::rules_entry(game_id).expect('missing Deep rules').quarry_per_tick.read();
    let payments = crate::race::split_payment(amount, shares);
    let state = crate::state::read();
    let release = state.releases.entry(state.game_releases.read(game_id)).classes;
    let resources = IResourceOperationsLibraryDispatcher { class_hash: release.resources.read() };
    for index in 0..shares.len() {
        let home = ResourceKey { game_id, entity_id: *shares.at(index).home };
        for resource in array![crate::resources::LABOR, crate::resources::ESSENCE] {
            resources
                .grant_resource(
                    home, resource, *payments.at(index), boundary, crate::commands::resource_context(context),
                );
        }
    }
}

fn save_cursor(game_id: u32, tick: u64) {
    crate::state::write().deep.paid_tick.write(game_id, Some(tick));
}
