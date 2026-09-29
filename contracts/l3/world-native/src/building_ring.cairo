use core::poseidon::poseidon_hash_span;
use crate::troops::Coord;

pub fn marked_plot(realm_id: u16, ring: u32) -> Coord {
    assert!(realm_id > 0 && realm_id.into() <= crate::realms::CANONICAL_REALM_COUNT, "invalid ring realm");
    assert!(ring > 0 && ring < 10, "invalid building ring");
    let hash: u256 = poseidon_hash_span(array![realm_id.into(), ring.into()].span()).into();
    let index: u32 = (hash % (6 * ring).into()).try_into().unwrap();
    let mut coord = Coord { alt: false, x: 10 + ring, y: 10 };
    let directions = array![2_u8, 3, 4, 5, 0, 1];
    for step in 0..index {
        coord = crate::geometry::neighbor(coord, *directions.at(step / ring));
    }
    coord
}

pub fn is_marked_plot(realm_id: u16, coord: Coord) -> bool {
    let centre = Coord { alt: false, x: 10, y: 10 };
    let ring = crate::geometry::distance(centre, coord);
    ring != 0 && coord == marked_plot(realm_id, ring.try_into().expect('invalid building ring'))
}
