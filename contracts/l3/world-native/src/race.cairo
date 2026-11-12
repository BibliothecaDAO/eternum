use crate::troops::Coord;

#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct RaceRules {
    pub season_days: u64,
    pub glory_per_tick: u128,
    pub height_per_tick: u32,
    pub stage_height: u32,
    pub clear_mist_percent: u16,
    pub second_wind_percent: u16,
    pub pale_moon_percent: u16,
    pub spoils_percent: u16,
    pub first: Coord,
    pub second: Coord,
    pub third: Coord,
    pub fourth: Coord,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct AspectKey {
    pub game_id: u32,
    pub aspect: u8,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct AspectHyperstructure {
    pub entity_id: u64,
    pub height: u32,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq, Default)]
pub struct RaceMember {
    pub glory: u128,
    pub contribution: u128,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct TriumphKey {
    pub game_id: u32,
    pub aspect: u8,
    pub stage: u8,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct RaceResult {
    pub winner: Option<u8>,
    pub ended_at: u64,
    pub scheduled_end_at: u64,
}

#[starknet::interface]
pub trait IRace<T> {
    fn initialize_race(ref self: T, game_id: u32);
    fn race_rules(self: @T, game_id: u32) -> Option<RaceRules>;
    fn race_member(self: @T, key: crate::resources::ResourceKey) -> RaceMember;
    fn aspect_hyperstructure(self: @T, key: AspectKey) -> AspectHyperstructure;
    fn triumph_day(self: @T, key: TriumphKey) -> Option<u64>;
    fn race_result(self: @T, game_id: u32) -> Option<RaceResult>;
}

pub fn assert_aspect(aspect: u8) {
    assert!(aspect >= 1 && aspect <= 4, "invalid Aspect");
}

pub fn local_coord(rules: RaceRules, aspect: u8) -> Coord {
    match aspect {
        1 => rules.first,
        2 => rules.second,
        3 => rules.third,
        4 => rules.fourth,
        _ => panic!("invalid Aspect"),
    }
}

pub fn validate(rules: RaceRules) {
    assert!(rules.season_days != 0 && rules.season_days % crate::days::DAYS_PER_BAG == 0, "race needs whole day bags");
    assert!(rules.glory_per_tick != 0, "zero Glory payment");
    assert!(rules.height_per_tick != 0 && rules.stage_height != 0, "zero height payment or stage");
    assert!(rules.stage_height % rules.height_per_tick == 0, "height must fill a stage exactly");
    assert!(rules.clear_mist_percent >= 100 && rules.clear_mist_percent <= 200, "invalid Clear Mist rate");
    assert!(rules.second_wind_percent >= 100 && rules.second_wind_percent <= 200, "invalid Second Wind rate");
    assert!(rules.pale_moon_percent > 0 && rules.pale_moon_percent <= 100, "invalid Pale Moon rate");
    assert!(rules.spoils_percent >= 100 && rules.spoils_percent <= 200, "invalid Spoils rate");
    let _ = rules.stage_height * 5;
    let _ = rules.glory_per_tick * crate::rules::RESOURCE_PRECISION;
    for aspect in 1..5 {
        let coord = local_coord(rules, aspect);
        assert!(
            !coord.alt && coord.x < crate::rules::DEEP_MAP_SIZE && coord.y < crate::rules::DEEP_MAP_SIZE,
            "hyperstructure outside Deep",
        );
        for other in 1..aspect {
            assert!(coord != local_coord(rules, other), "duplicate hyperstructure position");
        }
    }
}

// Largest remainders allocate the indivisible units; home identity breaks an exact tie.
pub fn split_payment(amount: u128, shares: Span<crate::deep::DeepShare>) -> Span<u128> {
    assert!(!shares.is_empty() && shares.len() <= 4, "invalid reward guard count");
    let mut total = 0_u256;
    for index in 0..shares.len() {
        let share = *shares.at(index);
        assert!(share.home != 0 && share.troops != 0, "empty reward guard");
        for previous in 0..index {
            assert!(*shares.at(previous).home != share.home, "duplicate reward home");
        }
        total += share.troops.into();
    }
    let mut allocated = 0_u128;
    let mut bases = array![];
    let mut remainders = array![];
    for share in shares {
        let weighted = Into::<u128, u256>::into(amount) * Into::<u128, u256>::into(*share.troops);
        let base: u128 = (weighted / total).try_into().unwrap();
        allocated += base;
        bases.append(base);
        remainders.append(weighted % total);
    }
    let remaining = amount - allocated;
    let mut result = array![];
    for index in 0..shares.len() {
        let mut ahead = 0_u128;
        for other in 0..shares.len() {
            if *remainders.at(other) > *remainders.at(index)
                || (*remainders.at(other) == *remainders.at(index) && *shares.at(other).home < *shares.at(index).home) {
                ahead += 1;
            }
        }
        result.append(*bases.at(index) + if ahead < remaining {
            1
        } else {
            0
        });
    }
    result.span()
}

pub fn height_after(rules: RaceRules, height: u32, blocked: bool) -> u32 {
    let finish = rules.stage_height * 5;
    assert!(height <= finish, "height exceeds finish");
    if blocked || height == finish {
        height
    } else {
        core::cmp::min(height + rules.height_per_tick, finish)
    }
}

#[starknet::interface]
pub trait IHeightBane<T> {
    fn height_blocked(self: @T, game_id: u32, aspect: u8, timestamp: u64) -> bool;
}
