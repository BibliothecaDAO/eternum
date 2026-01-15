use crate::utils::tasks::interface::TaskTrait;

pub impl Discoverer of TaskTrait {
    #[inline]
    fn identifier() -> felt252 {
        'DISCOVERER'
    }

    #[inline]
    fn description(count: u32) -> ByteArray {
        "Discover a Fragment Mine"
    }
}
