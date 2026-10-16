use crate::combat::TroopsTrait;
use crate::stamina::StaminaSourceTrait;

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
#[derive(Copy, Drop, Serde, Default, Debug, PartialEq)]
pub struct Stamina {
    pub amount: u64,
    pub settled_at: u32,
    pub remainder: u32,
}
const STAMINA_TIME_SCALE: u128 = 0x10000000000000000;
const STAMINA_REMAINDER_SCALE: u128 = 0x1000000000000000000000000;
// Inline armies and shared slot bars use the same 128-bit storage representation.
pub impl StaminaPacking of starknet::storage_access::StorePacking<Stamina, u128> {
    fn pack(value: Stamina) -> u128 {
        value.amount.into()
            + value.settled_at.into() * STAMINA_TIME_SCALE
            + value.remainder.into() * STAMINA_REMAINDER_SCALE
    }
    fn unpack(value: u128) -> Stamina {
        Stamina {
            amount: (value % STAMINA_TIME_SCALE).try_into().unwrap(),
            settled_at: (value / STAMINA_TIME_SCALE % 0x100000000).try_into().unwrap(),
            remainder: (value / STAMINA_REMAINDER_SCALE).try_into().unwrap(),
        }
    }
}
#[derive(Copy, Drop, Serde, Default, Debug, PartialEq)]
pub enum StaminaSource {
    #[default]
    Inline: Stamina,
    Slot: u8,
}
impl StaminaIntoSource of Into<Stamina, StaminaSource> {
    fn into(self: Stamina) -> StaminaSource {
        StaminaSource::Inline(self)
    }
}
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct ArmySlotKey {
    pub game_id: u32,
    pub structure_id: u64,
    // The season day index (crate::days), under the field's historical name.
    pub epoch: u64,
    pub slot: u8,
}
#[derive(Copy, Drop, Serde, Default, Debug, PartialEq, starknet::Store)]
pub struct ArmySlot {
    pub explorer_id: u64,
    pub stamina: Stamina,
}
#[derive(Copy, Drop, Default, starknet::Store)]
pub struct ArmySlotRecord {
    pub initialized: bool,
    pub value: ArmySlot,
}

#[derive(Copy, Drop, Serde, Default, Debug, PartialEq)]
pub struct TroopBoosts {
    pub incr_damage_dealt_percent_num: u16,
    pub incr_damage_dealt_end_at: u32,
    pub decr_damage_gotten_percent_num: u16,
    pub decr_damage_gotten_end_at: u32,
    pub incr_stamina_regen_percent_num: u16,
    pub incr_stamina_regen_seconds_left: u16,
    pub incr_explore_reward_percent_num: u16,
    pub incr_explore_reward_end_at: u32,
}

const DAMAGE_END_SCALE: u128 = 0x10000;
const DEFENSE_PERCENT_SCALE: u128 = 0x1000000000000;
const DEFENSE_END_SCALE: u128 = 0x10000000000000000;
const STAMINA_PERCENT_SCALE: u128 = 0x1000000000000000000000000;
const STAMINA_SECONDS_SCALE: u128 = 0x10000000000000000000000000000;

