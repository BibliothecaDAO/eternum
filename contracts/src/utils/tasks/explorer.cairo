use eternum::utils::tasks::interface::TaskTrait;

impl Explorer of TaskTrait {
    #[inline]
    fn identifier() -> felt252 {
        'EXPLORER'
    }

    #[inline]
    fn description(difficulty: u8, count: u32) -> ByteArray {
        format!("Explore {} tiles", count)
    }
}
