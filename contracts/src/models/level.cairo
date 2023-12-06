use cubit::f128::math::core::{pow as fixed_pow};
use cubit::f128::types::fixed::{Fixed, FixedTrait};
use eternum::models::config::{LevelingConfig};
use eternum::constants::{LevelIndex};
use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
use eternum::models::resources::{ResourceCost};

#[derive(Model, Copy, Drop, Serde)]
struct Level {
    #[key]
    entity_id: u128,
    level: u64,
    valid_until: u64,
}

#[generate_trait]
impl LevelImpl of LevelTrait {
    fn get_level(self: Level) -> u64 {
        let ts: u64 = starknet::get_block_timestamp();
        if self.valid_until <= ts {
            let time_passed = ts - self.valid_until;
            // how many weeks have passed
            let downgrade_levels = (time_passed / 604800) + 1;
            if (downgrade_levels >= self.level) {
                0
            } else {
                self.level - downgrade_levels
            }
        } else {
            self.level
        }
    }

    fn get_multiplier(leveling_config: LevelingConfig, tier: u64) -> u128 {
        let decay_fixed = FixedTrait::new(leveling_config.decay_scaled, false);
        let tier_fixed = FixedTrait::new_unscaled(tier.into(), false);
        let base_multiplier_fixed = FixedTrait::new_unscaled(leveling_config.base_multiplier, false);
        let nom = FixedTrait::ONE() - fixed_pow(FixedTrait::ONE() - decay_fixed, tier_fixed);
        let denom = decay_fixed;
        (base_multiplier_fixed * (nom / denom)).try_into().unwrap()
    }

    fn get_index_multiplier(self: Level, leveling_config: LevelingConfig, index: u8, start_tier: u64) -> u128 {
        let current_level = self.get_level();

        if current_level < start_tier * 4 + 1 {
            100
        } else {
            let mut tier = if ((current_level % 4) >= index.into()) {
                current_level / 4 + 1
            } else {
                current_level / 4
            };

            let multiplier = LevelTrait::get_multiplier(leveling_config, tier - start_tier);
            
            multiplier + 100
        }    
    }

    fn get_cost_multiplier(self: Level, cost_percentage_scaled: u128) -> u128 {
        let next_tier = (self.get_level() / 4) + 1;
        let cost_percentage = FixedTrait::new(cost_percentage_scaled, false);
        if next_tier == 1 {
            return 100;
        } else {
            let coefficient = fixed_pow(cost_percentage + FixedTrait::ONE(), FixedTrait::new_unscaled((next_tier - 1).into(), false));
            (coefficient * FixedTrait::new_unscaled(100, false)).try_into().unwrap()
        }
    }
}


#[cfg(test)]
mod tests {
    use super::{Level, LevelTrait};
    use eternum::models::config::{LevelingConfig};
    use eternum::constants::{LevelIndex, REALM_LEVELING_START_TIER, HYPERSTRUCTURE_LEVELING_START_TIER};

    #[test]
    #[available_gas(30000000)]
    fn test_get_level() {

        // set level
        let level = Level { entity_id: 1, level: 3, valid_until: 1000};

        let current_level = level.get_level();
        assert(current_level == 3, 'level not good 1');

        // update block timestamp
        // go 1 week in the future
        starknet::testing::set_block_timestamp(2000);

        let current_level = level.get_level();
        assert(current_level == 2, 'level not good 2');

        // update block timestamp
        // go 2 weeks in the future
        starknet::testing::set_block_timestamp(700000);

        let current_level = level.get_level();
        assert(current_level == 1, 'level not good 3');

        // go more than 3 weeks in the future
        starknet::testing::set_block_timestamp(1400000);

        let current_level = level.get_level();
        assert(current_level == 0, 'level not good 4');
    }

    #[test]
    #[available_gas(30000000)]
    fn test_get_multiplier() {

        let leveling_config = LevelingConfig {
            config_id: 0,
            decay_interval: 604800,
            max_level: 1000,
            wheat_base_amount: 0,
            fish_base_amount: 0,
            resource_1_cost_id: 0,
            resource_1_cost_count: 0,
            resource_2_cost_id: 0,
            resource_2_cost_count: 0,
            resource_3_cost_id: 0,
            resource_3_cost_count: 0,
            decay_scaled: 1844674407370955161,
            base_multiplier: 25,
            cost_percentage_scaled: 4611686018427387904
        };

        // tier 2
        let level_multiplier = LevelTrait::get_multiplier(leveling_config, 2);
        assert(level_multiplier == 47, 'wrong multiplier');

        // tier 40
        let level_multiplier = LevelTrait::get_multiplier(leveling_config, 40);
        assert(level_multiplier == 246, 'wrong multi');

        // tier 100
        let level_multiplier = LevelTrait::get_multiplier(leveling_config, 100);
        assert(level_multiplier == 249, 'wrong multi');
    }

