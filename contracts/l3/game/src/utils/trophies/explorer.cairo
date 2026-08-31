use achievement::types::task::Task as BushidoTask;
use crate::utils::tasks::index::{Task, TaskImpl};
use crate::utils::trophies::interface::TrophyTrait;

pub impl Explorer of TrophyTrait {
    #[inline]
    fn identifier(level: u8) -> felt252 {
        match level {
            0 => 'EXPLORER_I',
            1 => 'EXPLORER_II',
            2 => 'EXPLORER_III',
            _ => '',
        }
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
        match level {
            0 => 20,
            1 => 40,
            2 => 80,
            _ => 0,
        }
    }

    #[inline]
    fn group() -> felt252 {
        'Explorer'
    }

    #[inline]
    fn icon(level: u8) -> felt252 {
        match level {
            0 => 'fa-mountain',
            1 => 'fa-mountains',
            2 => 'fa-mountain-sun',
            _ => '',
        }
    }

    #[inline]
    fn title(level: u8) -> felt252 {
        match level {
            0 => 'Explorer I',
            1 => 'Explorer II',
            2 => 'Explorer III',
            _ => '',
        }
    }

    #[inline]
    fn description(level: u8) -> ByteArray {
        "The world is a book, and those who do not travel read only one page"
    }

    #[inline]
    fn tasks(level: u8) -> Span<BushidoTask> {
        let count: u32 = match level {
            0 => 10,
            1 => 100,
            2 => 1000,
            _ => 0,
        };
        Task::Explorer.tasks(count)
    }
}
