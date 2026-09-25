use crate::combat::TroopsTrait;
use crate::stamina::StaminaTrait;

#[derive(Copy, Drop, Serde, Default, Debug, PartialEq, starknet::Store)]
pub struct Coord {
    pub alt: bool,
    pub x: u32,
    pub y: u32,
}
#[derive(Copy, Drop, Serde, Default, Debug, PartialEq, starknet::Store)]
pub enum TroopType {
    #[default]
    Knight,
    Paladin,
    Crossbowman,
}
impl TroopTypeIntoU8 of Into<TroopType, u8> {
    fn into(self: TroopType) -> u8 {
        match self {
            TroopType::Knight => 0,
            TroopType::Paladin => 1,
            TroopType::Crossbowman => 2,
        }
    }
}
#[derive(Copy, Drop, Serde, Default, Debug, PartialEq, starknet::Store)]
pub enum TroopTier {
    #[default]
    T1,
    T2,
    T3,
}
#[derive(Copy, Drop, Serde, Default, Debug, PartialEq, starknet::Store)]
pub struct Stamina {
    pub amount: u64,
    pub updated_tick: u64,
}
#[derive(Copy, Drop, Serde, Default, Debug, PartialEq)]
pub struct TroopBoosts {
    pub incr_damage_dealt_percent_num: u16,
    pub incr_damage_dealt_end_tick: u32,
    pub decr_damage_gotten_percent_num: u16,
    pub decr_damage_gotten_end_tick: u32,
    pub incr_stamina_regen_percent_num: u16,
    pub incr_stamina_regen_tick_count: u8,
    pub incr_explore_reward_percent_num: u16,
    pub incr_explore_reward_end_tick: u32,
}

const DAMAGE_END_SCALE: u128 = 0x10000;
const DEFENSE_PERCENT_SCALE: u128 = 0x1000000000000;
const DEFENSE_END_SCALE: u128 = 0x10000000000000000;
const STAMINA_PERCENT_SCALE: u128 = 0x1000000000000000000000000;
const STAMINA_TICKS_SCALE: u128 = 0x10000000000000000000000000000;

