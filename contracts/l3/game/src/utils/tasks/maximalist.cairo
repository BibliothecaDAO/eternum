use crate::utils::tasks::interface::TaskTrait;

pub impl Maximalist of TaskTrait {
    #[inline]
    fn identifier() -> felt252 {
        'MAXIMALIST'
    }

    #[inline]
    fn description(count: u32) -> ByteArray {
        "Max out the Realms levels"
    }
}
