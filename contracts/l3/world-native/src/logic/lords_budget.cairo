// The season's LORDS pool and the day price every ruin's chest is fixed at. Each day takes the pool left over the time
// left; the price is that allowance over the shares the day is expected to pay, capped at the ceiling per share. A
// ruin is found only if its chest fits the pool left after every open chest and the day's surge ceiling, and the chest
// is stored with the ruin then, so the card and the clear read one fact. LORDS spent on a refill return to the pool.
use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess};
use crate::commands::ExecutionContext;
use crate::relics::{ChestRules, ChestTiers, LORDS_ESTIMATE_SCALE, LordsBudget, SiteChest, roll_tier, tier_value};
use crate::resources::ResourceKey;

// Skipped days decay the estimate one step each, up to this many; past it the estimate is long since zero.
const MAX_DECAY_DAYS: u64 = 64;

pub fn site_chest(key: ResourceKey) -> Option<SiteChest> {
    crate::state::read().structures.site_chests.read((key.game_id, key.entity_id))
}

pub fn store_site_chest(key: ResourceKey, chest: SiteChest) {
    assert!(site_chest(key).is_none(), "ruin chest already stored");
    crate::state::write().structures.site_chests.write((key.game_id, key.entity_id), Some(chest));
    let mut keys = array![];
    key.serialize(ref keys);
    let mut values = array![];
    chest.serialize(ref values);
    emit_row('SiteChest', keys, values);
}

pub fn budget(game_id: u32) -> Option<LordsBudget> {
    crate::state::read().relics.lords_budget.read(game_id)
}

/// The chest a ruin found now would hold, if the day is free of one and the budget can pay it. Nothing is written.
pub fn offer(game_id: u32, odds: ChestTiers, seed: u256, context: ExecutionContext) -> Option<SiteChest> {
    let rules = chest_rules(game_id);
    let today = today(game_id, rules, context);
    let tier = roll_tier(odds, seed, context.timestamp);
    let amount = Into::<u16, u128>::into(tier_value(rules.shares, tier)) * today.price;
    if fits(today, amount) {
        Some(SiteChest { tier, amount })
    } else {
        None
    }
}

/// Holds a found ruin's chest against the pool and the day's surge ceiling.
pub fn reserve(game_id: u32, chest: SiteChest, context: ExecutionContext) {
    let mut today = today(game_id, chest_rules(game_id), context);
    assert!(fits(today, chest.amount), "ruin chest exceeds the LORDS budget");
    today.open += chest.amount;
    today.spent += chest.amount;
    write(game_id, today);
}

/// Pays a cleared ruin's stored chest out of the pool, as the LORDS its realm receives. Chests never pay more than
/// the pool holds.
pub fn pay(ruin: ResourceKey, context: ExecutionContext) -> crate::resources::ResourceAmount {
    let chest = site_chest(ruin).expect('missing ruin chest');
    let rules = chest_rules(ruin.game_id);
    let mut today = today(ruin.game_id, rules, context);
    assert!(chest.amount <= today.pool_left, "LORDS pool exhausted");
    today.pool_left -= chest.amount;
    today.open -= core::cmp::min(today.open, chest.amount);
    today.paid_shares += tier_value(rules.shares, chest.tier).into();
    write(ruin.game_id, today);
    crate::resources::ResourceAmount {
        resource_type: crate::resources::LORDS, amount: chest.amount * crate::rules::RESOURCE_PRECISION,
    }
}

/// LORDS a player spends in the game go back to the pool and the later days' allowances.
pub fn return_to_pool(game_id: u32, amount: u128, context: ExecutionContext) {
    let mut today = today(game_id, chest_rules(game_id), context);
    today.pool_left += amount;
    write(game_id, today);
}

pub fn fits(today: LordsBudget, amount: u128) -> bool {
    amount <= today.pool_left - today.open && today.spent + amount <= today.ceiling
}

fn chest_rules(game_id: u32) -> ChestRules {
    crate::logic::preset_record::for_game(game_id).chest_rules.read().expect('missing chest rules')
}

