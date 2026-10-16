use starknet::ContractAddress;
use crate::resources::ResourceKey;
use crate::troops::Coord;

pub const FIRST_RELIC: u8 = 39;
pub const LAST_RELIC: u8 = 56;
// Relics before this id boost an army; the rest boost a structure, its guards or its production.
pub const FIRST_STRUCTURE_RELIC: u8 = 49;

pub fn is_army_relic(id: u8) -> bool {
    id < FIRST_STRUCTURE_RELIC
}
#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct RelicRule {
    pub rate_bps: u16,
    pub duration: u32,
    pub uses: u8,
    pub essence_cost: u128,
    pub draw_weight: u128,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub enum Recipient {
    Explorer,
    StructureProduction,
    StructureGuard,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct ApplyRelic {
    pub entity_id: u64,
    pub relic_id: u8,
    pub recipient: Recipient,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct OpenChest {
    pub explorer_id: u64,
    pub coord: Coord,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct ChestOpened {
    pub explorer_id: u64,
    pub coord: Coord,
    pub chest: RelicChest,
    pub relics: Span<u8>,
    pub points: u128,
}

// A relic chest holds one themed pack of three level I relics, or all level II when its lucky roll wins. Its pack is
// drawn when the chest appears, so the chest names it before anyone opens it. Opening pays army relics to the army
// and structure relics to its home.
#[derive(Copy, Drop, Serde, Debug, PartialEq, Default, starknet::Store)]
pub enum RelicPack {
    #[default]
    War,
    Explore,
    Produce,
    Fortress,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct RelicChest {
    pub pack: RelicPack,
    pub lucky: bool,
}
pub const WAR_PACK_BPS: u128 = 3000;
pub const EXPLORE_PACK_BPS: u128 = 3000;
pub const PRODUCE_PACK_BPS: u128 = 2500;
pub const FORTRESS_PACK_BPS: u128 = 1500;
pub const LUCKY_CHEST_BPS: u128 = 2000;

pub fn draw_chest(seed: u256) -> RelicChest {
    let roll = crate::random::range(seed, 61, 10000);
    let pack = if roll < WAR_PACK_BPS {
        RelicPack::War
    } else if roll < WAR_PACK_BPS + EXPLORE_PACK_BPS {
        RelicPack::Explore
    } else if roll < WAR_PACK_BPS + EXPLORE_PACK_BPS + PRODUCE_PACK_BPS {
        RelicPack::Produce
    } else {
        RelicPack::Fortress
    };
    RelicChest { pack, lucky: crate::random::range(seed, 67, 10000) < LUCKY_CHEST_BPS }
}

/// The pack's three relics, at level II when the chest is lucky: each level II relic is its level I id plus one.
pub fn pack_relics(chest: RelicChest) -> Span<u8> {
    let level_one: Array<u8> = match chest.pack {
        // Damage, Damage Reduction, Stamina.
        RelicPack::War => array![41, 43, 39],
        // Exploration, Exploration Reward, Stamina.
        RelicPack::Explore => array![45, 47, 39],
        // Production, Labor Production, Troop Production.
        RelicPack::Produce => array![51, 53, 55],
        // Structure Defense, Damage Reduction, Troop Production.
        RelicPack::Fortress => array![49, 43, 55],
    };
    let level: u8 = if chest.lucky {
        1
    } else {
        0
    };
    let mut relics = array![];
    for id in level_one {
        relics.append(id + level);
    }
    relics.span()
}

// Five chest tiers, common to legendary: a depth's odds in basis points, or the shares each tier pays.
#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct ChestTiers {
    pub common: u16,
    pub uncommon: u16,
    pub rare: u16,
    pub epic: u16,
    pub legendary: u16,
}

pub fn tier_value(tiers: ChestTiers, tier: u8) -> u16 {
    match tier {
        0 => tiers.common,
        1 => tiers.uncommon,
        2 => tiers.rare,
        3 => tiers.epic,
        4 => tiers.legendary,
        _ => panic!("invalid chest tier"),
    }
}

pub fn roll_tier(odds: ChestTiers, seed: u256) -> u8 {
    let mut draw = crate::random::range(seed, 37, 10000);
    for tier in 0_u8..4 {
        let weight: u128 = tier_value(odds, tier).into();
        if draw < weight {
            return tier;
        }
        draw -= weight;
    }
    4
}

// A chest pays its tier's shares at the day's frozen price, capped by the preset.
#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct ChestRules {
    pub price_ceiling: u128,
    pub shares: ChestTiers,
    pub claim_window_seconds: u32,
}

// A ruin's chest, fixed when the ruin is found: its tier and the whole LORDS its clear pays.
#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct SiteChest {
    pub tier: u8,
    pub amount: u128,
    pub reservation_day: u64,
}

// Open chests reserve unlocked LORDS until the day ends. Unspent funding rolls forward.
#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct LordsBudget {
    pub pool: u128,
    pub pool_left: u128,
    pub open: u128,
    pub day: u64,
    pub price: u128,
    pub rolled_shares: u128,
    pub yesterday_shares: u128,
    pub yesterday_ticks: u64,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct RefillStamina {
    pub explorer_id: u64,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct WithdrawLords {
    pub structure_id: u64,
    pub amount: u128,
}

// A realm's withdrawal of whole LORDS, recorded for fulfilment on L2.
#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct LordsWithdrawal {
    pub account: ContractAddress,
    pub amount: u128,
}

#[starknet::interface]
pub trait ILords<T> {
    fn refill_stamina(
        ref self: T,
        game_id: u32,
        actor: ContractAddress,
        command: RefillStamina,
        context: crate::commands::ActionContext,
    );
    fn withdraw_lords(
        ref self: T,
        game_id: u32,
        actor: ContractAddress,
        command: WithdrawLords,
        context: crate::commands::ActionContext,
    );
}

#[starknet::interface]
pub trait ICaptureRewards<T> {
    fn grant_capture_rewards(ref self: T, site: ResourceKey, explorer_id: u64, context: crate::commands::ActionContext);
}

#[starknet::interface]
pub trait IRelics<T> {
    fn lords_budget(self: @T, game_id: u32) -> Option<LordsBudget>;
    fn chest_rules(self: @T, game_id: u32) -> Option<ChestRules>;
    fn site_chest(self: @T, key: ResourceKey) -> Option<SiteChest>;
    fn relic_rules(self: @T, game_id: u32) -> Span<RelicRule>;
    fn open_relic_chest(
        ref self: T, game_id: u32, actor: ContractAddress, command: OpenChest, context: crate::commands::ActionContext,
    );
    fn apply_relic(
        ref self: T, game_id: u32, actor: ContractAddress, command: ApplyRelic, context: crate::commands::ActionContext,
    );
}
#[starknet::interface]
pub trait IRelicMap<T> {
    #[cfg(test)]
    fn relic_discovery_time(self: @T, game_id: u32) -> u64;
    fn discover_relic_chest(
        ref self: T,
        game_id: u32,
        home_id: u64,
        coord: Coord,
        excluded: Coord,
        seed: u256,
        timestamp: u64,
        game_context: crate::commands::ActionContext,
    );
    fn consume_relic_chest(ref self: T, game_id: u32, coord: Coord) -> u64;
    fn reveal_relic_ring(
        ref self: T, game_id: u32, coord: Coord, radius: u8, game_context: crate::commands::BiomeContext,
    );
}
#[starknet::interface]
pub trait IRelicTroops<T> {
    fn apply_troop_relic(
        ref self: T,
        game_id: u32,
        actor: ContractAddress,
        command: ApplyRelic,
        rule: RelicRule,
        timestamp: u64,
        game_context: crate::commands::ActionContext,
    );
}
#[starknet::interface]
pub trait IRelicProduction<T> {
    fn apply_production_relic(
        ref self: T,
        key: ResourceKey,
        relic_id: u8,
        rule: RelicRule,
        timestamp: u64,
        game_context: crate::commands::ActionContext,
    );
}

pub fn chest_destination(origin: Coord, seed: u256, distance: u8) -> Coord {
    let seed = if seed > 12 {
        seed - 12
    } else {
        seed + 12
    };
    let mut salt: u128 = 0;
    let mut chosen = 0_u8;
    let mut step = 1_u32;
    let mut coord = origin;
    while step <= 3 {
        salt += 18;
        let direction: u8 = crate::random::range(seed, salt, 6).try_into().unwrap();
        let mask = match direction {
            0 => 1,
            1 => 2,
            2 => 4,
            3 => 8,
            4 => 16,
            5 => 32,
            _ => panic!("invalid direction"),
        };
        if chosen & mask == 0 {
            chosen = chosen | mask;
            coord = crate::geometry::neighbor_at_distance(coord, direction, Into::<u8, u32>::into(distance) / step);
            step += 1;
        }
    }
    coord
}
/// The artificer's craft: one relic by the preset's draw weights.
pub fn draw_relic(rules: Span<RelicRule>, seed: u256) -> u8 {
    let mut total: u128 = 0;
    for rule in rules {
        total += *rule.draw_weight;
    }
    assert!(total != 0, "empty relic discovery pool");
    let roll = crate::random::range(seed, 18, total);
    let mut cumulative = 0;
    for index in 0..rules.len() {
        cumulative += *rules.at(index).draw_weight;
        if roll < cumulative {
            return FIRST_RELIC + index.try_into().unwrap();
        }
    }
    panic!("invalid relic draw")
}
pub fn bonus_active(end_at: u32, timestamp: u64) -> bool {
    timestamp < end_at.into()
}

pub fn bonus_end_at(timestamp: u64, duration_ticks: u32, tick_seconds: u64) -> u32 {
    (timestamp + Into::<u32, u64>::into(duration_ticks) * tick_seconds).try_into().unwrap()
}

pub fn boost_explorer(
    ref boosts: crate::troops::TroopBoosts, id: u8, rule: RelicRule, timestamp: u64, tick_seconds: u64,
) {
    match id {
        39 |
        40 => {
            boosts.incr_stamina_regen_percent_num = rule.rate_bps;
            boosts
                .incr_stamina_regen_seconds_left = (Into::<u8, u64>::into(rule.uses) * tick_seconds)
                .try_into()
                .unwrap();
        },
        41 |
        42 => {
            boosts.incr_damage_dealt_percent_num = rule.rate_bps;
            boosts.incr_damage_dealt_end_at = bonus_end_at(timestamp, rule.duration, tick_seconds);
        },
        43 |
        44 => {
            boosts.decr_damage_gotten_percent_num = rule.rate_bps;
            boosts.decr_damage_gotten_end_at = bonus_end_at(timestamp, rule.duration, tick_seconds);
        },
        47 |
        48 => {
            boosts.incr_explore_reward_percent_num = rule.rate_bps;
            boosts.incr_explore_reward_end_at = bonus_end_at(timestamp, rule.duration, tick_seconds);
        },
        45 | 46 => {},
        _ => panic!("invalid explorer relic"),
    }
}
pub fn boost_production(
    ref bonus: crate::production::ProductionBonus, id: u8, rule: RelicRule, timestamp: u64, tick_seconds: u64,
) {
    match id {
        51 |
        52 => {
            bonus.incr_resource_rate_percent_num = rule.rate_bps;
            bonus.incr_resource_rate_end_at = bonus_end_at(timestamp, rule.duration, tick_seconds);
        },
        53 |
        54 => {
            bonus.incr_labor_rate_percent_num = rule.rate_bps;
            bonus.incr_labor_rate_end_at = bonus_end_at(timestamp, rule.duration, tick_seconds);
        },
        55 |
        56 => {
            bonus.incr_troop_rate_percent_num = rule.rate_bps;
            bonus.incr_troop_rate_end_at = bonus_end_at(timestamp, rule.duration, tick_seconds);
        },
        _ => panic!("invalid production relic"),
    }
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct InteractSite {
    pub explorer_id: u64,
    pub coord: crate::troops::Coord,
}

#[starknet::interface]
pub trait IFrontierSites<T> {
    fn interact_site(
        ref self: T,
        game_id: u32,
        actor: starknet::ContractAddress,
        command: InteractSite,
        context: crate::commands::ActionContext,
    );
}

// Stop debits before the ledger report deadline so confirmed receipts have time to arrive.
pub fn assert_claim_window(game: crate::game::GameRegistry, rules: ChestRules, timestamp: u64) {
    assert!(
        timestamp < game.end_at
            + Into::<u32, u64>::into(rules.claim_window_seconds - crate::days::FRONTIER_REPORT_GRACE_SECONDS),
        "LORDS claim window closed",
    );
}
