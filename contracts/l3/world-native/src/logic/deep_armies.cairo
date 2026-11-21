use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess};
use crate::commands::ExecutionContext;
use crate::troops::{ExplorerKey, ExplorerTroops, IBattleResolutionDispatcherTrait};

#[cfg(feature: "blitz")]
pub fn enter(_key: ExplorerKey, _home: u64, _context: ExecutionContext) {}

#[cfg(not(feature: "blitz"))]
pub fn enter(key: ExplorerKey, home: u64, context: ExecutionContext) {
    let state = crate::state::read();
    assert!(state.deep.army_ticks.read((key.game_id, key.explorer_id)).is_none(), "army already entered Deep");
    write_tick(key, context.timestamp / context.rules.unbox().tick_config.armies_tick_in_seconds);
    crate::logic::deep_sites::count_entry(key.game_id, home, context);
}

#[cfg(feature: "blitz")]
pub fn settle(_key: ExplorerKey, army: ExplorerTroops, _context: ExecutionContext) -> ExplorerTroops {
    army
}

#[cfg(not(feature: "blitz"))]
pub fn settle(key: ExplorerKey, mut army: ExplorerTroops, context: ExecutionContext) -> ExplorerTroops {
    let rules = crate::logic::deep_sites::rules();
    let Some(last_tick) = crate::state::read().deep.army_ticks.read((key.game_id, key.explorer_id)) else {
        assert!(!crate::logic::deep::contains(key.game_id, army.coord), "Deep army has no tick");
        return army;
    };
    let day = crate::days::day_at_index(
        context.game.unbox(), crate::balance::rules::SWITCHES.day_unit_seconds, crate::logic::army_days::require(key),
    );
    let tick = core::cmp::min(context.timestamp, day.end) / context.rules.unbox().tick_config.armies_tick_in_seconds;
    if crate::logic::deep_guards::entry(key).is_some() {
        crate::logic::deep_ticks::assert_paid_to(key.game_id, tick);
    }
    if tick <= last_tick {
        return army;
    }
    let before = army.troops.count;
    let loss = crate::oaths::deep_loss_per_tick(crate::logic::progression::require(key).oaths, rules.loss_per_tick);
    army.troops.count = crate::deep::troops_after_ticks(before, last_tick, tick, loss);
    drained(key, army, before, tick, context)
}

pub fn drained(
    key: ExplorerKey, army: ExplorerTroops, before: u128, tick: u64, context: ExecutionContext,
) -> ExplorerTroops {
    if army.troops.count != 0 {
        write_tick(key, tick);
    }
    crate::logic::combat::combat_troops(key.game_id)
        .finish_battle(key, army, before, crate::commands::action_context(context));
    army
}

fn write_tick(key: ExplorerKey, tick: u64) {
    crate::state::write().deep.army_ticks.write((key.game_id, key.explorer_id), Some(tick));
    let mut keys = array![];
    key.serialize(ref keys);
    crate::logic::troops::TroopState::emit(
        crate::logic::troops::TroopState::Event::RowSet(
            crate::events::RowSet {
                version: 1, model: 'DeepArmy', keys: keys.span(), values: array![tick.into()].span(),
            },
        ),
    );
}

pub fn remove(key: ExplorerKey) {
    let state = crate::state::write();
    if state.deep.army_ticks.read((key.game_id, key.explorer_id)).is_none() {
        return;
    }
    state.deep.army_ticks.write((key.game_id, key.explorer_id), None);
    let mut keys = array![];
    key.serialize(ref keys);
    crate::logic::troops::TroopState::emit(
        crate::logic::troops::TroopState::Event::RowDeleted(
            crate::events::RowDeleted { version: 1, model: 'DeepArmy', keys: keys.span() },
        ),
    );
}
