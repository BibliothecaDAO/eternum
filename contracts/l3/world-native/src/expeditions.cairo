use crate::rules::BiomeClimateConfig;
use crate::troops::Coord;

#[allow(starknet::store_no_default_variant)]
#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub enum SiteKind {
    Camp,
    Rift,
    FallenRealm,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct ExpeditionSite {
    pub kind: SiteKind,
    pub initial_guard_count: u128,
    pub cleared: bool,
}

#[starknet::interface]
pub trait IExpeditionSite<T> {
    fn expedition_site(self: @T, key: crate::resources::ResourceKey) -> Option<ExpeditionSite>;
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct SitePayout {
    pub structure_id: u32,
    pub explorer_id: u32,
    pub site_id: u32,
    pub kind: SiteKind,
    pub reward: Option<crate::resources::ResourceAmount>,
}

pub fn site_reward(site: ExpeditionSite) -> Option<crate::resources::ResourceAmount> {
    use crate::resources::{ESSENCE, LABOR, ResourceAmount};
    match site.kind {
        SiteKind::Camp => Some(ResourceAmount { resource_type: LABOR, amount: site.initial_guard_count / 2 }),
        SiteKind::Rift => Some(ResourceAmount { resource_type: ESSENCE, amount: site.initial_guard_count * 3 }),
        SiteKind::FallenRealm => None,
    }
}

pub fn absolute_epoch(seconds: u32, timestamp: u64) -> u64 {
    assert!(seconds != 0, "game has no expeditions");
    timestamp / seconds.into()
}

pub fn season_day(start: u64, seconds: u32, timestamp: u64) -> u64 {
    assert!(timestamp >= start, "expedition has not started");
    absolute_epoch(seconds, timestamp) - absolute_epoch(seconds, start)
}

pub fn validate_game(seconds: u32, spacing: u32, duration: u64) {
    if seconds == 0 {
        return;
    }
    assert!(spacing >= 16, "expedition regions are too small");
    let spacing: u128 = spacing.into();
    let season_days: u128 = Into::<u64, u128>::into(duration) / Into::<u32, u128>::into(seconds) + 2;
    assert!(spacing * crate::realms::CANONICAL_REALM_COUNT.into() < 0x7fffffff, "expedition map exhausted");
    assert!(season_days * 4 * spacing < 0x7fffffff, "expedition season exceeds map");
}

pub fn site(start: u64, seconds: u32, spacing: u32, realm_id: u16, timestamp: u64, depth: u8) -> Coord {
    assert!(timestamp >= start, "expedition has not started");
    assert!(realm_id > 0 && realm_id.into() <= crate::realms::CANONICAL_REALM_COUNT, "invalid expedition realm");
    assert!(depth < 4, "invalid expedition depth");
    let season_day = season_day(start, seconds, timestamp);
    let width: u64 = spacing.into();
    Coord {
        alt: false,
        x: ((Into::<u16, u64>::into(realm_id) - 1) * width + width / 2).try_into().expect('expedition map exhausted'),
        y: ((season_day * 4 + Into::<u8, u64>::into(depth)) * width + width / 2)
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
    let season_day = season_day(start, seconds, timestamp);
    crate::geometry::neighbor(site, (season_day % 6).try_into().unwrap())
}

pub fn is_current(coord: Coord, start: u64, seconds: u32, spacing: u32, timestamp: u64) -> bool {
    if coord.alt || timestamp < start {
        return false;
    }
    let season_day = season_day(start, seconds, timestamp);
    Into::<u32, u64>::into(coord.y / spacing / 4) == season_day
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
    let epoch = (absolute_epoch(seconds, start) + Into::<u32, u64>::into(coord.y / spacing / 4)) % 0x100000000;
    BiomeClimateConfig {
        elevation_seed: ((Into::<u32, u64>::into(config.elevation_seed) + epoch) % 0x100000000).try_into().unwrap(),
        moisture_seed: ((Into::<u32, u64>::into(config.moisture_seed) + epoch) % 0x100000000).try_into().unwrap(),
        ..config,
    }
}

#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct DepthRules {
    pub reveal_percent: u16,
    pub guard_lower: u16,
    pub guard_upper: u16,
    pub reveal_site_neighbors: bool,
    pub entry_stamina: u16,
    pub attunement_cost: u128,
    pub chest: crate::relics::ChestGround,
    pub fallen_guard_lower: u32,
    pub fallen_guard_upper: u32,
}

#[starknet::interface]
pub trait IExpeditionRules<T> {
    #[cfg(test)]
    fn depth_rules(self: @T, game_id: u32, depth: u8) -> DepthRules;
}

#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct FrontierDiscoveryRules {
    pub camp_bps: u16,
    pub rift_bps: u16,
    pub fallen_realm_bps: u16,
    pub loose_chest_bps: u16,
    pub shrine_bps: u16,
    pub well_bps: u16,
    pub empty_reveal_limit: u8,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct ExpeditionDiscoveryKey {
    pub game_id: u32,
    pub structure_id: u32,
    pub epoch: u64,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct ExpeditionDiscovery {
    pub empty_reveals: u8,
}
#[starknet::interface]
pub trait IFrontierDiscovery<T> {
    fn frontier_discovery_rules(self: @T, game_id: u32) -> Option<FrontierDiscoveryRules>;
    fn expedition_discovery(self: @T, key: ExpeditionDiscoveryKey) -> Option<ExpeditionDiscovery>;
    fn discover_frontier_tile(
        ref self: T, key: crate::map::TileKey, explorer_id: u32, seed: u256, context: crate::commands::ActionContext,
    ) -> crate::discovery::Discovery;
}

#[starknet::interface]
pub trait ISiteRewards<T> {
    fn pay_expedition_site(
        ref self: T,
        key: crate::resources::ResourceKey,
        explorer: crate::troops::ExplorerKey,
        home_id: u32,
        context: crate::commands::ActionContext,
        story_cursor: crate::ownership::StoryCursor,
    ) -> ((), crate::ownership::StoryCursor);
}
