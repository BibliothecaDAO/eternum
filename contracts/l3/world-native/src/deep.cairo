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
    pub aspect: u8,
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

pub fn place(radius: u32, place: u8, spacing: u32) -> Coord {
    crate::geometry::neighbor_at_distance(center(spacing), place, radius)
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

pub fn ring_draw(raw_root: u256, game_id: u32, ring: u8, day: u64) -> u256 {
    core::poseidon::poseidon_hash_span(
        array![raw_root.low.into(), raw_root.high.into(), game_id.into(), ring.into(), day.into()].span(),
    )
        .into()
}

pub fn kind_at(draw: u256, place: u8) -> u8 {
    let kinds: u256 = crate::rules::DEEP_KIND_COUNT.into();
    let sites: u256 = crate::rules::DEEP_RING_SITES.into();
    let slot: u256 = (place.into() + draw / (kinds * kinds)) % sites;
    let kind = if slot < kinds {
        slot
    } else if slot == kinds {
        draw % kinds
    } else {
        draw / kinds % kinds
    };
    kind.try_into().unwrap()
}

#[cfg(not(feature: "blitz"))]
pub fn assert_layout_fits() {
    let spacing = crate::logic::settlement::spacing();
    let middle = center(spacing);
    let mut gates = array![];
    for aspect in 1_u8..5 {
        let entrance = gate(crate::balance::deep::DEEP_SETTINGS.gate_distance, aspect, spacing);
        assert!(contains(entrance, spacing) && outside_plaza(entrance, middle), "Deep gate outside map");
        gates.append(entrance);
    }
    let mut sites: Array<Coord> = array![];
    for ring in crate::balance::deep::DEEP_RINGS.span() {
        for index in 0..crate::rules::DEEP_RING_SITES {
            let site = place(*ring.radius, index, spacing);
            assert!(contains(site, spacing) && outside_plaza(site, middle), "Deep site outside map");
            for entrance in gates.span() {
                assert!(site != *entrance, "Deep site blocks a gate");
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

fn outside_plaza(coord: Coord, middle: Coord) -> bool {
    crate::geometry::distance(coord, middle) > crate::rules::DEEP_PLAZA_RADIUS.into()
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct GarrisonSlot {
    pub home: u64,
}

#[starknet::interface]
pub trait IDeepSites<T> {
    fn initialize_deep(ref self: T, game_id: u32);
    fn rollover_deep(ref self: T, game_id: u32, context: crate::commands::ActionContext) -> bool;
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
