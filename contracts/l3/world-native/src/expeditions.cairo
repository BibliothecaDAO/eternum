use crate::rules::BiomeClimateConfig;
use crate::troops::Coord;

pub fn validate_game(seconds: u32, spacing: u32, duration: u64) {
    if seconds == 0 {
        return;
    }
    assert!(spacing >= 16, "expedition regions are too small");
    let spacing: u128 = spacing.into();
    let epochs: u128 = Into::<u64, u128>::into(duration) / Into::<u32, u128>::into(seconds) + 2;
    assert!(spacing * crate::realms::CANONICAL_REALM_COUNT.into() < 0x7fffffff, "expedition map exhausted");
    assert!(epochs * 4 * spacing < 0x7fffffff, "expedition season exceeds map");
}

pub fn site(start: u64, seconds: u32, spacing: u32, realm_id: u16, timestamp: u64, depth: u8) -> Coord {
    assert!(timestamp >= start, "expedition has not started");
    assert!(realm_id > 0 && realm_id.into() <= crate::realms::CANONICAL_REALM_COUNT, "invalid expedition realm");
    assert!(depth < 4, "invalid expedition depth");
    let epoch = timestamp / seconds.into() - start / seconds.into();
    let width: u64 = spacing.into();
    Coord {
        alt: false,
        x: ((Into::<u16, u64>::into(realm_id) - 1) * width + width / 2).try_into().expect('expedition map exhausted'),
        y: ((epoch * 4 + Into::<u8, u64>::into(depth)) * width + width / 2)
            .try_into()
            .expect('expedition map exhausted'),
    }
}

// A realm's home ring: its region's surface site and the six tiles around it. It counts as explored from the day's
// first second, by rule and for every realm, so no transaction opens a day; storage catches up when a command first
// uses a ring tile. Every surface region is one realm's day, so the ring follows from the coordinate alone.
pub fn is_home_ring(coord: Coord, spacing: u32) -> bool {
    if coord.alt || (coord.y / spacing) % 4 != 0 {
        return false;
    }
    let centre = Coord {
        alt: false, x: coord.x / spacing * spacing + spacing / 2, y: coord.y / spacing * spacing + spacing / 2,
    };
    let mut ring = coord == centre;
    for direction in 0_u8..6 {
        ring = ring || crate::geometry::neighbor(centre, direction) == coord;
    }
    ring
}

// The day's spire, which attunement lights: one of the home ring's six tiles, turning one step each day so the first
// march from home differs daily. It is a rule, not a stored structure.
pub fn spire(start: u64, seconds: u32, spacing: u32, realm_id: u16, timestamp: u64) -> Coord {
    let site = site(start, seconds, spacing, realm_id, timestamp, 0);
    let epoch = timestamp / seconds.into() - start / seconds.into();
    crate::geometry::neighbor(site, (epoch % 6).try_into().unwrap())
}

pub fn is_current(coord: Coord, start: u64, seconds: u32, spacing: u32, timestamp: u64) -> bool {
    if coord.alt || timestamp < start {
        return false;
    }
    let epoch = timestamp / seconds.into() - start / seconds.into();
    Into::<u32, u64>::into(coord.y / spacing / 4) == epoch
}

pub fn assert_same_region(origin: Coord, destination: Coord, spacing: u32) {
    let same_region = origin.x / spacing == destination.x / spacing && origin.y / spacing == destination.y / spacing;
    let local_x = destination.x % spacing;
    let local_y = destination.y % spacing;
    let margin = spacing / 4;
    let inside_region = local_x >= margin && local_x < spacing
        - margin && local_y >= margin && local_y < spacing
        - margin;
    assert!(!destination.alt && same_region && inside_region, "outside expedition region");
}

pub fn climate(config: BiomeClimateConfig, coord: Coord, start: u64, seconds: u32, spacing: u32) -> BiomeClimateConfig {
    let epoch = (start / seconds.into() + Into::<u32, u64>::into(coord.y / spacing / 4)) % 0x100000000;
    BiomeClimateConfig {
        elevation_seed: ((Into::<u32, u64>::into(config.elevation_seed) + epoch) % 0x100000000).try_into().unwrap(),
        moisture_seed: ((Into::<u32, u64>::into(config.moisture_seed) + epoch) % 0x100000000).try_into().unwrap(),
        ..config,
    }
}

#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct DepthRules {
    pub supply_multiplier: u16,
    pub guard_lower: u16,
    pub guard_upper: u16,
    pub mine_cap_min: u128,
    pub mine_cap_max: u128,
    pub mine_rate: u64,
    pub mine_chest: bool,
    pub reveal_site_neighbors: bool,
    pub entry_stamina: u16,
    pub attunement_cost: u128,
    pub chest: crate::relics::ChestGround,
}

#[starknet::interface]
pub trait IExpeditionRules<T> {
    fn configure_depths(ref self: T, game_id: u32, depths: Span<DepthRules>);
    #[cfg(test)]
    fn depth_rules(self: @T, game_id: u32, depth: u8) -> DepthRules;
}
