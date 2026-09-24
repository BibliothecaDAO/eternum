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

#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct ChestGround {
    pub common: u16,
    pub uncommon: u16,
    pub rare: u16,
    pub pity: u16,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct ChestRules {
    pub loose_one_in: u16,
    pub relic_probability: u16,
    pub cosmetic_probability: u16,
    pub token_cap: u16,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
#[allow(starknet::store_no_default_variant)]
pub enum ChestKind {
    Relic,
    Cosmetic,
    Token,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct ChestReward {
    pub player: ContractAddress,
    pub explorer_id: u32,
    pub epoch: u64,
    pub depth: u8,
    pub kind: ChestKind,
    pub quality: u8,
    pub relic_id: u8,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct ChestRoll {
    pub kind: ChestKind,
    pub quality: u8,
    pub pity: u16,
}

pub fn roll_chest(
    rules: ChestRules, ground: ChestGround, pity: u16, tokens: u16, seed: u256, timestamp: u64,
) -> ChestRoll {
    let type_roll = crate::random::range(seed, Into::<u64, u128>::into(timestamp) + 31, 10000);
    let kind = if type_roll < rules.relic_probability.into() {
        ChestKind::Relic
    } else if type_roll < Into::<u16, u128>::into(rules.relic_probability) + rules.cosmetic_probability.into() {
        ChestKind::Cosmetic
    } else if tokens < rules.token_cap {
        ChestKind::Token
    } else {
        ChestKind::Relic
    };
    let quality_roll = crate::random::range(seed, Into::<u64, u128>::into(timestamp) + 37, 10000);
    let mut quality = if quality_roll < ground.common.into() {
        0
    } else if quality_roll < Into::<u16, u128>::into(ground.common) + ground.uncommon.into() {
        1
    } else if quality_roll < Into::<u16, u128>::into(ground.common) + ground.uncommon.into() + ground.rare.into() {
        2
    } else {
        3
    };
    let mut next_pity = pity;
    if kind == ChestKind::Relic {
        if pity + 1 >= ground.pity {
            quality = 3;
        }
        next_pity = if quality == 3 {
            0
        } else {
            pity + 1
        };
    }
    ChestRoll { kind, quality, pity: next_pity }
}

#[starknet::interface]
pub trait IRelics<T> {
    fn chest_rules(self: @T, game_id: u32) -> Option<ChestRules>;
    fn chest_pity(self: @T, game_id: u32, player: ContractAddress, depth: u8) -> u16;
    fn chest_tokens(self: @T, game_id: u32, player: ContractAddress, epoch: u64) -> u16;
    fn chest_reward(self: @T, game_id: u32, order: u64, index: u32) -> Option<ChestReward>;
    fn grant_reveal_chest(
        ref self: T,
        game_id: u32,
        actor: ContractAddress,
        command: OpenChest,
        context: crate::commands::ActionContext,
        story_cursor: crate::ownership::StoryCursor,
    ) -> ((), crate::ownership::StoryCursor);
    fn relic_rules(self: @T, game_id: u32) -> Span<RelicRule>;
    fn open_relic_chest(
        ref self: T,
        game_id: u32,
        actor: ContractAddress,
        command: OpenChest,
        context: crate::commands::ActionContext,
        story_cursor: crate::ownership::StoryCursor,
    ) -> ((), crate::ownership::StoryCursor);
    fn grant_site_chest(
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
