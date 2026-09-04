use crate::utils::tasks::interface::TaskTrait;

pub impl Squire of TaskTrait {
    #[inline]
    fn identifier() -> felt252 {
        'SQUIRE'
    }

    #[inline]
    fn description(count: u32) -> ByteArray {
        "Complete the quests"
    }
}
