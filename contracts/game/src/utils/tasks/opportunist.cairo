use s0_eternum::utils::tasks::interface::TaskTrait;

impl Opportunist of TaskTrait {
    #[inline]
    fn identifier() -> felt252 {
        'OPPORTUNIST'
    }

    #[inline]
    fn description(count: u32) -> ByteArray {
        "Contribute to a Hyperstructure"
    }
}
