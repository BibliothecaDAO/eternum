#[cfg(test)]
mod tests {
    use crate::constants::{
        BLITZ_REGISTRATION_COUNT_CAP, BLITZ_SETTLEMENT_POOL_STEP, assert_blitz_registration_count_within_cap,
        blitz_target_open_settlement_count,
    };

    #[test]
    fn blitz_registration_cap_accepts_96() {
        assert_blitz_registration_count_within_cap(BLITZ_REGISTRATION_COUNT_CAP);
    }

    #[test]
    #[should_panic(expected: "Eternum: registration capacity exceeds limit")]
    fn blitz_registration_cap_rejects_97() {
        assert_blitz_registration_count_within_cap(BLITZ_REGISTRATION_COUNT_CAP + 1);
    }

    #[test]
    fn settlement_pool_never_opens_more_than_one_step() {
        let mut settled_player_count = 0;
        while settled_player_count < BLITZ_REGISTRATION_COUNT_CAP {
            let target = blitz_target_open_settlement_count(settled_player_count, BLITZ_REGISTRATION_COUNT_CAP, false);
            assert!(target <= BLITZ_SETTLEMENT_POOL_STEP, "settlement pool step exceeded");
            settled_player_count += 1;
        };
    }
}
