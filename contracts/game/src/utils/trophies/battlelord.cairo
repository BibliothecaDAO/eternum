use achievement::types::task::Task as BushidoTask;
use s1_eternum::utils::tasks::index::{Task, TaskImpl};
use s1_eternum::utils::trophies::interface::TrophyTrait;

pub impl Battlelord of TrophyTrait {
    #[inline]
    fn identifier(level: u8) -> felt252 {
        match level {
            0 => 'BATTLELORD_I',
            1 => 'BATTLELORD_II',
            2 => 'BATTLELORD_III',
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
        'Battlelord'
    }

    #[inline]
    fn icon(level: u8) -> felt252 {
        'fa-helmet-battle'
    }

    #[inline]
    fn title(level: u8) -> felt252 {
        match level {
            0 => 'Battlelord I',
            1 => 'Battlelord II',
            2 => 'Battlelord III',
            _ => '',
        }
    }

    #[inline]
    fn description(level: u8) -> ByteArray {
        "Death smiles at us all. All we can do is smile back"
    }

    #[inline]
    fn tasks(level: u8) -> Span<BushidoTask> {
        let count: u32 = match level {
            0 => 1,
            1 => 10,
            2 => 100,
            _ => 0,
        };
        Task::Battlelord.tasks(count)
    }
}
