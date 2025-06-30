use core::num::traits::Bounded;
use core::num::traits::zero::Zero;
use dojo::model::{ModelStorage};
use dojo::world::WorldStorage;
use s1_eternum::alias::ID;
use s1_eternum::constants::{RELICS_RESOURCE_START_ID};
use s1_eternum::models::resource::resource::RelicResourceImpl;

pub mod RELIC_EFFECT {
    use s1_eternum::constants::{RELICS_RESOURCE_START_ID};

    pub const INCREASE_STAMINA_REGENERATION_100P_3D: u8 = RELICS_RESOURCE_START_ID + 0;
    pub const INCREASE_DAMAGE_30P_3D: u8 = RELICS_RESOURCE_START_ID + 1;
    pub const REDUCE_DAMAGE_30P_3D: u8 = RELICS_RESOURCE_START_ID + 2;
    pub const INSTANT_EXPLORE_1TILE: u8 = RELICS_RESOURCE_START_ID + 3;
    pub const INSTANT_EXPLORE_2TILE: u8 = RELICS_RESOURCE_START_ID + 4;
    pub const INCREASE_EXPLORATION_REWARDS_100P_3D: u8 = RELICS_RESOURCE_START_ID + 5;
    pub const INCREASE_RESOURCE_PRODUCTION_30P_3D: u8 = RELICS_RESOURCE_START_ID + 6;
    pub const INCREASE_LABOR_PRODUCTION_20P_8D: u8 = RELICS_RESOURCE_START_ID + 7;
    pub const INCREASE_TROOP_PRODUCTION_20P_8D: u8 = RELICS_RESOURCE_START_ID + 8;
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
        ref world: WorldStorage, entity_id: ID, relic_resource_id: u8, current_tick: u64,
    ) -> Option<RelicEffect> {
        let relic_effect: RelicEffect = world.read_model((entity_id, relic_resource_id));
        return relic_effect.delete_expired(ref world, current_tick.try_into().unwrap());
    }

    fn store(self: RelicEffect, ref world: WorldStorage, current_tick: u32) {
        match self.delete_expired(ref world, current_tick) {
            Option::Some(relic_effect) => world.write_model(@relic_effect),
            Option::None => (),
        }
    }

    fn reduce_usage_left(ref self: RelicEffect, ref world: WorldStorage, current_tick: u32) {
        if self.effect_usage_left != Bounded::MAX {
            self.effect_usage_left -= 1;
        }
        self.store(ref world, current_tick);
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
            // E1: increase stamina regeneration by 100% for 3 Eternum Days
            0 => (10_000, 3, Bounded::MAX),
            // E2: increase damage by 30% for 3 Eternum Days
            1 => (3_000, 3, Bounded::MAX),
            // E3: reduce damage taken by 30% for 3 Eternum Days
            2 => (3_000, 3, Bounded::MAX),
            // E4: instantly explore 1 tile radius
            3 => (0, 0, 1),
            // E5: instantly explore 2 tile radius
            4 => (0, 0, 1),
            // E6: increase exploration reward by 100% for 3 Eternum Days
            5 => (10_000, 3, Bounded::MAX),
            // E7: increase resource production by 30% for 3 Eternum Days
            6 => (3_000, 3, Bounded::MAX),
            // E8: increase labor production by 20% for 8 Eternum Days
            7 => (2_000, 8, Bounded::MAX),
            // E9: increase troop production by 20% for 8 Eternum Days
            8 => (2_000, 8, Bounded::MAX),
            _ => {
                panic!("Invalid relic resource id");
                (0, 0, 0)
            },
        }
    }
}

