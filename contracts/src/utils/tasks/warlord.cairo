use s0_eternum::utils::tasks::interface::TaskTrait;

impl Warlord of TaskTrait {
    #[inline]
    fn identifier() -> felt252 {
        'WARLORD'
    }

    #[inline]
    fn description(count: u32) -> ByteArray {
        "Claim the victory"
    }
}