// Damage, defense and stamina use 128 low-limb bits; exploration uses 48 high-limb bits.
pub impl TroopBoostsPacking of starknet::storage_access::StorePacking<TroopBoosts, felt252> {
    fn pack(value: TroopBoosts) -> felt252 {
        let low = value.incr_damage_dealt_percent_num.into()
            + value.incr_damage_dealt_end_at.into() * DAMAGE_END_SCALE
            + value.decr_damage_gotten_percent_num.into() * DEFENSE_PERCENT_SCALE
            + value.decr_damage_gotten_end_at.into() * DEFENSE_END_SCALE
            + value.incr_stamina_regen_percent_num.into() * STAMINA_PERCENT_SCALE
            + value.incr_stamina_regen_seconds_left.into() * STAMINA_SECONDS_SCALE;
        let high = value.incr_explore_reward_percent_num.into()
            + value.incr_explore_reward_end_at.into() * DAMAGE_END_SCALE;
        u256 { low, high }.try_into().unwrap()
    }
    fn unpack(value: felt252) -> TroopBoosts {
        let value: u256 = value.into();
        TroopBoosts {
            incr_damage_dealt_percent_num: (value.low % 0x10000).try_into().unwrap(),
            incr_damage_dealt_end_at: (value.low / DAMAGE_END_SCALE % 0x100000000).try_into().unwrap(),
            decr_damage_gotten_percent_num: (value.low / DEFENSE_PERCENT_SCALE % 0x10000).try_into().unwrap(),
            decr_damage_gotten_end_at: (value.low / DEFENSE_END_SCALE % 0x100000000).try_into().unwrap(),
            incr_stamina_regen_percent_num: (value.low / STAMINA_PERCENT_SCALE % 0x10000).try_into().unwrap(),
            incr_stamina_regen_seconds_left: (value.low / STAMINA_SECONDS_SCALE).try_into().unwrap(),
            incr_explore_reward_percent_num: (value.high % 0x10000).try_into().unwrap(),
            incr_explore_reward_end_at: (value.high / DAMAGE_END_SCALE).try_into().unwrap(),
        }
    }
}
#[derive(Copy, Drop, Serde, Default, Debug, PartialEq)]
pub struct Troops {
    pub category: TroopType,
    pub tier: TroopTier,
    pub count: u128,
    pub stamina: StaminaSource,
    pub boosts: TroopBoosts,
    pub battle_cooldown_end: u32,
}
// Counts and combat flags share one word without narrowing either field.
#[derive(Copy, Drop, starknet::Store)]
pub struct PackedTroops {
    pub count_and_combat: felt252,
    pub stamina: felt252,
    pub boosts: felt252,
}
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
            count_and_combat: u256 {
                low: value.count,
                high: (Into::<u8, u64>::into(category)
                    + tier * TIER_SCALE
                    + Into::<u32, u64>::into(value.battle_cooldown_end) * COOLDOWN_SCALE)
                    .into(),
            }
                .try_into()
                .unwrap(),
            stamina: match value.stamina {
                StaminaSource::Inline(bar) => StaminaPacking::pack(bar).into(),
                StaminaSource::Slot(slot) => u256 { low: slot.into(), high: 1 }.try_into().unwrap(),
            },
            boosts: TroopBoostsPacking::pack(value.boosts),
        }
    }
    fn unpack(value: PackedTroops) -> Troops {
        let count_and_combat: u256 = value.count_and_combat.into();
        let combat: u64 = count_and_combat.high.try_into().expect('invalid stored combat');
        let category = match combat % TIER_SCALE {
            0 => TroopType::Knight,
            1 => TroopType::Paladin,
            2 => TroopType::Crossbowman,
            _ => panic!("invalid stored troop type"),
        };
        let tier = match combat / TIER_SCALE % TIER_SCALE {
            0 => TroopTier::T1,
            1 => TroopTier::T2,
            2 => TroopTier::T3,
            _ => panic!("invalid stored troop tier"),
        };
        Troops {
            category,
            tier,
            count: count_and_combat.low,
            stamina: {
                let packed: u256 = value.stamina.into();
                match packed.high {
                    0 => StaminaSource::Inline(StaminaPacking::unpack(packed.low)),
                    1 => StaminaSource::Slot(packed.low.try_into().expect('invalid stamina slot')),
                    _ => panic!("invalid stamina source"),
                }
            },
            boosts: TroopBoostsPacking::unpack(value.boosts),
            battle_cooldown_end: (combat / COOLDOWN_SCALE).try_into().unwrap(),
        }
    }
}
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct ExplorerKey {
    pub game_id: u32,
    pub explorer_id: u64,
}
#[derive(Copy, Drop, Serde, Default, Debug, PartialEq, starknet::Store)]
pub struct ExplorerRecord {
    pub owner: u64,
    pub troops: Troops,
}

// Views join troop facts with the canonical spatial record; coordinates are never stored here.
#[derive(Copy, Drop, Serde, Default, Debug, PartialEq)]
pub struct ExplorerTroops {
    pub owner: u64,
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
    pub attacker_id: u64,
    #[key]
    pub defender_id: u64,
    #[key]
    pub attacker_owner: u64,
    #[key]
    pub defender_owner: u64,
    pub winner_id: u64,
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
/// The realm resource that stocks troops of this category and tier.
pub fn stock_resource(category: TroopType, tier: TroopTier) -> u8 {
    troop_resource(category, match tier {
        TroopTier::T1 => 0,
        TroopTier::T2 => 1,
        TroopTier::T3 => 2,
    })
}
pub(crate) fn explorer_occupier(explorer: ExplorerTroops) -> u8 {
    troop_occupier(explorer.troops)
}

pub(crate) fn troop_occupier(troops: Troops) -> u8 {
    let category = match troops.category {
        TroopType::Knight => crate::taxonomy::EXPLORER_KNIGHT_T1_OCCUPIER,
        TroopType::Paladin => crate::taxonomy::EXPLORER_PALADIN_T1_OCCUPIER,
        TroopType::Crossbowman => crate::taxonomy::EXPLORER_CROSSBOWMAN_T1_OCCUPIER,
    };
    let tier = match troops.tier {
        TroopTier::T1 => 0,
        TroopTier::T2 => 1,
        TroopTier::T3 => 2,
    };
    category + tier
}
pub fn deployment_cap(config: crate::rules::TroopLimitConfig, level: u8) -> u32 {
    match level {
        0 => config.settlement_deployment_cap,
        1 => config.city_deployment_cap,
        2 => config.kingdom_deployment_cap,
        3 => config.empire_deployment_cap,
        _ => panic!("invalid structure level"),
    }
}

pub fn max_army_size(config: crate::rules::TroopLimitConfig, level: u8, tier: TroopTier) -> u32 {
    let cap = deployment_cap(config, level);
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
            rules.tick_config.armies_tick_in_seconds,
            timestamp,
            true,
        );
}