// The budget as it stands for the day of `context`: the first touch of a day folds the days before into the estimate
// and prices the new day.
fn today(game_id: u32, rules: ChestRules, context: ExecutionContext) -> LordsBudget {
    let game = context.game.unbox();
    let game_rules = context.rules.unbox();
    let clock = SeasonClock {
        game, day_unit_seconds: game_rules.day_unit_seconds, tick: game_rules.tick_config.armies_tick_in_seconds,
    };
    let day = crate::days::day_of(game, clock.day_unit_seconds, context.timestamp).index;
    match budget(game_id) {
        Some(previous) => if previous.day == day {
            previous
        } else {
            roll(rules, previous, clock, day)
        },
        None => open_day(
            rules,
            LordsBudget {
                pool_left: rules.pool,
                open: 0,
                spent: 0,
                day,
                price: 0,
                ceiling: 0,
                estimate: 0,
                paid_shares: 0,
            },
            clock,
        ),
    }
}

#[derive(Copy, Drop)]
pub struct SeasonClock {
    pub game: crate::game::GameRegistry,
    pub day_unit_seconds: u32,
    pub tick: u64,
}

// Jump to the requested bag, then walk at most four day boundaries using the shared seeded schedule.
fn priced_day(clock: SeasonClock, index: u64) -> crate::days::Day {
    let bag = index / crate::days::DAYS_PER_BAG;
    let start = clock.game.start_main_at + bag * crate::days::UNITS_PER_BAG * clock.day_unit_seconds.into();
    let mut day = crate::days::day_of(clock.game, clock.day_unit_seconds, start);
    while day.index < index {
        day = crate::days::day_of(clock.game, clock.day_unit_seconds, day.end);
    }
    day
}

fn day_ticks(clock: SeasonClock, index: u64) -> u128 {
    let day = priced_day(clock, index);
    let end = core::cmp::min(day.end, clock.game.end_at);
    if end <= day.start {
        0
    } else {
        ((end - day.start) / clock.tick).into()
    }
}

/// Closes the budget's day into the moving estimate and opens `day`. Chests of a day that ended unopened never pay,
/// so their LORDS stay in the pool.
pub fn roll(rules: ChestRules, previous: LordsBudget, clock: SeasonClock, day: u64) -> LordsBudget {
    assert!(day > previous.day, "LORDS budget runs backwards");
    let window: u128 = rules.estimate_days.into();
    let ticks = core::cmp::max(day_ticks(clock, previous.day), 1);
    let sample = previous.paid_shares * LORDS_ESTIMATE_SCALE / ticks;
    let mut estimate = (previous.estimate * (window - 1) + sample) / window;
    let mut skipped = core::cmp::min(day - previous.day - 1, MAX_DECAY_DAYS);
    while skipped != 0 {
        estimate = estimate * (window - 1) / window;
        skipped -= 1;
    }
    open_day(
        rules,
        LordsBudget { open: 0, spent: 0, day, estimate, paid_shares: 0, price: 0, ceiling: 0, ..previous },
        clock,
    )
}

// allowance = pool left x the day's ticks / the ticks left in the season; price = min(ceiling per share, allowance /
// expected shares), at least 1; surge ceiling = price x max(surge factor x expected shares, minimum shares).
pub fn open_day(rules: ChestRules, mut budget: LordsBudget, clock: SeasonClock) -> LordsBudget {
    let ticks = day_ticks(clock, budget.day);
    let start = priced_day(clock, budget.day).start;
    let ticks_left: u128 = if clock.game.end_at > start {
        ((clock.game.end_at - start) / clock.tick).into()
    } else {
        0
    };
    let allowance = if ticks_left == 0 {
        budget.pool_left
    } else {
        budget.pool_left * ticks / ticks_left
    };
    let expected = budget.estimate * ticks;
    let price = if expected == 0 {
        rules.price_ceiling
    } else {
        core::cmp::min(rules.price_ceiling, allowance * LORDS_ESTIMATE_SCALE / expected)
    };
    budget.price = core::cmp::max(price, 1);
    let surge_shares = core::cmp::max(
        Into::<u16, u128>::into(rules.surge_factor) * expected / LORDS_ESTIMATE_SCALE,
        rules.surge_minimum_shares.into(),
    );
    budget.ceiling = budget.price * surge_shares;
    budget
}

fn write(game_id: u32, value: LordsBudget) {
    crate::state::write().relics.lords_budget.write(game_id, Some(value));
    let mut values = array![];
    value.serialize(ref values);
    emit_row('LordsBudget', array![game_id.into()], values);
}

fn emit_row(model: felt252, keys: Array<felt252>, values: Array<felt252>) {
    crate::logic::map::MapState::emit(
        crate::logic::map::MapState::Event::RowSet(
            crate::events::RowSet { version: 1, model, keys: keys.span(), values: values.span() },
        ),
    );
}
