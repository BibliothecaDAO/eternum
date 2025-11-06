use crate::utils::tasks::interface::TaskTrait;

pub impl Explorer of TaskTrait {
    #[inline]
    fn identifier() -> felt252 {
        'EXPLORER'
    }

    #[inline]
    fn description(count: u32) -> ByteArray {
        format!("Explore {} tiles", count)
    }
}
