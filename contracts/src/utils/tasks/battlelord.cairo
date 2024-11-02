use eternum::utils::tasks::interface::TaskTrait;

impl Battlelord of TaskTrait {
    #[inline]
    fn identifier() -> felt252 {
        'BATTLELORD'
    }

    #[inline]
    fn description(difficulty: u8, count: u32) -> ByteArray {
        match count {
            0 => "",
            1 => "Win 1 battle",
            _ => format!("Win {} battles", count),
        }
    }
}
