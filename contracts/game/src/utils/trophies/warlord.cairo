use achievement::types::task::Task as BushidoTask;
use s1_eternum::utils::tasks::index::{Task, TaskImpl};
use s1_eternum::utils::trophies::interface::TrophyTrait;

pub impl Warlord of TrophyTrait {
    #[inline]
    fn identifier(level: u8) -> felt252 {
        'WARLORD'
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
        100
    }

    #[inline]
    fn group() -> felt252 {
        'Warlord'
    }

    #[inline]
    fn title(level: u8) -> felt252 {
        'Warlord'
    }

    #[inline]
    fn description(level: u8) -> ByteArray {
        "There are no shortcuts to victory"
    }

    #[inline]
    fn icon(level: u8) -> felt252 {
        'fa-axe-battle'
    }

    #[inline]
    fn tasks(level: u8) -> Span<BushidoTask> {
        let count: u32 = 1;
        Task::Warlord.tasks(count)
    }
}
