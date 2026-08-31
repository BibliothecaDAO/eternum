use crate::utils::tasks::interface::TaskTrait;

pub impl Opportunist of TaskTrait {
    #[inline]
    fn identifier() -> felt252 {
        'OPPORTUNIST'
    }

    #[inline]
    fn description(count: u32) -> ByteArray {
        "Contribute to a Hyperstructure"
    }
}
