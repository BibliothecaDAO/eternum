use eternum::utils::tasks::interface::TaskTrait;

impl Ruler of TaskTrait {
    #[inline]
    fn identifier() -> felt252 {
        'RULER'
    }

    #[inline]
    fn description(difficulty: u8, count: u32) -> ByteArray {
        "Conquer the bank"
    }
}