// Damage, defense and stamina use 120 low-limb bits; exploration uses 48 high-limb bits.
pub impl TroopBoostsPacking of starknet::storage_access::StorePacking<TroopBoosts, felt252> {
    fn pack(value: TroopBoosts) -> felt252 {
        let low = value.incr_damage_dealt_percent_num.into()
            + value.incr_damage_dealt_end_tick.into() * DAMAGE_END_SCALE
            + value.decr_damage_gotten_percent_num.into() * DEFENSE_PERCENT_SCALE
            + value.decr_damage_gotten_end_tick.into() * DEFENSE_END_SCALE
            + value.incr_stamina_regen_percent_num.into() * STAMINA_PERCENT_SCALE
            + value.incr_stamina_regen_tick_count.into() * STAMINA_TICKS_SCALE;
        let high = value.incr_explore_reward_percent_num.into()
            + value.incr_explore_reward_end_tick.into() * DAMAGE_END_SCALE;
        u256 { low, high }.try_into().unwrap()
    }
    fn unpack(value: felt252) -> TroopBoosts {
        let value: u256 = value.into();
        TroopBoosts {
            incr_damage_dealt_percent_num: (value.low % 0x10000).try_into().unwrap(),
            incr_damage_dealt_end_tick: (value.low / DAMAGE_END_SCALE % 0x100000000).try_into().unwrap(),
            decr_damage_gotten_percent_num: (value.low / DEFENSE_PERCENT_SCALE % 0x10000).try_into().unwrap(),
            decr_damage_gotten_end_tick: (value.low / DEFENSE_END_SCALE % 0x100000000).try_into().unwrap(),
            incr_stamina_regen_percent_num: (value.low / STAMINA_PERCENT_SCALE % 0x10000).try_into().unwrap(),
            incr_stamina_regen_tick_count: (value.low / STAMINA_TICKS_SCALE).try_into().unwrap(),
            incr_explore_reward_percent_num: (value.high % 0x10000).try_into().unwrap(),
            incr_explore_reward_end_tick: (value.high / DAMAGE_END_SCALE).try_into().unwrap(),
        }
    }
}
#[derive(Copy, Drop, Serde, Default, Debug, PartialEq)]
pub struct Troops {
    pub category: TroopType,
    pub tier: TroopTier,
    pub count: u128,
    pub stamina: Stamina,
    pub boosts: TroopBoosts,
    pub battle_cooldown_end: u32,
}
// Counts retain their full u128 range; stamina and combat flags each use one word.
#[derive(Copy, Drop, starknet::Store)]
pub struct PackedTroops {
    pub count: u128,
    pub stamina: u128,
    pub boosts: felt252,
    pub combat: u64,
}
const STAMINA_TICK_SCALE: u128 = 0x10000000000000000;
const TIER_SCALE: u64 = 4;
const COOLDOWN_SCALE: u64 = 16;
pub impl TroopsPacking of starknet::storage_access::StorePacking<Troops, PackedTroops> {
    fn pack(value: Troops) -> PackedTroops {
        let category: u8 = value.category.into();
        let tier: u64 = match value.tier {
            TroopTier::T1 => 0,
            TroopTier::T2 => 1,
            TroopTier::T3 => 2,
        };
        PackedTroops {
            count: value.count,
            stamina: value.stamina.amount.into() + value.stamina.updated_tick.into() * STAMINA_TICK_SCALE,
            boosts: TroopBoostsPacking::pack(value.boosts),
            combat: category.into() + tier * TIER_SCALE + value.battle_cooldown_end.into() * COOLDOWN_SCALE,
        }
    }
    fn unpack(value: PackedTroops) -> Troops {
        let category = match value.combat % TIER_SCALE {
            0 => TroopType::Knight,
            1 => TroopType::Paladin,
            2 => TroopType::Crossbowman,
            _ => panic!("invalid stored troop type"),
        };
        let tier = match value.combat / TIER_SCALE % TIER_SCALE {
            0 => TroopTier::T1,
            1 => TroopTier::T2,
            2 => TroopTier::T3,
            _ => panic!("invalid stored troop tier"),
        };
        Troops {
            category,
            tier,
            count: value.count,
            stamina: Stamina {
                amount: (value.stamina % STAMINA_TICK_SCALE).try_into().unwrap(),
                updated_tick: (value.stamina / STAMINA_TICK_SCALE).try_into().unwrap(),
            },
            boosts: TroopBoostsPacking::unpack(value.boosts),
            battle_cooldown_end: (value.combat / COOLDOWN_SCALE).try_into().unwrap(),
        }
    }
}
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct ExplorerKey {
    pub game_id: u32,
    pub explorer_id: u32,
}
#[derive(Copy, Drop, Serde, Default, Debug, PartialEq, starknet::Store)]
pub struct ExplorerRecord {
    pub owner: u32,
    pub troops: Troops,
}

// Views join troop facts with the canonical spatial record; coordinates are never stored here.
#[derive(Copy, Drop, Serde, Default, Debug, PartialEq)]
pub struct ExplorerTroops {
    pub owner: u32,
    pub troops: Troops,
    pub coord: Coord,
}

#[generate_trait]
pub impl ExplorerRecordProjection of ExplorerRecordTrait {
    fn into_record(self: ExplorerTroops) -> ExplorerRecord {
        ExplorerRecord { owner: self.owner, troops: self.troops }
    }
}

#[derive(Drop, starknet::Event)]
pub struct BattleEvent {
    #[key]
    pub version: u8,
    #[key]
    pub game_id: u32,
    #[key]
    pub order: u64,
    #[key]
    pub index: u32,
    #[key]
    pub attacker_id: u32,
    #[key]
    pub defender_id: u32,
    #[key]
    pub attacker_owner: u32,
    #[key]
    pub defender_owner: u32,
    pub winner_id: u32,
    pub coord: Coord,
    pub max_reward: Span<crate::resources::ResourceAmount>,
    pub attacker: crate::combat_actions::BattleSide,
    pub defender: crate::combat_actions::BattleSide,
    pub timestamp: u64,
}


pub fn troop_resource(category: TroopType, tier: u8) -> u8 {
    (match category {
        TroopType::Knight => 26,
        TroopType::Paladin => 32,
        TroopType::Crossbowman => 29,
    }) + tier
}
pub(crate) fn explorer_occupier(explorer: ExplorerTroops) -> u8 {
    troop_occupier(explorer.troops)
}

