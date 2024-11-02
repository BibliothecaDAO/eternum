use eternum::utils::tasks::interface::TaskTrait;

impl Opportunist of TaskTrait {
    #[inline]
    fn identifier() -> felt252 {
        'OPPORTUNIST'
    }

    #[inline]
    fn description(difficulty: u8, count: u32) -> ByteArray {
        "Contribute to a Hyperstructure"
    }
}
