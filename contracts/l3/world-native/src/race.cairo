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

// Largest remainders allocate the indivisible units; home identity breaks an exact tie.
pub fn split_payment(amount: u128, shares: Span<crate::deep::DeepShare>) -> Span<u128> {
    assert!(!shares.is_empty() && shares.len() <= crate::rules::DEEP_GUARD_SLOTS.into(), "invalid reward guard count");
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
        let remainder = *remainders.at(index);
        let home = *shares.at(index).home;
        let mut ahead = 0_u128;
        for other in 0..shares.len() {
            let other_remainder = *remainders.at(other);
            let other_home = *shares.at(other).home;
            if other_remainder > remainder || (other_remainder == remainder && other_home < home) {
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
