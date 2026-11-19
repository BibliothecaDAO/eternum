use crate::troops::Coord;

pub fn center(spacing: u32) -> Coord {
    assert!(spacing >= crate::rules::DEEP_MAP_SIZE * 2, "Deep needs a full expedition region");
    Coord { alt: false, x: spacing / 2, y: spacing * 3 + spacing / 2 }
}

pub fn contains(coord: Coord, spacing: u32) -> bool {
    if coord.alt || spacing < crate::rules::DEEP_MAP_SIZE * 2 {
        return false;
    }
    let center = center(spacing);
    let half = crate::rules::DEEP_MAP_SIZE / 2;
    coord.x >= center.x - half && coord.x < center.x + half && coord.y >= center.y - half && coord.y < center.y + half
}

#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct DeepRing {
    pub radius: u32,
    pub realms: u32,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct DeepBeast {
    pub count: u128,
    pub bow: bool,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct DeepPay {
    pub alone: u32,
    pub pair: u32,
    pub crowd: u32,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct DeepRules {
    pub gate_distance: u32,
    pub rings: Span<DeepRing>,
    pub beasts: Span<DeepBeast>,
    pub loss_per_tick: u128,
    pub core_per_tick: u128,
    pub mine_per_tick: u128,
    pub building_pay: DeepPay,
    pub altar_threshold: u32,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct DeepSettings {
    pub gate_distance: u32,
    pub ring_count: u8,
    pub loss_per_tick: u128,
    pub core_per_tick: u128,
    pub mine_per_tick: u128,
    pub building_pay: DeepPay,
    pub altar_threshold: u32,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct DeepSite {
    pub kind: u8,
    pub ring: u8,
    pub day: u64,
}

pub fn settings(rules: DeepRules) -> DeepSettings {
    DeepSettings {
        gate_distance: rules.gate_distance,
        ring_count: rules.rings.len().try_into().unwrap(),
        loss_per_tick: rules.loss_per_tick,
        core_per_tick: rules.core_per_tick,
        mine_per_tick: rules.mine_per_tick,
        building_pay: rules.building_pay,
        altar_threshold: rules.altar_threshold,
    }
}

pub fn building_pay(pay: DeepPay, open: u8) -> u32 {
    assert!(open != 0, "closed Deep site pays nothing");
    if open == 1 {
        pay.alone
    } else if open == 2 {
        pay.pair
    } else {
        pay.crowd
    }
}

pub fn altar_charge(previous: u32, amount: u32, threshold: u32) -> u32 {
    previous + core::cmp::min(threshold - previous, amount)
}

pub fn gate(gate_distance: u32, aspect: u8, spacing: u32) -> Coord {
    assert!(aspect >= 1 && aspect <= 4, "invalid Deep gate");
    compass(center(spacing), aspect - 1, gate_distance)
}

pub fn place(ring: u8, radius: u32, place: u8, spacing: u32) -> Coord {
    if ring < crate::rules::DEEP_DIAGONAL_RINGS {
        let direction = match place {
            0 => 1,
            1 => 5,
            2 => 4,
            _ => 2,
        };
        crate::geometry::neighbor_at_distance(center(spacing), direction, radius)
    } else {
        compass(center(spacing), place, radius)
    }
}

fn compass(origin: Coord, point: u8, distance: u32) -> Coord {
    match point {
        0 => zigzag(origin, 1, 2, distance),
        1 => crate::geometry::neighbor_at_distance(origin, 0, distance),
        2 => zigzag(origin, 4, 5, distance),
        _ => crate::geometry::neighbor_at_distance(origin, 3, distance),
    }
}

fn zigzag(origin: Coord, first: u8, second: u8, distance: u32) -> Coord {
    let halfway = crate::geometry::neighbor_at_distance(origin, first, (distance + 1) / 2);
    crate::geometry::neighbor_at_distance(halfway, second, distance / 2)
}

pub fn kind_on(ring: u8, place: u8, day: u64) -> u8 {
    let turn: u8 = ((day + ring.into()) % crate::rules::DEEP_KIND_COUNT.into()).try_into().unwrap();
    (place + 2 * crate::rules::DEEP_KIND_COUNT - turn) % crate::rules::DEEP_KIND_COUNT
}

pub fn validate(rules: DeepRules, spacing: u32) {
    assert!(rules.beasts.len() == crate::rules::DEEP_KIND_COUNT.into(), "a Deep beast for every kind");
    for beast in rules.beasts {
        assert!(*beast.count != 0 && *beast.count % crate::rules::RESOURCE_PRECISION == 0, "invalid Deep beast");
    }
    assert!(rules.core_per_tick != 0 && rules.mine_per_tick != 0, "empty Deep payment");
    let pay = rules.building_pay;
    assert!(
        pay.crowd != 0 && pay.pair >= pay.crowd && pay.alone >= pay.pair && rules.altar_threshold != 0,
        "invalid Deep building pay",
    );
    assert!(
        rules.loss_per_tick != 0 && rules.loss_per_tick % crate::rules::RESOURCE_PRECISION == 0,
        "invalid Deep troop loss",
    );
    validate_rings(rules.rings);
    validate_layout(rules, spacing);
}

fn validate_rings(rings: Span<DeepRing>) {
    assert!(rings.len() != 0 && rings.len() <= crate::rules::DEEP_RING_LIMIT.into(), "invalid Deep ring count");
    assert!(*rings.at(0).realms == 0, "the first Deep ring opens with the day");
    for index in 0..rings.len() {
        assert!(*rings.at(index).radius != 0, "empty Deep ring");
        if index != 0 {
            assert!(*rings.at(index).realms > *rings.at(index - 1).realms, "Deep rings open in order");
        }
    }
}

fn validate_layout(rules: DeepRules, spacing: u32) {
    let mut gates = array![];
    for aspect in 1_u8..5 {
        let entrance = gate(rules.gate_distance, aspect, spacing);
        assert!(contains(entrance, spacing) && entrance != center(spacing), "Deep gate outside map");
        gates.append(entrance);
    }
    let mut sites: Array<Coord> = array![];
    for ring in 0..rules.rings.len() {
        let ring: u8 = ring.try_into().unwrap();
        for index in 0..crate::rules::DEEP_KIND_COUNT {
            let site = place(ring, *rules.rings.at(ring.into()).radius, index, spacing);
            assert!(contains(site, spacing), "Deep site outside map");
            for entrance in gates.span() {
                assert!(site != *entrance, "Deep site blocks a gate");
                assert!(
                    crate::geometry::distance(site, *entrance) <= crate::rules::DEEP_GATE_REACH,
                    "Deep site too far from a gate",
                );
            }
            for other in sites.span() {
                assert!(
                    crate::geometry::distance(site, *other) >= crate::rules::DEEP_SITE_SPACING, "Deep sites too close",
                );
            }
            sites.append(site);
        }
    }
}

#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct DeepGuard {
    pub site_id: u64,
    pub slot: u8,
}

#[starknet::interface]
pub trait IDeepSites<T> {
    fn join_deep_site(
        ref self: T,
        game_id: u32,
        actor: starknet::ContractAddress,
        command: crate::relics::InteractSite,
        context: crate::commands::ActionContext,
    );
    fn initialize_deep(ref self: T, game_id: u32);
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct DeepArmy {
    pub last_tick: u64,
}

pub fn troops_after_ticks(count: u128, last_tick: u64, tick: u64, loss_per_tick: u128) -> u128 {
    let elapsed = tick - core::cmp::min(tick, last_tick);
    let loss: u256 = Into::<u64, u256>::into(elapsed) * Into::<u128, u256>::into(loss_per_tick);
    if loss >= count.into() {
        0
    } else {
        count - loss.try_into().unwrap()
    }
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct DeepShare {
    pub home: u64,
    pub troops: u128,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct AltarBar {
    pub charge: u32,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct TeamBaneKey {
    pub game_id: u32,
    pub aspect: u8,
    pub day: u64,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct TeamBane {
    pub source: u8,
    pub issued_day: u64,
    pub quest: u8,
}

#[starknet::interface]
pub trait IDeepTicks<T> {
    fn settle_deep(ref self: T, game_id: u32, context: crate::commands::ActionContext);
}

#[starknet::interface]
pub trait IDeepBanes<T> {
    fn height_block_end(self: @T, game_id: u32, aspect: u8, timestamp: u64) -> u64;
    fn settle_altar(ref self: T, game_id: u32, source: u8, charge: u32, boundary: u64, heights: Span<u32>) -> u32;
    fn team_quest(self: @T, home: crate::resources::ResourceKey, day: u64) -> Option<u8>;
}
