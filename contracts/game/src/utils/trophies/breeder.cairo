use achievement::types::task::Task as BushidoTask;
use s1_eternum::utils::tasks::index::{Task, TaskImpl};
use s1_eternum::utils::trophies::interface::TrophyTrait;

pub impl Breeder of TrophyTrait {
    #[inline]
    fn identifier(level: u8) -> felt252 {
        match level {
            0 => 'BREEDER_I',
            1 => 'BREEDER_II',
            2 => 'BREEDER_III',
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
        'Breeder'
    }

    #[inline]
    fn icon(level: u8) -> felt252 {
        'fa-democrat'
    }

    #[inline]
    fn title(level: u8) -> felt252 {
        match level {
            0 => 'Breeder I',
            1 => 'Breeder II',
            2 => 'Breeder III',
            _ => '',
        }
    }

    #[inline]
    fn description(level: u8) -> ByteArray {
        "A stubborn mule is still better than no mule at all"
    }

    #[inline]
    fn tasks(level: u8) -> Span<BushidoTask> {
        let count: u32 = match level {
            0 => 1000,
            1 => 10000,
            2 => 100000,
            _ => 0,
        };
        Task::Breeder.tasks(count)
    }
}
