use eternum::utils::tasks::interface::TaskTrait;

impl Maximalist of TaskTrait {
    #[inline]
    fn identifier() -> felt252 {
        'MAXIMALIST'
    }

    #[inline]
    fn description(difficulty: u8, count: u32) -> ByteArray {
        "Max out the Realms levels"
    }
}
