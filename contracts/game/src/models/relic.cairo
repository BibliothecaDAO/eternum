use s1_eternum::alias::ID;
use s1_eternum::constants::{RELICS_RESOURCE_START_ID};
use s1_eternum::models::resource::resource::RelicResourceImpl;

pub mod RELIC_EFFECT {
    use s1_eternum::constants::{RELICS_RESOURCE_START_ID};

    pub const EXPLORER_INCREASE_STAMINA_REGENERATION_50P_3D: u8 = RELICS_RESOURCE_START_ID + 0;
    pub const EXPLORER_INCREASE_STAMINA_REGENERATION_100P_3D: u8 = RELICS_RESOURCE_START_ID + 1;
    pub const EXPLORER_INCREASE_ATTACK_DAMAGE_20P_3D: u8 = RELICS_RESOURCE_START_ID + 2;
    pub const EXPLORER_INCREASE_ATTACK_DAMAGE_40P_3D: u8 = RELICS_RESOURCE_START_ID + 3;
    pub const EXPLORER_REDUCE_ENEMY_ATTACK_DAMAGE_20P_3D: u8 = RELICS_RESOURCE_START_ID + 4;
    pub const EXPLORER_REDUCE_ENEMY_ATTACK_DAMAGE_40P_3D: u8 = RELICS_RESOURCE_START_ID + 5;
    pub const EXPLORER_INSTANTLY_EXPLORE_ONE_TILE_RADIUS: u8 = RELICS_RESOURCE_START_ID + 6;
    pub const EXPLORER_INSTANTLY_EXPLORE_TWO_TILE_RADIUS: u8 = RELICS_RESOURCE_START_ID + 7;
    pub const EXPLORER_DOUBLE_EXPLORE_REWARD: u8 = RELICS_RESOURCE_START_ID + 8;
    pub const EXPLORER_TRIPLE_EXPLORE_REWARD: u8 = RELICS_RESOURCE_START_ID + 9;
    pub const STRUCTURE_GUARD_REDUCE_ENEMY_ATTACK_DAMAGE_15P_6D: u8 = RELICS_RESOURCE_START_ID + 10;
    pub const STRUCTURE_GUARD_REDUCE_ENEMY_ATTACK_DAMAGE_30P_6D: u8 = RELICS_RESOURCE_START_ID + 11;
    pub const STRUCTURE_RESOURCE_PRODUCTION_INCREASE_20P_3D: u8 = RELICS_RESOURCE_START_ID + 12;
    pub const STRUCTURE_RESOURCE_PRODUCTION_INCREASE_40P_3D: u8 = RELICS_RESOURCE_START_ID + 13;
    pub const STRUCTURE_LABOR_PRODUCTION_INCREASE_20P_6D: u8 = RELICS_RESOURCE_START_ID + 14;
    pub const STRUCTURE_LABOR_PRODUCTION_INCREASE_20P_12D: u8 = RELICS_RESOURCE_START_ID + 15;
    pub const STRUCTURE_TROOP_PRODUCTION_INCREASE_20P_6D: u8 = RELICS_RESOURCE_START_ID + 16;
    pub const STRUCTURE_TROOP_PRODUCTION_INCREASE_20P_12D: u8 = RELICS_RESOURCE_START_ID + 17;
}


#[generate_trait]
pub impl RelicEffectImpl of RelicEffectTrait {
    // Return (rate%, tick_duration, usage_left)
    fn get_relic_effect(relic_resource_id: u8) -> (u16, u32, u8) {
        assert!(RelicResourceImpl::is_relic(relic_resource_id), "Eternum: Invalid relic resource id");
        let id: felt252 = (relic_resource_id - RELICS_RESOURCE_START_ID).into();
        match id {
            // E1: increase explorer stamina regeneration by 50% for 3 Eternum Days
            0 => (5_000, 0, 3),
            // E2: increase explorer stamina regeneration by 100% for 3 Eternum Days
            1 => (10_000, 0, 3),
            // E3: increase explorer attack damage by 20% for 3 Eternum Days
            2 => (2_000, 3, 0),
            // E4: increase explorer attack damage by 40% for 3 Eternum Days
            3 => (4_000, 3, 0),
            // E5: reduce enemy attack damage by 20% for 3 Eternum Days
            4 => (2_000, 3, 0),
            // E6: reduce enemy attack damage by 40% for 3 Eternum Days
            5 => (4_000, 3, 0),
            // E7: instantly explore 1 tile radius
            6 => (0, 0, 1),
            // E8: instantly explore 2 tile radius
            7 => (0, 0, 2),
            // E9: double explore reward for 3 Eternum Days
            8 => (10_000, 3, 0),
            // E10: triple explore reward for 3 Eternum Days
            9 => (20_000, 3, 0),
            // E11: reduce guard attack damage by 15% for 6 Eternum Days
            10 => (1_500, 6, 0),
            // E12: reduce guard attack damage by 30% for 6 Eternum Days
            11 => (3_000, 6, 0),
            // E13: increase structure resource production by 20% for 3 Eternum Days
            12 => (2_000, 3, 0),
            // E14: increase structure resource production by 40% for 3 Eternum Days
            13 => (4_000, 3, 0),
            // E15: increase structure labor production by 20% for 6 Eternum Days
            14 => (2_000, 6, 0),
            // E16: increase structure labor production by 20% for 12 Eternum Days
            15 => (2_000, 12, 0),
            // E17: increase structure troop production by 20% for 6 Eternum Days
            16 => (2_000, 6, 0),
            // E18: increase structure troop production by 20% for 12 Eternum Days
            17 => (2_000, 12, 0),
            _ => {
                panic!("Invalid relic resource id");
                (0, 0, 0)
            },
        }
    }
}

