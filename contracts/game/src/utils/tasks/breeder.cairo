use s1_eternum::utils::tasks::interface::TaskTrait;

impl Breeder of TaskTrait {
    #[inline]
    fn identifier() -> felt252 {
        'BREEDER'
    }

    #[inline]
    fn description(count: u32) -> ByteArray {
        format!("Consume a total of {} donkeys", count)
    }
}
