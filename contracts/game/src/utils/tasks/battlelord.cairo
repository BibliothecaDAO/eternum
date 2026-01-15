use crate::utils::tasks::interface::TaskTrait;

pub impl Battlelord of TaskTrait {
    #[inline]
    fn identifier() -> felt252 {
        'BATTLELORD'
    }

    #[inline]
    fn description(count: u32) -> ByteArray {
        match count {
            0 => "",
            1 => "Win 1 battle",
            _ => format!("Win {} battles", count),
        }
    }
}
