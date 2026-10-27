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

/// The ledger operator publishes confirmed custody once; zero budgets before funding are not publications.
pub fn publish_pool(game_id: u32, amount: u128) {
    let game = crate::logic::game::game(game_id);
    let rules = crate::logic::game::rules(game_id);
    assert!(
        rules.day_unit_seconds != 0
            && crate::logic::preset_record::for_game(game_id).rollover_chest_rules.read().is_some(),
        "Frontier pool requires chest rules",
    );
    assert!(amount > 0, "empty Frontier pool");
    assert!(budget(game_id).map(|value| value.pool).unwrap_or(0) == 0, "Frontier pool already published");
    let timestamp = starknet::get_block_timestamp();
    assert!(timestamp < game.end_at, "Frontier season ended");
    let day = crate::days::day_of(game, rules.day_unit_seconds, core::cmp::max(timestamp, game.start_main_at)).index;
    write(game_id, first_day(chest_rules(game_id), amount, day));
}

/// Confirmed carry-over only grows the chest pool; retrying the same total changes nothing.
pub fn top_up_pool(game_id: u32, amount: u128) {
    let game = crate::logic::game::game(game_id);
    assert!(starknet::get_block_timestamp() < game.end_at, "Frontier season ended");
    let mut value = budget(game_id).expect('Frontier pool not published');
    assert!(amount >= value.pool, "Frontier pool cannot shrink");
    if amount == value.pool {
        return;
    }
    value.pool_left += amount - value.pool;
    value.pool = amount;
    write(game_id, value);
}

/// Draw a tier at the frozen daily price; reservation counts an actual reward roll towards tomorrow.
pub fn candidate(game_id: u32, odds: ChestTiers, seed: u256, context: ExecutionContext) -> SiteChest {
    priced_chest(game_id, roll_tier(odds, seed), context)
}

pub fn pay_ruin(key: ResourceKey, home_id: u64, context: ExecutionContext) -> crate::resources::ResourceAmount {
    assert!(
        crate::entity_ids::namespace(key.entity_id) == crate::entity_ids::namespace(home_id),
        "ruin belongs to another realm",
    );
    assert!(!crate::logic::expeditions::ruin_disappeared(key), "realm already cleared a ruin today");
    let chest = site_chest(key).expect('missing ruin chest');
    assert!(chest.reservation_day == today(key.game_id, context).day, "ruin belongs to another day");
    assert!(try_reserve(key.game_id, chest, context), "day's LORDS budget cannot fund this ruin");
    pay(key, context)
}

pub fn common_candidate(game_id: u32, context: ExecutionContext) -> SiteChest {
    priced_chest(game_id, 0, context)
}

fn priced_chest(game_id: u32, tier: u8, context: ExecutionContext) -> SiteChest {
    let today = today(game_id, context);
    if budget(game_id) != Some(today) {
        write(game_id, today);
    }
    SiteChest {
        tier,
        amount: Into::<u16, u128>::into(tier_value(chest_rules(game_id).shares, tier)) * today.price,
        reservation_day: today.day,
    }
}

/// Count every rolled chest, including refusals; reserve only available LORDS.
pub fn try_reserve(game_id: u32, chest: SiteChest, context: ExecutionContext) -> bool {
    let mut today = today(game_id, context);
    assert!(chest.reservation_day == today.day, "chest reservation day mismatch");
    today.rolled_shares += tier_value(chest_rules(game_id).shares, chest.tier).into();
    let accepted = fits(today, season_clock(context), chest.amount);
    if accepted {
        today.open += chest.amount;
    }
    write(game_id, today);
    accepted
}

