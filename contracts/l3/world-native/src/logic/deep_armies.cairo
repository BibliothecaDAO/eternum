use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess};
use crate::commands::ExecutionContext;
use crate::troops::{ExplorerKey, ExplorerTroops, IBattleResolutionDispatcherTrait};

pub fn enter(key: ExplorerKey, context: ExecutionContext) {
    if crate::logic::deep_sites::rules_entry(key.game_id).is_none() {
        return;
    }
    let state = crate::state::read();
    assert!(state.deep.army_ticks.read((key.game_id, key.explorer_id)).is_none(), "army already entered Deep");
    write_tick(key, context.timestamp / context.rules.unbox().tick_config.armies_tick_in_seconds);
}

pub fn settle(key: ExplorerKey, mut army: ExplorerTroops, context: ExecutionContext) -> ExplorerTroops {
    let Some(rules) = crate::logic::deep_sites::rules_entry(key.game_id) else {
        return army;
    };
    let Some(last_tick) = crate::state::read().deep.army_ticks.read((key.game_id, key.explorer_id)) else {
        assert!(!crate::logic::deep::contains(key.game_id, army.coord), "Deep army has no tick");
        return army;
    };
    let day = crate::days::day_at_index(
        crate::logic::deep::calendar_game(key.game_id, context.game.unbox()),
        context.rules.unbox().day_unit_seconds,
        crate::logic::army_days::require(key),
    );
    let tick = core::cmp::min(context.timestamp, day.end) / context.rules.unbox().tick_config.armies_tick_in_seconds;
    if tick <= last_tick {
        return army;
    }
    let before = army.troops.count;
    army.troops.count = crate::deep::troops_after_ticks(before, last_tick, tick, rules.loss_per_tick.read());
    write_tick(key, tick);
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
