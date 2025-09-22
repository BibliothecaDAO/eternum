use achievement::types::task::Task as BushidoTask;
use s1_eternum::utils::tasks::index::{Task, TaskImpl};
use s1_eternum::utils::trophies::interface::TrophyTrait;

pub impl Squire of TrophyTrait {
    #[inline]
    fn identifier(level: u8) -> felt252 {
        'SQUIRE'
    }

    #[inline]
    fn hidden(level: u8) -> bool {
        false
    }

    #[inline]
    fn index(level: u8) -> u8 {
        level
    }

    #[inline]
    fn points(level: u8) -> u16 {
        10
    }

    #[inline]
    fn group() -> felt252 {
        'Squire'
    }

    #[inline]
    fn icon(level: u8) -> felt252 {
        'fa-seedling'
    }

    #[inline]
    fn title(level: u8) -> felt252 {
        'Squire'
    }

    #[inline]
    fn description(level: u8) -> ByteArray {
        "Every journey begins with a single step"
    }

    #[inline]
    fn tasks(level: u8) -> Span<BushidoTask> {
        let count: u32 = 1;
        Task::Squire.tasks(count)
    }
}