    #[test]
    #[available_gas(30000000)]
    fn test_get_index_multiplier_for_realm() {

        let leveling_config = LevelingConfig {
            config_id: 0,
            decay_interval: 604800,
            max_level: 1000,
            wheat_base_amount: 0,
            fish_base_amount: 0,
            resource_1_cost_id: 0,
            resource_1_cost_count: 0,
            resource_2_cost_id: 0,
            resource_2_cost_count: 0,
            resource_3_cost_id: 0,
            resource_3_cost_count: 0,
            decay_scaled: 1844674407370955161,
            base_multiplier: 25,
            cost_percentage_scaled: 4611686018427387904
        };

        // set level 
        // tier 1
        let level = Level { entity_id: 1, level: 1, valid_until: 1000};
        let multiplier = level.get_index_multiplier(leveling_config, LevelIndex::FOOD, REALM_LEVELING_START_TIER);
        assert(multiplier == 100, 'wrong multiplier');

        // tier 2
        let level = Level { entity_id: 1, level: 6, valid_until: 1000};
        let multiplier = level.get_index_multiplier(leveling_config, LevelIndex::FOOD, REALM_LEVELING_START_TIER);
        assert(multiplier == 125, 'wrong multiplier');

        // tier 2
        let level = Level { entity_id: 1, level: 6, valid_until: 1000};
        let multiplier = level.get_index_multiplier(leveling_config, LevelIndex::COMBAT, REALM_LEVELING_START_TIER);
        assert(multiplier == 100, 'wrong multiplier');

        // tier 2
        let level = Level { entity_id: 1, level: 8, valid_until: 1000};
        let multiplier = level.get_index_multiplier(leveling_config, LevelIndex::COMBAT, REALM_LEVELING_START_TIER);
        assert(multiplier == 125, 'wrong multiplier');

        // tier 11
        let level = Level { entity_id: 1, level: 43, valid_until: 1000};
        let multiplier = level.get_index_multiplier(leveling_config, LevelIndex::FOOD, REALM_LEVELING_START_TIER);
        assert(multiplier == 262, 'wrong multiplier');
    }


    #[test]
    #[available_gas(30000000)]
    fn test_get_index_multiplier_for_hyperstructure() {

        let leveling_config = LevelingConfig {
            config_id: 0,
            decay_interval: 604800,
            max_level: 1000,
            wheat_base_amount: 0,
            fish_base_amount: 0,
            resource_1_cost_id: 0,
            resource_1_cost_count: 0,
            resource_2_cost_id: 0,
            resource_2_cost_count: 0,
            resource_3_cost_id: 0,
            resource_3_cost_count: 0,
            decay_scaled: 1844674407370955161,
            base_multiplier: 25,
            cost_percentage_scaled: 4611686018427387904
        };

        // set level 
        // tier 1
        let level = Level { entity_id: 1, level: 0, valid_until: 1000};
        let multiplier = level.get_index_multiplier(leveling_config, LevelIndex::FOOD, HYPERSTRUCTURE_LEVELING_START_TIER);
        assert(multiplier == 100, 'wrong multiplier');

        // tier 2
        let level = Level { entity_id: 1, level: 2, valid_until: 1000};
        let multiplier = level.get_index_multiplier(leveling_config, LevelIndex::FOOD, HYPERSTRUCTURE_LEVELING_START_TIER);
        assert(multiplier == 125, 'wrong multiplier');

        // tier 2
        let level = Level { entity_id: 1, level: 2, valid_until: 1000};
        let multiplier = level.get_index_multiplier(leveling_config, LevelIndex::COMBAT, HYPERSTRUCTURE_LEVELING_START_TIER);
        assert(multiplier == 100, 'wrong multiplier');

        // tier 2
        let level = Level { entity_id: 1, level: 4, valid_until: 1000};
        let multiplier = level.get_index_multiplier(leveling_config, LevelIndex::COMBAT, HYPERSTRUCTURE_LEVELING_START_TIER);
        assert(multiplier == 125, 'wrong multiplier');

        // tier 11
        let level = Level { entity_id: 1, level: 39, valid_until: 1000};
        let multiplier = level.get_index_multiplier(leveling_config, LevelIndex::FOOD, HYPERSTRUCTURE_LEVELING_START_TIER);
        assert(multiplier == 262, 'wrong multiplier');
    }

    #[test]
    #[available_gas(30000000)]
    fn test_get_cost_multiplier() {
        let level = Level { entity_id: 1, level: 9, valid_until: 1000};

        // 25% increase each tier
        let cost_multiplier = level.get_cost_multiplier(4611686018427387904);

        assert(cost_multiplier == 156, 'wrong cost_multiplier')
    }
}