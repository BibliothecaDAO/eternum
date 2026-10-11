// Count the current seeded game day as unlocked in full, as ruled for both shard and ledger.
use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess};
use crate::commands::ExecutionContext;
use crate::relics::{ChestRules, ChestTiers, LordsBudget, SiteChest, roll_tier, tier_value};
use crate::resources::ResourceKey;

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
    crate::state::read().relics.rollover_budget.read(game_id)
}

/// Draw the candidate chest at the preset price before the site lottery.
pub fn candidate(game_id: u32, odds: ChestTiers, seed: u256, context: ExecutionContext) -> SiteChest {
    let rules = chest_rules(game_id);
    let today = today(game_id, rules, context);
    let tier = roll_tier(odds, seed);
    SiteChest {
        tier, amount: Into::<u16, u128>::into(tier_value(rules.shares, tier)) * rules.price, reservation_day: today.day,
    }
}

/// Reserve only LORDS already unlocked and not paid or held open.
pub fn try_reserve(game_id: u32, chest: SiteChest, context: ExecutionContext) -> bool {
    let rules = chest_rules(game_id);
    let mut today = today(game_id, rules, context);
    assert!(chest.reservation_day == today.day, "chest reservation day mismatch");
    let accepted = fits(rules, today, season_clock(context), chest.amount);
    if accepted {
        today.open += chest.amount;
    }
    write(game_id, today);
    accepted
}

/// Pays a cleared ruin's stored chest out of the pool, as the LORDS its realm receives. Chests never pay more than
/// the pool holds.
pub fn pay(ruin: ResourceKey, context: ExecutionContext) -> crate::resources::ResourceAmount {
    let chest = site_chest(ruin).expect('missing ruin chest');
    let rules = chest_rules(ruin.game_id);
    let mut today = today(ruin.game_id, rules, context);
    // Yesterday's hold was released at rollover. Clearing that site must not consume another player's hold.
    if chest.reservation_day != today.day {
        return crate::resources::ResourceAmount { resource_type: crate::resources::LORDS, amount: 0 };
    }
    assert!(chest.amount <= today.open, "ruin chest is not reserved");
    assert!(
        issued(rules, today) + chest.amount <= unlocked(rules, season_clock(context), today.day),
        "ruin chest exceeds the unlock",
    );
    today.pool_left -= chest.amount;
    today.open -= chest.amount;
    write(ruin.game_id, today);
    crate::resources::ResourceAmount {
        resource_type: crate::resources::LORDS, amount: chest.amount * crate::rules::RESOURCE_PRECISION,
    }
}

/// A refill returns held LORDS to the same unlocked pool; it creates no new unlock.
pub fn return_to_pool(game_id: u32, amount: u128, context: ExecutionContext) {
    let rules = chest_rules(game_id);
    let mut today = today(game_id, rules, context);
    assert!(amount <= issued(rules, today), "refill exceeds issued LORDS");
    today.pool_left += amount;
    write(game_id, today);
}

pub fn fits(rules: ChestRules, today: LordsBudget, clock: SeasonClock, amount: u128) -> bool {
    amount != 0 && amount <= available(rules, today, clock)
}

pub fn available(rules: ChestRules, today: LordsBudget, clock: SeasonClock) -> u128 {
    let unlocked = unlocked(rules, clock, today.day);
    let committed = Into::<u128, u256>::into(issued(rules, today)) + today.open.into();
    if committed >= unlocked.into() {
        0
    } else {
        (Into::<u128, u256>::into(unlocked) - committed).try_into().unwrap()
    }
}

fn issued(rules: ChestRules, today: LordsBudget) -> u128 {
    assert!(today.pool_left <= rules.pool, "LORDS pool exceeds its funding");
    rules.pool - today.pool_left
}

/// The current day counts as unlocked from its start; the last partial day stops exactly at the season end.
pub fn unlocked(rules: ChestRules, clock: SeasonClock, day: u64) -> u128 {
    let end = core::cmp::min(budget_day(clock, day).end, clock.game.end_at);
    let duration = clock.game.end_at - clock.game.start_main_at;
    assert!(duration != 0, "empty LORDS season");
    (Into::<u128, u256>::into(rules.pool) * (end - clock.game.start_main_at).into() / duration.into())
        .try_into()
        .unwrap()
}

fn season_clock(context: ExecutionContext) -> SeasonClock {
    let rules = context.rules.unbox();
    SeasonClock {
        game: context.game.unbox(),
        day_unit_seconds: rules.day_unit_seconds,
    }
}

pub fn chest_rules(game_id: u32) -> ChestRules {
    crate::logic::preset_record::for_game(game_id).rollover_chest_rules.read().expect('missing chest rules')
}

// The first touch of a day releases expired holds; paid LORDS stay deducted.
fn today(game_id: u32, rules: ChestRules, context: ExecutionContext) -> LordsBudget {
    let game = context.game.unbox();
    let clock = season_clock(context);
    let day = crate::days::day_of(game, clock.day_unit_seconds, context.timestamp).index;
    match budget(game_id) {
        Some(previous) => if previous.day == day {
            previous
        } else {
            roll(previous, day)
        },
        None => LordsBudget { pool_left: rules.pool, open: 0, day },
    }
}

#[derive(Copy, Drop)]
pub struct SeasonClock {
    pub game: crate::game::GameRegistry,
    pub day_unit_seconds: u32,
}

// Jump to the requested bag, then walk at most four day boundaries using the shared seeded schedule.
fn budget_day(clock: SeasonClock, index: u64) -> crate::days::Day {
    let bag = index / crate::days::DAYS_PER_BAG;
    let start = clock.game.start_main_at + bag * crate::days::UNITS_PER_BAG * clock.day_unit_seconds.into();
    let mut day = crate::days::day_of(clock.game, clock.day_unit_seconds, start);
    while day.index < index {
        day = crate::days::day_of(clock.game, clock.day_unit_seconds, day.end);
    }
    day
}

/// Release expired reservations without spending their LORDS.
pub fn roll(previous: LordsBudget, day: u64) -> LordsBudget {
    assert!(day > previous.day, "LORDS budget runs backwards");
    LordsBudget { open: 0, day, ..previous }
}

fn write(game_id: u32, value: LordsBudget) {
    crate::state::write().relics.rollover_budget.write(game_id, Some(value));
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
