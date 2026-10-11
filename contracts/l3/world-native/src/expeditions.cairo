use crate::rules::BiomeClimateConfig;
use crate::troops::Coord;

// A guarded site's kind is its structure category. The camp keeps its shared category (crate::camps).

pub fn is_site_category(category: u8) -> bool {
    category == crate::taxonomy::CAMP_CATEGORY
        || category == crate::taxonomy::RIFT_CATEGORY
        || category == crate::taxonomy::RUIN_CATEGORY
        || category == crate::taxonomy::STRAGGLERS_CATEGORY
}

#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct ExpeditionSite {
    pub initial_guard_count: u128,
    pub cleared: bool,
}

#[starknet::interface]
pub trait IExpeditionSite<T> {
    fn expedition_site(self: @T, key: crate::resources::ResourceKey) -> Option<ExpeditionSite>;
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct SitePayout {
    pub structure_id: u64,
    pub explorer_id: u64,
    pub site_id: u64,
    pub category: u8,
    pub reward: Option<crate::resources::ResourceAmount>,
}

// Stragglers pay only the clear's XP; a ruin pays the chest stored with it (crate::relics::SiteChest).
pub fn site_reward(category: u8, site: ExpeditionSite) -> Option<crate::resources::ResourceAmount> {
    use crate::resources::{ESSENCE, LABOR, ResourceAmount};
    if category == crate::taxonomy::CAMP_CATEGORY {
        Some(ResourceAmount { resource_type: LABOR, amount: site.initial_guard_count / 2 })
    } else if category == crate::taxonomy::RIFT_CATEGORY {
        Some(ResourceAmount { resource_type: ESSENCE, amount: site.initial_guard_count * 3 })
    } else {
        None
    }
}

pub fn validate_game(rules: crate::registrar::LaunchRules, start: u64, duration: u64) {
    if rules.day_unit_seconds == 0 {
        return;
    }
    assert!(rules.spacing >= 16, "expedition regions are too small");
    assert!(start % rules.armies_tick_seconds == 0, "season does not start on a tick");
    let spacing: u128 = rules.spacing.into();
    let season_days: u128 = crate::days::season_days(duration, rules.day_unit_seconds).into() + 2;
    assert!(spacing * crate::realms::CANONICAL_REALM_COUNT.into() < 0x7fffffff, "expedition map exhausted");
    assert!(season_days * 4 * spacing < 0x7fffffff, "expedition season exceeds map");
}

/// A realm's site on a day's map: its region's centre, one region per realm and day, four bands deep.
pub fn site(spacing: u32, region_id: u32, day: u64, depth: u8) -> Coord {
    assert!(region_id > 0, "invalid expedition region");
    assert!(depth < 4, "invalid expedition depth");
    let width: u64 = spacing.into();
    Coord {
        alt: false,
        x: ((Into::<u32, u64>::into(region_id) - 1) * width + width / 2).try_into().expect('expedition map exhausted'),
        y: ((day * 4 + Into::<u8, u64>::into(depth)) * width + width / 2).try_into().expect('expedition map exhausted'),
    }
}

/// The day a map coordinate belongs to: its band of four regions.
pub fn region_day(coord: Coord, spacing: u32) -> u64 {
    (coord.y / spacing / 4).into()
}

// A realm's home ring: its region's surface site and the six tiles around it. It counts as explored from the day's
// first second, by rule and for every realm, so no transaction opens a day; storage catches up when a command first
// uses the ring, atomically materializing all seven tiles. Every surface region is one realm's day, so the ring follows
// from the coordinate alone.
pub fn is_home_ring(coord: Coord, spacing: u32) -> bool {
    if coord.alt || (coord.y / spacing) % 4 != 0 {
        return false;
    }
    let centre = home_ring_center(coord, spacing);
    let mut ring = coord == centre;
    for direction in 0_u8..6 {
        ring = ring || crate::geometry::neighbor(centre, direction) == coord;
    }
    ring
}

pub fn home_ring_center(coord: Coord, spacing: u32) -> Coord {
    Coord { alt: false, x: coord.x / spacing * spacing + spacing / 2, y: coord.y / spacing * spacing + spacing / 2 }
}

// The day's spire, which depth research lights: one of the home ring's six tiles, turning one step each day so the
// first march from home differs daily. It is a rule, not a stored structure.
pub fn spire(spacing: u32, region_id: u32, day: u64) -> Coord {
    crate::geometry::neighbor(site(spacing, region_id, day, 0), (day % 6).try_into().unwrap())
}

/// An army lives only on its own day's map: on any later day it is gone.
pub fn is_current(coord: Coord, spacing: u32, day: u64) -> bool {
    !coord.alt && region_day(coord, spacing) == day
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

// Each day's map draws its own terrain: the climate seeds move by the day, counted in units from absolute time so
// two seasons' days differ too.
pub fn climate(
    config: BiomeClimateConfig, coord: Coord, start: u64, unit_seconds: u32, spacing: u32,
) -> BiomeClimateConfig {
    let shift = (start / unit_seconds.into() + region_day(coord, spacing)) % 0x100000000;
    BiomeClimateConfig {
        elevation_seed: ((Into::<u32, u64>::into(config.elevation_seed) + shift) % 0x100000000).try_into().unwrap(),
        moisture_seed: ((Into::<u32, u64>::into(config.moisture_seed) + shift) % 0x100000000).try_into().unwrap(),
        ..config,
    }
}

#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct DepthRules {
    pub reveal_percent: u16,
    pub site_guard_lower: u16,
    pub site_guard_upper: u16,
    pub reveal_site_neighbors: bool,
    pub entry_stamina: u16,
    // Each chest tier's odds, in basis points, for a ruin found at this depth.
    pub chest: crate::relics::ChestTiers,
    pub ruin_guard_lower: u32,
    pub ruin_guard_upper: u32,
    pub guard_step: u32,
}

#[starknet::interface]
pub trait IExpeditionRules<T> {
    #[cfg(test)]
    fn depth_rules(self: @T, game_id: u32, depth: u8) -> DepthRules;
}

#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct FrontierDiscoveryRules {
    pub stragglers_bps: u16,
    pub camp_bps: u16,
    pub rift_bps: u16,
    pub ruin_bps: u16,
    pub shrine_bps: u16,
    pub well_bps: u16,
    pub empty_reveal_limit: u8,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct ExpeditionDiscoveryKey {
    pub game_id: u32,
    pub structure_id: u64,
    // The season day index (crate::days), under the field's historical name.
    pub epoch: u64,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct ExpeditionDiscovery {
    pub empty_reveals: u8,
    // A player finds at most one ruin a day, counted when it is found.
    pub ruin_found: bool,
}
#[starknet::interface]
pub trait IFrontierDiscovery<T> {
    fn consume_frontier_site(ref self: T, key: crate::map::TileKey) -> u8;
    fn frontier_discovery_rules(self: @T, game_id: u32) -> Option<FrontierDiscoveryRules>;
    fn expedition_discovery(self: @T, key: ExpeditionDiscoveryKey) -> Option<ExpeditionDiscovery>;
    fn discover_frontier_tile(
        ref self: T, key: crate::map::TileKey, explorer_id: u64, seed: u256, context: crate::commands::ActionContext,
    ) -> crate::discovery::Discovery;
}

#[starknet::interface]
pub trait ISiteRewards<T> {
    fn pay_expedition_site(
        ref self: T,
        key: crate::resources::ResourceKey,
        explorer: crate::troops::ExplorerKey,
        home_id: u64,
        context: crate::commands::ActionContext,
    );
}
