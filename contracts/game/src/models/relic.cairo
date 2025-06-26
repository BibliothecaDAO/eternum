use core::num::traits::Bounded;
use core::num::traits::zero::Zero;
use dojo::model::{ModelStorage};
use dojo::world::WorldStorage;
use s1_eternum::alias::ID;
use s1_eternum::constants::{RELICS_RESOURCE_START_ID};
use s1_eternum::models::resource::resource::RelicResourceImpl;

mod RELIC_EFFECT {
    pub const INCREASE_STAMINA_REGENERATION_100P_3D: u8 = 0;
    pub const INCREASE_STAMINA_REGENERATION_200P_3D: u8 = 1;
    pub const INCREASE_DAMAGE_20P_3D: u8 = 2;
    pub const INCREASE_DAMAGE_40P_3D: u8 = 3;
    pub const REDUCE_DAMAGE_20P_3D: u8 = 4;
    pub const REDUCE_DAMAGE_40P_3D: u8 = 5;
    pub const INSTANT_EXPLORE_1TILE: u8 = 6;
    pub const INSTANT_EXPLORE_2TILE: u8 = 7;
    pub const DOUBLE_EXPLORATION_REWARDS_3D: u8 = 8;
    pub const TRIPLE_EXPLORATION_REWARDS_3D: u8 = 9;
    pub const REDUCE_DAMAGE_15P_6D: u8 = 10;
    pub const REDUCE_DAMAGE_30P_6D: u8 = 11;
    pub const INCREASE_RESOURCE_PRODUCTION_20P_3D: u8 = 12;
    pub const INCREASE_RESOURCE_PRODUCTION_40P_3D: u8 = 13;
    pub const INCREASE_LABOR_PRODUCTION_20P_6D: u8 = 14;
    pub const INCREASE_LABOR_PRODUCTION_20P_12D: u8 = 15;
    pub const INCREASE_TROOP_PRODUCTION_20P_6D: u8 = 16;
    pub const INCREASE_TROOP_PRODUCTION_20P_12D: u8 = 17;
}

#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct RelicEffect {
    #[key]
    pub entity_id: ID,
    #[key]
    pub effect_resource_id: u8,
    pub effect_rate: u16,
    pub effect_start_tick: u32,
    pub effect_end_tick: u32,
    pub effect_usage_left: u8,
}

#[generate_trait]
pub impl RelicEffectStoreImpl of RelicEffectStoreTrait {
    fn retrieve(
        ref world: WorldStorage, entity_id: ID, relic_resource_id: u8, current_tick: u32,
    ) -> Option<RelicEffect> {
        let relic_effect: RelicEffect = world.read_model((entity_id, relic_resource_id));
        return relic_effect.delete_expired(ref world, current_tick);
    }

    fn store(self: RelicEffect, ref world: WorldStorage, current_tick: u32) {
        match self.delete_expired(ref world, current_tick) {
            Option::Some(relic_effect) => world.write_model(@relic_effect),
            Option::None => (),
        }
    }

    fn reduce_usage_left(ref self: RelicEffect) {
        if self.effect_usage_left != Bounded::MAX {
            self.effect_usage_left -= 1;
        }
    }

    fn is_expired(self: RelicEffect, current_tick: u32) -> bool {
        return current_tick > self.effect_end_tick || self.effect_usage_left.is_zero();
    }

    fn assert_not_expired(self: RelicEffect, current_tick: u32) {
        assert!(self.is_expired(current_tick), "Eternum: Relic effect has expired");
    }

    fn delete_expired(self: RelicEffect, ref world: WorldStorage, current_tick: u32) -> Option<RelicEffect> {
        if self.is_expired(current_tick) {
            // delete from db
            world.erase_model(@self);
            return Option::None;
        }
        return Option::Some(self);
    }
}

#[generate_trait]
pub impl RelicEffectObjectImpl of RelicEffectObjectTrait {
    fn create_relic_effect(entity_id: ID, relic_resource_id: u8, start_tick: u32) -> RelicEffect {
        let (rate, duration, usage_left) = Self::get_relic_effect(relic_resource_id, start_tick);
        RelicEffect {
            entity_id: entity_id,
            effect_resource_id: relic_resource_id,
            effect_rate: rate,
            effect_start_tick: start_tick,
            effect_end_tick: start_tick + duration,
            effect_usage_left: usage_left,
        }
    }

    fn get_relic_effect(relic_resource_id: u8, start_tick: u32) -> (u16, u32, u8) {
        assert!(RelicResourceImpl::is_relic(relic_resource_id), "Eternum: Invalid relic resource id");

        let id: felt252 = (relic_resource_id - RELICS_RESOURCE_START_ID).into();
        match id {
            // E1: increase stamina regeneration by 50% for 3 Eternum Days
            0 => (5_000, 3, Bounded::MAX),
            // E2: increase stamina regeneration by 100% for 3 Eternum Days
            1 => (10_000, 3, Bounded::MAX),
            // E3: increase damage by 20% for 3 Eternum Days
            2 => (2_000, 3, Bounded::MAX),
            // E4: increase damage by 40% for 3 Eternum Days
            3 => (4_000, 3, Bounded::MAX),
            // E5: reduce damage taken by 20% for 3 Eternum Days
            4 => (2_000, 3, Bounded::MAX),
            // E6: reduce damage taken by 40% for 3 Eternum Days
            5 => (4_000, 3, Bounded::MAX),
            // E7: instantly explores a one-tile radius
            6 => (0, 0, 1),
            // E8: instantly explores a two-tile radius
            7 => (0, 0, 1),
            // E9: double all exploration rewards for 3 Eternum Days
            8 => (20_000, 3, Bounded::MAX),
            // E10: triple all exploration rewards for 3 Eternum Days
            9 => (30_000, 3, Bounded::MAX),
            // E11: reduce damage taken by all guard armies by 15% for 6 Eternum Days
            10 => (1_500, 6, Bounded::MAX),
            // E12: reduce damage taken by all guard armies by 30% for 6 Eternum Days
            11 => (3_000, 6, Bounded::MAX),
            // E13: increase resource production rate by 20% for 3 Eternum Days
            12 => (2_000, 3, Bounded::MAX),
            // E14: increase resource production rate by 40% for 3 Eternum Days
            13 => (4_000, 3, Bounded::MAX),
            // E15: increase labor production rate by 20% for 6 Eternum Days
            14 => (2_000, 6, Bounded::MAX),
            // E16: increase labor production rate by 20% for 12 Eternum Days
            15 => (2_000, 12, Bounded::MAX),
            // E17: increase troop production rate by 20% for 6 Eternum Days
            16 => (2_000, 6, Bounded::MAX),
            // E18: increase troop production rate by 20% for 12 Eternum Days
            17 => (2_000, 12, Bounded::MAX),
            _ => {
                panic!("Invalid relic resource id");
                (0, 0, 0)
            },
        }
    }
}