pub(crate) fn discovery_guards(
    category: u8, seed: u256, rules: crate::rules::SliceRules, timestamp: u64,
) -> Span<Troops> {
    use crate::troops::{TroopTier, TroopType};
    let light_guard = category == crate::taxonomy::MINE_CATEGORY || category == crate::taxonomy::CAMP_CATEGORY;
    let limits = rules.troop_limit_config;
    let (lower, upper) = if light_guard {
        (limits.light_guard_lower_bound, limits.light_guard_upper_bound)
    } else {
        (limits.heavy_guard_lower_bound, limits.heavy_guard_upper_bound)
    };
    let lower: u128 = lower.into();
    let upper: u128 = upper.into();
    let three_guards = category == crate::taxonomy::HYPERSTRUCTURE_CATEGORY
        || category == crate::taxonomy::BANK_CATEGORY;
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
        let count = lower + crate::random::range(guard_seed, 1, upper - lower + 1);
        let troops = discovered_guard(category, tier, count, rules, timestamp);
        guards.append(troops);
    }
    guards.span()
}

// Camps, rifts and ruins are guarded by Knight beasts. Only stragglers draw among the three troop categories and
// keep a third of the site grid draw.
pub(crate) fn frontier_guard(
    category: u8, depth: crate::expeditions::DepthRules, seed: u256, rules: crate::rules::SliceRules, timestamp: u64,
) -> Troops {
    let (troop, lower, upper) = if category == crate::taxonomy::RUIN_CATEGORY {
        (TroopType::Knight, depth.ruin_guard_lower, depth.ruin_guard_upper)
    } else {
        let troop = if category == crate::taxonomy::STRAGGLERS_CATEGORY {
            match crate::random::range(seed, 2, 3) {
                0 => TroopType::Knight,
                1 => TroopType::Paladin,
                _ => TroopType::Crossbowman,
            }
        } else {
            TroopType::Knight
        };
        (troop, depth.site_guard_lower.into(), depth.site_guard_upper.into())
    };
    let step: u128 = depth.guard_step.into();
    let lower: u128 = lower.into();
    let upper: u128 = upper.into();
    // Preset validation makes both inclusive endpoints reachable on the grid.
    let count = lower + step * crate::random::range(seed, 1, (upper - lower) / step + 1);
    let count = if category == crate::taxonomy::STRAGGLERS_CATEGORY {
        count / 3
    } else {
        count
    };
    discovered_guard(troop, TroopTier::T1, count, rules, timestamp)
}

fn discovered_guard(
    category: TroopType, tier: TroopTier, count: u128, rules: crate::rules::SliceRules, timestamp: u64,
) -> Troops {
    Troops {
        category,
        tier,
        count: count * crate::rules::RESOURCE_PRECISION,
        stamina: crate::troops::Stamina { amount: 0, settled_at: timestamp.try_into().unwrap(), remainder: 0 }.into(),
        boosts: Default::default(),
        battle_cooldown_end: 0,
    }
}

#[starknet::interface]
pub trait IBattleResolution<T> {
    // The explorer a command acts with: active this day, and owned by the actor when one is given.
    fn command_explorer(
        self: @T,
        key: ExplorerKey,
        actor: Option<starknet::ContractAddress>,
        game_context: crate::commands::ActionContext,
    ) -> ExplorerTroops;
    fn finish_battle(
        ref self: T,
        key: ExplorerKey,
        explorer: ExplorerTroops,
        before: u128,
        game_context: crate::commands::ActionContext,
    );
}

#[derive(Copy, Drop, Serde)]
pub struct ArmySlotAllocation {
    pub home: u64,
    pub epoch: u64,
    pub allowance: u8,
    pub initial: Stamina,
    pub category: TroopType,
    pub stamina_config: crate::rules::TroopStaminaConfig,
}
// A slot's bar refills to the command's time by the rules the command carries.
#[derive(Copy, Drop, Serde)]
pub struct StaminaRefill {
    pub timestamp: u64,
    pub stamina_config: crate::rules::TroopStaminaConfig,
    pub armies_tick_in_seconds: u64,
}
#[derive(Copy, Drop, Serde)]
pub enum ArmySlotAction {
    Resolve: Option<StaminaRefill>,
    Allocate: ArmySlotAllocation,
    Persist: StaminaSource,
    Release: StaminaSource,
}
#[derive(Copy, Drop, Serde)]
pub struct ResolvedArmySlot {
    pub stamina: StaminaSource,
    // In basis points, the unit of every damage boost; the name predates that and is part of the declared schema.
    pub battle_bonus_percent: u16,
}
#[starknet::interface]
pub trait IArmySlotStamina<T> {
    fn army_slot_stamina(ref self: T, key: ExplorerKey, action: ArmySlotAction) -> ResolvedArmySlot;
}
