use crate::utils::tasks::interface::TaskTrait;

pub impl Ruler of TaskTrait {
    #[inline]
    fn identifier() -> felt252 {
        'RULER'
    }

    #[inline]
    fn description(count: u32) -> ByteArray {
        "Conquer the bank"
    }
}
