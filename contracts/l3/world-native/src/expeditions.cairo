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
