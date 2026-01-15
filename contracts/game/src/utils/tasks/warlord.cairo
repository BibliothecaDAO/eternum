use crate::utils::tasks::interface::TaskTrait;

pub impl Warlord of TaskTrait {
    #[inline]
    fn identifier() -> felt252 {
        'WARLORD'
    }

    #[inline]
    fn description(count: u32) -> ByteArray {
        "Claim the victory"
    }
}
