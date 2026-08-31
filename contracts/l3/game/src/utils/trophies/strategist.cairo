use achievement::types::task::Task as BushidoTask;
use crate::utils::tasks::index::{Task, TaskImpl};
use crate::utils::trophies::interface::TrophyTrait;

pub impl Strategist of TrophyTrait {
    #[inline]
    fn identifier(level: u8) -> felt252 {
        match level {
            0 => 'STRATEGIST_I',
            1 => 'STRATEGIST_II',
            2 => 'STRATEGIST_III',
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
        'Strategist'
    }

    #[inline]
    fn icon(level: u8) -> felt252 {
        match level {
            0 => 'fa-chess-pawn-piece',
            1 => 'fa-chess-knight-piece',
            2 => 'fa-chess-king-piece',
            _ => '',
        }
    }

    #[inline]
    fn title(level: u8) -> felt252 {
        match level {
            0 => 'Strategist I',
            1 => 'Strategist II',
            2 => 'Strategist III',
            _ => '',
        }
    }

    #[inline]
    fn description(level: u8) -> ByteArray {
        "Plans are nothing; planning is everything"
    }

    #[inline]
    fn tasks(level: u8) -> Span<BushidoTask> {
        let count: u32 = 1;
        match level {
            0 => Task::Discoverer.tasks(count),
            1 => Task::Claimer.tasks(count),
            2 => Task::Builder.tasks(count),
            _ => [].span(),
        }
    }
}
