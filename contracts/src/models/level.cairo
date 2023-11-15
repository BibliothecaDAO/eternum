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
            // level down
            if self.level == 0 {
                0
            } else {
                self.level - 1
            }
        } else {
            self.level
        }
    }
}