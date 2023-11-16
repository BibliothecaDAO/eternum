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
}


#[cfg(test)]
mod tests {
    use super::{Level, LevelTrait};

    #[test]
    #[available_gas(30000000)]
    fn test_get_level() {

        // set level
        let level = Level { entity_id: 1, level: 3, valid_until: 1000};

        let currentLevel = level.get_level();
        assert(currentLevel == 3, 'level not good 1');

        // update block timestamp
        // go 1 week in the future
        starknet::testing::set_block_timestamp(2000);

        let currentLevel = level.get_level();
        assert(currentLevel == 2, 'level not good 2');

        // update block timestamp
        // go 2 weeks in the future
        starknet::testing::set_block_timestamp(700000);

        let currentLevel = level.get_level();
        assert(currentLevel == 1, 'level not good 3');

        // go more than 3 weeks in the future
        starknet::testing::set_block_timestamp(1400000);

        let currentLevel = level.get_level();
        assert(currentLevel == 0, 'level not good 4');
    }
}