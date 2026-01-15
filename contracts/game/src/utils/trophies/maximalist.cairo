use achievement::types::task::Task as BushidoTask;
use crate::utils::tasks::index::{Task, TaskImpl};
use crate::utils::trophies::interface::TrophyTrait;

pub impl Maximalist of TrophyTrait {
    #[inline]
    fn identifier(level: u8) -> felt252 {
        'MAXIMALIST'
    }

    #[inline]
    fn hidden(level: u8) -> bool {
        true
    }

    #[inline]
    fn index(level: u8) -> u8 {
        level
    }

    #[inline]
    fn points(level: u8) -> u16 {
        90
    }

    #[inline]
    fn group() -> felt252 {
        'Maximalist'
    }

    #[inline]
    fn icon(level: u8) -> felt252 {
        'fa-castle'
    }

    #[inline]
    fn title(level: u8) -> felt252 {
        'Maximalist'
    }

    #[inline]
    fn description(level: u8) -> ByteArray {
        "The sky is the limit, but why stop there?"
    }

    #[inline]
    fn tasks(level: u8) -> Span<BushidoTask> {
        let count: u32 = 1;
        Task::Maximalist.tasks(count)
    }
}
