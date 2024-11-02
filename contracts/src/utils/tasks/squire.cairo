use eternum::utils::tasks::interface::TaskTrait;

impl Squire of TaskTrait {
    #[inline]
    fn identifier() -> felt252 {
        'SQUIRE'
    }

    #[inline]
    fn description(count: u32) -> ByteArray {
        "Complete the quests"
    }
}
