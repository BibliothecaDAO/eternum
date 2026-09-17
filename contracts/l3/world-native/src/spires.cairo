use crate::troops::Coord;

#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct SpireLayout {
    pub count: u16,
    pub base_distance: u8,
    pub layer_distance: u8,
    pub max_layer: u8,
}
#[starknet::interface]
pub trait ISpires<T> {
    fn initialize_spires(ref self: T, game_id: u32, layout: SpireLayout);
    fn spire_layout(self: @T, game_id: u32) -> Option<SpireLayout>;
    fn place_spire(ref self: T, game_id: u32, coord: Coord) -> u32;
}

pub fn validate(layout: SpireLayout) {
    assert!(layout.count > 0, "season preset requires a spire");
    if layout.count == 1 {
        return;
    }
    assert!(layout.base_distance > 0 && layout.layer_distance > 0, "invalid spire spacing");
    let spacing: u32 = Into::<u8, u32>::into(layout.base_distance) * layout.layer_distance.into();
    assert!(spacing % 15 == 0, "spire spacing must align with ethereal steps");
    let layers: u32 = (layout.max_layer / layout.layer_distance).into();
    let capacity = 1 + 3 * layers * (layers + 1);
    assert!(layout.count.into() <= capacity, "spire count exceeds lattice");
}

pub fn location(center: Coord, layout: SpireLayout, ordinal: u32) -> Coord {
    assert!(ordinal < layout.count.into(), "spire index outside layout");
    if ordinal == 0 {
        return center;
    }
    let mut remaining = ordinal - 1;
    let mut layer = 1;
    while remaining >= 6 * layer {
        remaining -= 6 * layer;
        layer += 1;
    }
    let side: u8 = (remaining % 6).try_into().unwrap();
    let point = remaining / 6;
    let spacing: u32 = Into::<u8, u32>::into(layout.base_distance) * layout.layer_distance.into();
    let start = crate::geometry::neighbor_at_distance(center, side, spacing * layer);
    crate::geometry::neighbor_at_distance(start, (side + 2) % 6, spacing * point)
}
