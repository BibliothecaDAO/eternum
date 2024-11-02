use eternum::utils::tasks::interface::TaskTrait;

impl Squire of TaskTrait {
    #[inline]
    fn identifier() -> felt252 {
        'SQUIRE'
    }

    #[inline]
    fn description(difficulty: u8, count: u32) -> ByteArray {
        "Complete the quests"
    }
}
