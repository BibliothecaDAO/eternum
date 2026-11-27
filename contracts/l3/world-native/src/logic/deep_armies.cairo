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

pub use settlement::{is_dead, settle};

#[cfg(feature: "blitz")]
mod settlement {
    use crate::commands::ExecutionContext;
    use crate::troops::{ExplorerKey, ExplorerTroops};

    pub fn settle(_key: ExplorerKey, army: ExplorerTroops, _context: ExecutionContext) -> ExplorerTroops {
        army
    }

    pub fn is_dead(_key: ExplorerKey, _army: ExplorerTroops, _context: ExecutionContext) -> bool {
        false
    }
}

#[cfg(not(feature: "blitz"))]
mod settlement {
    use starknet::storage::StorageMapReadAccess;
    use crate::commands::ExecutionContext;
    use crate::troops::{ExplorerKey, ExplorerTroops};
    use super::drained;

    pub fn settle(key: ExplorerKey, mut army: ExplorerTroops, context: ExecutionContext) -> ExplorerTroops {
        let Some((after, tick)) = projected_count(key, army, context) else {
            return army;
        };
        let before = army.troops.count;
        army.troops.count = after;
        drained(key, army, before, tick, context)
    }

    pub fn is_dead(key: ExplorerKey, army: ExplorerTroops, context: ExecutionContext) -> bool {
        match projected_count(key, army, context) {
            Some((after, _)) => after == 0,
            None => false,
        }
    }

    fn projected_count(key: ExplorerKey, army: ExplorerTroops, context: ExecutionContext) -> Option<(u128, u64)> {
        let Some(last_tick) = crate::state::read().deep.army_ticks.read((key.game_id, key.explorer_id)) else {
            assert!(!crate::logic::deep::contains(key.game_id, army.coord), "Deep army has no tick");
            return None;
        };
        let rules = crate::logic::deep_sites::rules();
        let day = crate::days::day_at_index(
            context.game.unbox(),
            crate::clock::day_unit_seconds(context.game.unbox()),
            crate::logic::army_days::require(key),
        );
        let tick = core::cmp::min(context.timestamp, day.end)
            / context.rules.unbox().tick_config.armies_tick_in_seconds;
        if tick <= last_tick {
            return None;
        }
        let loss = crate::oaths::deep_loss_per_tick(crate::logic::progression::require(key).oaths, rules.loss_per_tick);
        Some((crate::deep::troops_after_ticks(army.troops.count, last_tick, tick, loss), tick))
    }
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
