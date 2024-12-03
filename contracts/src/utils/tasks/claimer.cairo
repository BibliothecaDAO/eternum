use s0_eternum::utils::tasks::interface::TaskTrait;

impl Claimer of TaskTrait {
    #[inline]
    fn identifier() -> felt252 {
        'CLAIMER'
    }

    #[inline]
    fn description(count: u32) -> ByteArray {
        "Claim a Fragment Mine"
    }
}
