use crate::utils::tasks::interface::TaskTrait;

pub impl Builder of TaskTrait {
    #[inline]
    fn identifier() -> felt252 {
        'BUILDER'
    }

    #[inline]
    fn description(count: u32) -> ByteArray {
        "Build a Hyperstructure"
    }
}
