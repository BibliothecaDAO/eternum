use achievement::types::task::Task as BushidoTask;
use crate::utils::tasks::index::{Task, TaskImpl};
use crate::utils::trophies::interface::TrophyTrait;

pub impl Conqueror of TrophyTrait {
    #[inline]
    fn identifier(level: u8) -> felt252 {
        match level {
            0 => 'CONQUEROR_I',
            1 => 'CONQUEROR_II',
            2 => 'CONQUEROR_III',
            _ => '',
        }
    }

    #[inline]
    fn index(level: u8) -> u8 {
        level
    }

    #[inline]
    fn hidden(level: u8) -> bool {
        false
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
        'Conqueror'
    }

    #[inline]
    fn icon(level: u8) -> felt252 {
        match level {
            0 => 'fa-sword',
            1 => 'fa-swords',
            2 => 'fa-khanda',
            _ => '',
        }
    }

    #[inline]
    fn title(level: u8) -> felt252 {
        match level {
            0 => 'Conqueror I',
            1 => 'Conqueror II',
            2 => 'Conqueror III',
            _ => '',
        }
    }

    #[inline]
    fn description(level: u8) -> ByteArray {
        "Power is not a means, it is an end"
    }

    #[inline]
    fn tasks(level: u8) -> Span<BushidoTask> {
        let count: u32 = match level {
            0 => 1,
            1 => 5,
            2 => 10,
            _ => 0,
        };
        Task::Conqueror.tasks(count)
    }
}