/// Pays an opened or cleared chest out of the pool, as the LORDS its realm receives. Chests never pay more than
/// the pool holds.
pub fn pay(ruin: ResourceKey, context: ExecutionContext) -> crate::resources::ResourceAmount {
    let chest = site_chest(ruin).expect('missing ruin chest');
    let mut today = today(ruin.game_id, context);
    // Yesterday's hold was released at rollover. Clearing that site must not consume another player's hold.
    if chest.reservation_day != today.day {
        return crate::resources::ResourceAmount { resource_type: crate::resources::LORDS, amount: 0 };
    }
    assert!(chest.amount <= today.open, "ruin chest is not reserved");
    assert!(
        issued(today) + chest.amount <= unlocked(today.pool, season_clock(context), today.day),
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
    let mut today = today(game_id, context);
    assert!(amount <= issued(today), "refill exceeds issued LORDS");
    today.pool_left += amount;
    write(game_id, today);
}

pub fn fits(today: LordsBudget, clock: SeasonClock, amount: u128) -> bool {
    amount != 0 && amount <= available(today, clock)
}

pub fn available(today: LordsBudget, clock: SeasonClock) -> u128 {
    let unlocked = unlocked(today.pool, clock, today.day);
    let committed = Into::<u128, u256>::into(issued(today)) + today.open.into();
    if committed >= unlocked.into() {
        0
    } else {
        (Into::<u128, u256>::into(unlocked) - committed).try_into().unwrap()
    }
}

fn issued(today: LordsBudget) -> u128 {
    assert!(today.pool_left <= today.pool, "LORDS pool exceeds its funding");
    today.pool - today.pool_left
}

/// The current day counts as unlocked from its start; the last partial day stops exactly at the season end.
pub fn unlocked(pool: u128, clock: SeasonClock, day: u64) -> u128 {
    let end = core::cmp::min(budget_day(clock, day).end, clock.game.end_at);
    let duration = clock.game.end_at - clock.game.start_main_at;
    assert!(duration != 0, "empty LORDS season");
    (Into::<u128, u256>::into(pool) * (end - clock.game.start_main_at).into() / duration.into()).try_into().unwrap()
}

fn season_clock(context: ExecutionContext) -> SeasonClock {
    let rules = context.rules.unbox();
    SeasonClock {
        game: context.game.unbox(),
        day_unit_seconds: rules.day_unit_seconds,
        tick: rules.tick_config.armies_tick_in_seconds,
    }
}

pub fn chest_rules(game_id: u32) -> ChestRules {
    crate::logic::preset_record::for_game(game_id).rollover_chest_rules.read().expect('missing chest rules')
}

// The first touch of a day releases expired holds; paid LORDS stay deducted.
fn today(game_id: u32, context: ExecutionContext) -> LordsBudget {
    let game = context.game.unbox();
    let clock = season_clock(context);
    let day = crate::days::day_of(game, clock.day_unit_seconds, context.timestamp).index;
    match budget(game_id) {
        Some(previous) => if previous.day == day {
            previous
        } else {
            roll(chest_rules(game_id), previous, clock, day)
        },
        None => first_day(chest_rules(game_id), 0, day),
    }
}

#[derive(Copy, Drop)]
pub struct SeasonClock {
    pub game: crate::game::GameRegistry,
    pub day_unit_seconds: u32,
    pub tick: u64,
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

/// An unfunded game and a newly published pool have no funded yesterday.
pub fn first_day(rules: ChestRules, pool: u128, day: u64) -> LordsBudget {
    LordsBudget {
        pool,
        pool_left: pool,
        open: 0,
        day,
        price: rules.price_ceiling,
        rolled_shares: 0,
        yesterday_shares: 0,
        yesterday_ticks: 0,
    }
}

fn day_ticks(clock: SeasonClock, index: u64) -> u64 {
    let day = budget_day(clock, index);
    let end = core::cmp::min(day.end, clock.game.end_at);
    if end <= day.start {
        0
    } else {
        (end - day.start) / clock.tick
    }
}

/// Release expired holds and price the new day using only its immediate predecessor.
pub fn roll(rules: ChestRules, previous: LordsBudget, clock: SeasonClock, day: u64) -> LordsBudget {
    assert!(day > previous.day, "LORDS budget runs backwards");
    let (yesterday_shares, yesterday_ticks) = if previous.pool != 0 && day == previous.day
        + 1 && previous.rolled_shares != 0 {
        (previous.rolled_shares, day_ticks(clock, previous.day))
    } else {
        (0, 0)
    };
    let mut today = LordsBudget { open: 0, day, rolled_shares: 0, yesterday_shares, yesterday_ticks, ..previous };
    today.price = daily_price(rules, today, clock);
    today
}

// Keeping the rate as a ratio preserves sparse observations without a precision setting.
fn daily_price(rules: ChestRules, today: LordsBudget, clock: SeasonClock) -> u128 {
    let expected = Into::<u128, u256>::into(today.yesterday_shares) * day_ticks(clock, today.day).into();
    if expected == 0 || today.yesterday_ticks == 0 {
        rules.price_ceiling
    } else {
        let price = Into::<u128, u256>::into(available(today, clock)) * today.yesterday_ticks.into() / expected;
        core::cmp::max(1, core::cmp::min(rules.price_ceiling.into(), price)).try_into().unwrap()
    }
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
