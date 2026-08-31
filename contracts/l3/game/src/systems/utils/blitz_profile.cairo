pub const OFFICIAL_60_BLITZ_PROFILE_ID: u8 = 1;
pub const OFFICIAL_90_BLITZ_PROFILE_ID: u8 = 2;
pub const DEFAULT_BLITZ_PROFILE_ID: u8 = OFFICIAL_90_BLITZ_PROFILE_ID;

#[generate_trait]
pub impl iBlitzProfileImpl of iBlitzProfileTrait {
    fn is_known_blitz_profile_id(profile_id: u8) -> bool {
        profile_id == OFFICIAL_60_BLITZ_PROFILE_ID || profile_id == OFFICIAL_90_BLITZ_PROFILE_ID
    }

    fn assert_known_blitz_profile_id(profile_id: u8) {
        assert!(Self::is_known_blitz_profile_id(profile_id), "unknown blitz profile");
    }

    fn resolve_blitz_profile_id(profile_id: u8) -> u8 {
        if profile_id == 0 {
            return DEFAULT_BLITZ_PROFILE_ID;
        }

        Self::assert_known_blitz_profile_id(profile_id);
        profile_id
    }
}
