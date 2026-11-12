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

pub fn arrival(spacing: u32) -> Coord {
    let center = center(spacing);
    Coord { y: center.y - crate::rules::DEEP_MAP_SIZE / 2 + 5, ..center }
}
