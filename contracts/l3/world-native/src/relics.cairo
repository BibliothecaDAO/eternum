use starknet::ContractAddress;
use crate::resources::ResourceKey;
use crate::troops::Coord;

pub const FIRST_RELIC: u8 = 39;
pub const LAST_RELIC: u8 = 56;
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
    pub entity_id: u32,
    pub relic_id: u8,
    pub recipient: Recipient,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct OpenChest {
    pub explorer_id: u32,
    pub coord: Coord,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct ChestOpened {
    pub explorer_id: u32,
    pub coord: Coord,
    pub relics: Span<u8>,
    pub points: u128,
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

pub fn roll_tier(odds: ChestTiers, seed: u256, timestamp: u64) -> u8 {
    let mut draw = crate::random::range(seed, Into::<u64, u128>::into(timestamp) + 37, 10000);
    for tier in 0_u8..4 {
        let weight: u128 = tier_value(odds, tier).into();
        if draw < weight {
            return tier;
        }
        draw -= weight;
    }
    4
}

// A common chest's price is capped by the preset and priced from unlocked rollover over expected rolled shares.
#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct ChestRules {
    pub pool: u128,
    pub price_ceiling: u128,
    pub shares: ChestTiers,
    pub estimate_days: u16,
}

// A ruin's chest, fixed when the ruin is found: its tier and the whole LORDS its clear pays.
#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct SiteChest {
    pub tier: u8,
    pub amount: u128,
}

// Open chests reserve unlocked LORDS. Rolled shares include found and refused ruins; estimate is shares per tick.
#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct LordsBudget {
    pub pool_left: u128,
    pub open: u128,
    pub day: u64,
    pub price: u128,
    pub estimate: u128,
    pub rolled_shares: u128,
}

pub const LORDS_ESTIMATE_SCALE: u128 = 1000000;

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct RefillStamina {
    pub explorer_id: u32,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct WithdrawLords {
    pub structure_id: u32,
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
        story_cursor: crate::ownership::StoryCursor,
    ) -> ((), crate::ownership::StoryCursor);
    fn withdraw_lords(
        ref self: T,
        game_id: u32,
        actor: ContractAddress,
        command: WithdrawLords,
        context: crate::commands::ActionContext,
        story_cursor: crate::ownership::StoryCursor,
    ) -> ((), crate::ownership::StoryCursor);
}

#[starknet::interface]
pub trait ICaptureRewards<T> {
    fn grant_capture_rewards(
        ref self: T,
        site: ResourceKey,
        explorer_id: u32,
        context: crate::commands::ActionContext,
        story_cursor: crate::ownership::StoryCursor,
    ) -> ((), crate::ownership::StoryCursor);
}

#[starknet::interface]
pub trait IRelics<T> {
    fn lords_budget(self: @T, game_id: u32) -> Option<LordsBudget>;
    fn chest_rules(self: @T, game_id: u32) -> Option<ChestRules>;
    fn site_chest(self: @T, key: ResourceKey) -> Option<SiteChest>;
    fn relic_rules(self: @T, game_id: u32) -> Span<RelicRule>;
    fn open_relic_chest(
        ref self: T,
        game_id: u32,
        actor: ContractAddress,
        command: OpenChest,
        context: crate::commands::ActionContext,
        story_cursor: crate::ownership::StoryCursor,
    ) -> ((), crate::ownership::StoryCursor);
    fn apply_relic(
        ref self: T,
        game_id: u32,
        actor: ContractAddress,
        command: ApplyRelic,
        context: crate::commands::ActionContext,
        story_cursor: crate::ownership::StoryCursor,
    );
}
#[starknet::interface]
pub trait IRelicMap<T> {
    #[cfg(test)]
    fn relic_discovery_time(self: @T, game_id: u32) -> u64;
    fn discover_relic_chest(
        ref self: T,
        game_id: u32,
        coord: Coord,
        excluded: Coord,
        seed: u256,
        timestamp: u64,
        game_context: crate::commands::ActionContext,
    );
    fn consume_relic_chest(ref self: T, game_id: u32, coord: Coord);
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

pub fn chest_destination(origin: Coord, seed: u256, timestamp: u64, distance: u8) -> Coord {
    let seed = if seed > 12 {
        seed - 12
    } else {
        seed + 12
    };
    let mut salt: u128 = timestamp.into();
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
pub fn draw_relics(rules: Span<RelicRule>, seed: u256, timestamp: u64, count: u8) -> Span<u8> {
    let mut total: u128 = 0;
    for rule in rules {
        total += *rule.draw_weight;
    }
    assert!(total != 0, "empty relic discovery pool");
    let mut chosen = array![];
    let mut salt: u128 = timestamp.into();
    for _ in 0..count {
        salt += 18;
        let roll = crate::random::range(seed, salt, total);
        let mut cumulative = 0;
        for index in 0..rules.len() {
            cumulative += *rules.at(index).draw_weight;
            if roll < cumulative {
                chosen.append(FIRST_RELIC + index.try_into().unwrap());
                break;
            }
        }
    }
    chosen.span()
}
pub fn boost_explorer(ref boosts: crate::troops::TroopBoosts, id: u8, rule: RelicRule, tick: u32) {
    match id {
        39 |
        40 => {
            boosts.incr_stamina_regen_percent_num = rule.rate_bps;
            boosts.incr_stamina_regen_tick_count = rule.uses;
        },
        41 |
        42 => {
            boosts.incr_damage_dealt_percent_num = rule.rate_bps;
            boosts.incr_damage_dealt_end_tick = tick + rule.duration;
        },
        43 |
        44 => {
            boosts.decr_damage_gotten_percent_num = rule.rate_bps;
            boosts.decr_damage_gotten_end_tick = tick + rule.duration;
        },
        47 |
        48 => {
            boosts.incr_explore_reward_percent_num = rule.rate_bps;
            boosts.incr_explore_reward_end_tick = tick + rule.duration;
        },
        45 | 46 => {},
        _ => panic!("invalid explorer relic"),
    }
}
pub fn boost_production(ref bonus: crate::production::ProductionBonus, id: u8, rule: RelicRule, tick: u32) {
    match id {
        51 |
        52 => {
            bonus.incr_resource_rate_percent_num = rule.rate_bps;
            bonus.incr_resource_rate_end_tick = tick + rule.duration;
        },
        53 |
        54 => {
            bonus.incr_labor_rate_percent_num = rule.rate_bps;
            bonus.incr_labor_rate_end_tick = tick + rule.duration;
        },
        55 |
        56 => {
            bonus.incr_troop_rate_percent_num = rule.rate_bps;
            bonus.incr_troop_rate_end_tick = tick + rule.duration;
        },
        _ => panic!("invalid production relic"),
    }
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct InteractSite {
    pub explorer_id: u32,
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
        story_cursor: crate::ownership::StoryCursor,
    ) -> ((), crate::ownership::StoryCursor);
}