pub(crate) fn troop_occupier(troops: Troops) -> u8 {
    let category = match troops.category {
        TroopType::Knight => 15,
        TroopType::Paladin => 18,
        TroopType::Crossbowman => 21,
    };
    let tier = match troops.tier {
        TroopTier::T1 => 0,
        TroopTier::T2 => 1,
        TroopTier::T3 => 2,
    };
    category + tier
}
pub fn max_army_size(config: crate::rules::TroopLimitConfig, level: u8, tier: TroopTier) -> u32 {
    let cap = match level {
        0 => config.settlement_deployment_cap,
        1 => config.city_deployment_cap,
        2 => config.kingdom_deployment_cap,
        3 => config.empire_deployment_cap,
        _ => panic!("invalid structure level"),
    };
    let (strength, modifier) = match tier {
        TroopTier::T1 => (config.t1_tier_strength, config.t1_tier_modifier),
        TroopTier::T2 => (config.t2_tier_strength, config.t2_tier_modifier),
        TroopTier::T3 => (config.t3_tier_strength, config.t3_tier_modifier),
    };
    cap * modifier.into() / (strength.into() * 100)
}

pub(crate) fn spend_stamina(
    ref explorer: ExplorerTroops,
    rules: crate::rules::SliceRules,
    biome: crate::biome::Biome,
    exploring: bool,
    timestamp: u64,
) {
    let stamina = rules.troop_stamina_config;
    let cost: u64 = if exploring {
        stamina.stamina_explore_stamina_cost.into()
    } else {
        let (increase, bonus) = explorer.troops.stamina_travel_bonus(biome, stamina);
        let base: u64 = stamina.stamina_travel_stamina_cost.into();
        if increase {
            base + bonus.into()
        } else {
            base - bonus.into()
        }
    };
    explorer
        .troops
        .stamina
        .spend(
            ref explorer.troops.boosts,
            explorer.troops.category,
            explorer.troops.tier,
            stamina,
            cost,
            timestamp / rules.tick_config.armies_tick_in_seconds,
            true,
        );
}

pub(crate) fn discovery_guards(
    category: u8, seed: u256, rules: crate::rules::SliceRules, timestamp: u64,
) -> Span<Troops> {
    use crate::troops::{TroopTier, TroopType};
    let light_guard = category == 4 || category == crate::camps::CAMP_CATEGORY;
    let three_guards = category == 2 || category == 3;
    let count = if light_guard {
        1_u8
    } else if three_guards {
        3
    } else {
        4
    };
    let tier = if light_guard {
        TroopTier::T1
    } else {
        TroopTier::T2
    };
    let mut guards = array![];
    for slot in 0_u8..count {
        let category = if light_guard {
            TroopType::Crossbowman
        } else {
            match slot {
                1 => TroopType::Knight,
                2 => TroopType::Crossbowman,
                _ => TroopType::Paladin,
            }
        };
        let guard_seed = seed + if three_guards {
            Into::<u8, u256>::into(slot)
        } else {
            0
        };
        let troops = discovery_guard(category, tier, guard_seed, rules, timestamp);
        guards.append(troops);
    }
    guards.span()
}

pub(crate) fn discovery_guard(
    category: crate::troops::TroopType,
    tier: crate::troops::TroopTier,
    seed: u256,
    rules: crate::rules::SliceRules,
    timestamp: u64,
) -> Troops {
    let lower: u128 = rules.troop_limit_config.mercenaries_troop_lower_bound.into();
    let upper: u128 = rules.troop_limit_config.mercenaries_troop_upper_bound.into();
    Troops {
        category,
        tier,
        count: (lower + crate::random::range(seed, 1, upper - lower)) * crate::rules::RESOURCE_PRECISION,
        stamina: crate::troops::Stamina {
            amount: 0, updated_tick: timestamp / rules.tick_config.armies_tick_in_seconds,
        },
        boosts: Default::default(),
        battle_cooldown_end: 0,
    }
}

#[starknet::interface]
pub trait IBattleResolution<T> {
    fn finish_battle(
        ref self: T,
        key: ExplorerKey,
        explorer: ExplorerTroops,
        before: u128,
        game_context: crate::commands::ActionContext,
    );
}
