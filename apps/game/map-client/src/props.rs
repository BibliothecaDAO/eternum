//! The map's props, made by rule and not by a modeller: trees, rocks, plants and what lies on the shore, each a
//! shape built here from a few turned and squashed solids, and stood on the land by its biome. A prop that needs
//! a model later takes one in its shape's place; until then it is drawn as it is made here.

use std::collections::BTreeMap;
use std::f32::consts::TAU;

use glam::{Vec2, Vec3};

use crate::scatter::{instance, Scattered};
use crate::scene::Kind;
use crate::shapes::{hash, Colour, Paint, Shape};
use crate::world::{Hex, Known, World};

/// The side of the squares of ground the props are drawn by.
const CELL: f32 = 10.0;
/// How far from the eye a prop is still drawn: the tall ones, and the small ones.
const TALL_REACH: f32 = 90.0;
const SMALL_REACH: f32 = 30.0;

#[derive(Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
enum Prop {
    Broadleaf,
    Jungle,
    Conifer,
    Palm,
    Acacia,
    Dead,
    Bush,
    Fern,
    Cactus,
    Boulder,
    SnowRock,
    Reeds,
    Driftwood,
    Log,
}

const BARK: Colour = [0.2, 0.13, 0.08];
const PALE_BARK: Colour = [0.42, 0.34, 0.24];
const ROCK: Colour = [0.36, 0.35, 0.34];

fn v(x: f32, y: f32, z: f32) -> Vec3 {
    Vec3::new(x, y, z)
}

impl Prop {
    fn shape(self) -> Shape {
        let mut shape = Shape::default();
        let leaf = |colour: Colour| Paint::of(colour);
        match self {
            Prop::Broadleaf => {
                shape.limb(
                    v(0.0, 0.0, 0.0),
                    v(0.01, 0.3, 0.0),
                    0.04,
                    0.026,
                    5,
                    Paint::of(BARK),
                );
                let crown = [
                    (v(0.0, 0.5, 0.0), v(0.2, 0.17, 0.2), [0.2, 0.36, 0.1]),
                    (v(0.13, 0.4, 0.05), v(0.15, 0.12, 0.15), [0.16, 0.3, 0.08]),
                    (
                        v(-0.11, 0.42, -0.08),
                        v(0.15, 0.13, 0.14),
                        [0.24, 0.4, 0.12],
                    ),
                    (v(-0.02, 0.38, 0.13), v(0.13, 0.1, 0.13), [0.18, 0.33, 0.09]),
                ];
                for (centre, radii, colour) in crown {
                    shape.ball(centre, radii, 6, leaf(colour));
                }
            }
            Prop::Jungle => {
                // A tall trunk on buttress roots, a wide crown in two storeys, and lianas hanging from it.
                shape.limb(
                    v(0.0, 0.0, 0.0),
                    v(0.02, 0.62, 0.01),
                    0.05,
                    0.03,
                    5,
                    Paint::of(PALE_BARK),
                );
                for root in 0..3 {
                    let turn = root as f32 / 3.0 * TAU + 0.3;
                    let out = v(turn.cos(), 0.0, turn.sin());
                    shape.limb(
                        out * 0.12,
                        v(0.0, 0.16, 0.0),
                        0.022,
                        0.03,
                        4,
                        Paint::of(PALE_BARK),
                    );
                }
                let crown = [
                    (v(0.0, 0.72, 0.0), v(0.27, 0.17, 0.26), [0.08, 0.27, 0.09]),
                    (v(0.17, 0.64, -0.1), v(0.2, 0.13, 0.19), [0.06, 0.22, 0.07]),
                    (v(-0.18, 0.66, 0.12), v(0.19, 0.13, 0.18), [0.1, 0.31, 0.1]),
                    (v(0.03, 0.86, 0.04), v(0.16, 0.11, 0.16), [0.14, 0.38, 0.1]),
                    (v(-0.05, 0.6, -0.17), v(0.15, 0.1, 0.15), [0.05, 0.2, 0.08]),
                ];
                for (centre, radii, colour) in crown {
                    shape.ball(centre, radii, 6, leaf(colour));
                }
                for liana in 0..4 {
                    let turn = liana as f32 / 4.0 * TAU + 0.9;
                    let at = v(turn.cos() * 0.2, 0.62, turn.sin() * 0.2);
                    let down = 0.16 + (liana % 2) as f32 * 0.1;
                    shape.limb(
                        at,
                        at - v(0.0, down, 0.0),
                        0.006,
                        0.004,
                        3,
                        leaf([0.12, 0.3, 0.08]),
                    );
                }
            }
            Prop::Conifer => {
                shape.limb(
                    v(0.0, 0.0, 0.0),
                    v(0.0, 0.2, 0.0),
                    0.03,
                    0.022,
                    5,
                    Paint::of(BARK),
                );
                let tiers = [(0.12, 0.2, 0.26), (0.28, 0.16, 0.24), (0.44, 0.11, 0.22)];
                for (foot, wide, tall) in tiers {
                    shape.lathe(
                        v(0.0, foot, 0.0),
                        v(0.0, foot + tall, 0.0),
                        &[(0.0, 0.0), (0.0, wide), (tall, 0.0)],
                        7,
                        leaf([0.07, 0.2, 0.13]),
                    );
                }
            }
            Prop::Palm => {
                // A trunk that leans in three reaches, and fronds that arch out from its head and droop.
                let joints = [
                    v(0.0, 0.0, 0.0),
                    v(0.04, 0.2, 0.0),
                    v(0.11, 0.4, 0.01),
                    v(0.2, 0.56, 0.02),
                ];
                for reach in 0..3 {
                    let wide = 0.032 - reach as f32 * 0.005;
                    shape.limb(
                        joints[reach],
                        joints[reach + 1],
                        wide,
                        wide - 0.004,
                        5,
                        Paint::of(PALE_BARK),
                    );
                }
                let head = joints[3];
                for frond in 0..7 {
                    let turn = frond as f32 / 7.0 * TAU;
                    let out = v(turn.cos(), 0.0, turn.sin());
                    let across = v(-out.z, 0.0, out.x) * 0.045;
                    let (near, far) = (
                        head + out * 0.14 + v(0.0, 0.05, 0.0),
                        head + out * 0.32 - v(0.0, 0.08, 0.0),
                    );
                    let green = leaf([0.16, 0.36, 0.1]);
                    shape.face(
                        [
                            head - across * 0.4,
                            head + across * 0.4,
                            near + across,
                            near - across,
                        ],
                        green,
                    );
                    shape.face(
                        [
                            near - across,
                            near + across,
                            far + across * 0.2,
                            far - across * 0.2,
                        ],
                        green,
                    );
                }
            }
            Prop::Acacia => {
                // A forked trunk under a flat crown.
                shape.limb(
                    v(0.0, 0.0, 0.0),
                    v(0.0, 0.2, 0.0),
                    0.034,
                    0.026,
                    5,
                    Paint::of(BARK),
                );
                shape.limb(
                    v(0.0, 0.2, 0.0),
                    v(0.12, 0.38, 0.03),
                    0.024,
                    0.014,
                    4,
                    Paint::of(BARK),
                );
                shape.limb(
                    v(0.0, 0.2, 0.0),
                    v(-0.11, 0.36, -0.04),
                    0.024,
                    0.014,
                    4,
                    Paint::of(BARK),
                );
                shape.ball(
                    v(0.02, 0.43, 0.0),
                    v(0.3, 0.06, 0.26),
                    7,
                    leaf([0.3, 0.36, 0.1]),
                );
                shape.ball(
                    v(-0.08, 0.47, 0.05),
                    v(0.17, 0.045, 0.16),
                    6,
                    leaf([0.36, 0.42, 0.12]),
                );
            }
            Prop::Dead => {
                let ash = Paint::of([0.1, 0.09, 0.09]);
                shape.limb(v(0.0, 0.0, 0.0), v(0.02, 0.3, 0.0), 0.034, 0.018, 5, ash);
                let boughs = [
                    (v(0.01, 0.2, 0.0), v(0.16, 0.36, 0.04)),
                    (v(0.02, 0.26, 0.0), v(-0.13, 0.42, -0.05)),
                    (v(0.02, 0.3, 0.0), v(0.05, 0.5, 0.09)),
                    (v(0.16, 0.36, 0.04), v(0.24, 0.44, 0.0)),
                ];
                for (from, to) in boughs {
                    shape.limb(from, to, 0.014, 0.005, 4, ash);
                }
            }
            Prop::Bush => {
                shape.ball(
                    v(0.0, 0.07, 0.0),
                    v(0.11, 0.08, 0.1),
                    6,
                    leaf([0.2, 0.34, 0.12]),
                );
                shape.ball(
                    v(0.08, 0.05, 0.04),
                    v(0.08, 0.06, 0.08),
                    5,
                    leaf([0.16, 0.28, 0.1]),
                );
                shape.ball(
                    v(-0.07, 0.05, -0.03),
                    v(0.07, 0.055, 0.07),
                    5,
                    leaf([0.24, 0.38, 0.14]),
                );
            }
            Prop::Fern => {
                // Fronds that rise from one root and arch over to their tips.
                for frond in 0..7 {
                    let turn = frond as f32 / 7.0 * TAU + 0.2;
                    let out = v(turn.cos(), 0.0, turn.sin());
                    let across = v(-out.z, 0.0, out.x) * 0.03;
                    let (knee, tip) =
                        (out * 0.09 + v(0.0, 0.1, 0.0), out * 0.2 + v(0.0, 0.05, 0.0));
                    shape.face(
                        [-across * 0.3, across * 0.3, knee + across, knee - across],
                        leaf([0.12, 0.34, 0.1]),
                    );
                    shape.face(
                        [knee - across, knee + across, tip, tip],
                        leaf([0.2, 0.44, 0.14]),
                    );
                }
            }
            Prop::Cactus => {
                let green = leaf([0.2, 0.36, 0.16]);
                shape.limb(v(0.0, 0.0, 0.0), v(0.0, 0.3, 0.0), 0.04, 0.036, 6, green);
                shape.limb(
                    v(0.03, 0.14, 0.0),
                    v(0.1, 0.16, 0.0),
                    0.022,
                    0.022,
                    5,
                    green,
                );
                shape.limb(v(0.1, 0.16, 0.0), v(0.1, 0.26, 0.0), 0.022, 0.02, 5, green);
                shape.limb(
                    v(-0.03, 0.1, 0.0),
                    v(-0.09, 0.12, 0.0),
                    0.02,
                    0.02,
                    5,
                    green,
                );
                shape.limb(
                    v(-0.09, 0.12, 0.0),
                    v(-0.09, 0.2, 0.0),
                    0.02,
                    0.018,
                    5,
                    green,
                );
            }
            Prop::Boulder | Prop::SnowRock => {
                shape.ball(v(0.0, 0.06, 0.0), v(0.13, 0.1, 0.11), 5, Paint::of(ROCK));
                shape.ball(
                    v(0.1, 0.035, 0.05),
                    v(0.08, 0.06, 0.07),
                    5,
                    Paint::of([0.3, 0.29, 0.29]),
                );
                shape.ball(
                    v(-0.07, 0.03, -0.08),
                    v(0.06, 0.045, 0.06),
                    4,
                    Paint::of([0.42, 0.4, 0.38]),
                );
                if self == Prop::SnowRock {
                    shape.ball(
                        v(0.0, 0.13, 0.0),
                        v(0.11, 0.045, 0.09),
                        5,
                        Paint::of([0.86, 0.9, 0.96]),
                    );
                }
            }
            Prop::Reeds => {
                for stalk in 0..9 {
                    let lot = v(stalk as f32, 0.7, 2.1);
                    let foot = v(hash(lot * 1.3) - 0.5, 0.0, hash(lot * 2.7) - 0.5) * 0.14;
                    let lean = v(hash(lot * 3.9) - 0.5, 0.0, hash(lot * 5.1) - 0.5) * 0.06;
                    let tall = 0.16 + hash(lot * 7.3) * 0.12;
                    let across = v(0.008, 0.0, 0.004);
                    let tip = shape.point(foot + lean + v(0.0, tall, 0.0), leaf([0.5, 0.52, 0.24]));
                    let corners = [
                        shape.point(foot - across, leaf([0.22, 0.32, 0.12])),
                        shape.point(foot + across, leaf([0.22, 0.32, 0.12])),
                        tip,
                    ];
                    shape.triangle(corners);
                }
            }
            Prop::Driftwood => {
                let bleached = Paint::of([0.58, 0.52, 0.44]);
                shape.limb(
                    v(-0.16, 0.02, 0.0),
                    v(0.14, 0.035, 0.03),
                    0.022,
                    0.014,
                    5,
                    bleached,
                );
                shape.limb(
                    v(0.02, 0.03, 0.0),
                    v(0.1, 0.1, -0.06),
                    0.01,
                    0.005,
                    4,
                    bleached,
                );
            }
            Prop::Log => {
                shape.limb(
                    v(-0.14, 0.035, 0.0),
                    v(0.14, 0.035, 0.02),
                    0.035,
                    0.032,
                    6,
                    Paint::of(BARK),
                );
                shape.ball(
                    v(0.0, 0.075, 0.01),
                    v(0.07, 0.015, 0.03),
                    5,
                    leaf([0.2, 0.4, 0.12]),
                );
            }
        }
        shape
    }

    /// Whether the wind moves it.
    fn kind(self) -> Kind {
        match self {
            Prop::Boulder
            | Prop::SnowRock
            | Prop::Driftwood
            | Prop::Log
            | Prop::Cactus
            | Prop::Dead => Kind::Solid,
            _ => Kind::Plant,
        }
    }

    fn tall(self) -> bool {
        !matches!(self, Prop::Fern | Prop::Reeds | Prop::Driftwood | Prop::Log)
    }
}

/// What may stand on each of a hex's places round its middle, by its biome (`world::BIOMES`): each prop with the
/// share of places it takes, its least and greatest size, and a tint. The shares left over stay bare.
fn growth(biome: u8) -> &'static [(Prop, f32, [f32; 2], Colour)] {
    const PLAIN: Colour = [1.0, 1.0, 1.0];
    match biome {
        // Beach.
        2 => &[
            (Prop::Palm, 0.16, [0.9, 1.3], PLAIN),
            (Prop::Driftwood, 0.12, [0.8, 1.3], PLAIN),
            (Prop::Boulder, 0.06, [0.5, 0.9], [1.2, 1.15, 1.0]),
        ],
        // Subtropical desert.
        3 => &[
            (Prop::Cactus, 0.2, [0.8, 1.5], PLAIN),
            (Prop::Boulder, 0.14, [0.6, 1.4], [1.35, 1.1, 0.8]),
            (Prop::Bush, 0.08, [0.5, 0.8], [1.5, 1.2, 0.5]),
        ],
        // Tropical rain forest: the thickest growth on the map.
        4 => &[
            (Prop::Jungle, 0.36, [0.9, 1.4], PLAIN),
            (Prop::Fern, 0.26, [0.9, 1.6], PLAIN),
            (Prop::Palm, 0.08, [0.8, 1.1], [0.8, 1.0, 0.8]),
            (Prop::Bush, 0.1, [0.9, 1.4], [0.7, 1.1, 0.7]),
        ],
        // Tropical seasonal forest.
        5 => &[
            (Prop::Acacia, 0.3, [0.9, 1.4], PLAIN),
            (Prop::Bush, 0.14, [0.7, 1.1], [1.5, 1.2, 0.6]),
            (Prop::Boulder, 0.06, [0.6, 1.0], [1.3, 1.0, 0.8]),
        ],
        // Grassland.
        6 => &[
            (Prop::Broadleaf, 0.08, [0.9, 1.3], [1.1, 1.15, 0.9]),
            (Prop::Bush, 0.12, [0.6, 1.0], PLAIN),
            (Prop::Boulder, 0.04, [0.5, 0.9], PLAIN),
        ],
        // Temperate desert.
        7 => &[
            (Prop::Bush, 0.2, [0.5, 0.9], [1.4, 1.2, 0.7]),
            (Prop::Boulder, 0.18, [0.6, 1.5], [1.4, 1.0, 0.8]),
            (Prop::Dead, 0.05, [0.7, 1.0], [2.6, 2.0, 1.6]),
        ],
        // Temperate rain forest.
        8 => &[
            (Prop::Broadleaf, 0.3, [1.0, 1.5], [0.7, 0.95, 0.9]),
            (Prop::Conifer, 0.18, [1.0, 1.5], [0.9, 1.1, 1.0]),
            (Prop::Fern, 0.2, [0.8, 1.3], PLAIN),
            (Prop::Log, 0.05, [0.8, 1.2], PLAIN),
        ],
        // Temperate deciduous forest, in its autumn.
        9 => &[
            (Prop::Broadleaf, 0.2, [0.9, 1.4], [2.3, 1.0, 0.35]),
            (Prop::Broadleaf, 0.16, [0.9, 1.4], [2.0, 1.5, 0.4]),
            (Prop::Broadleaf, 0.1, [0.9, 1.3], PLAIN),
            (Prop::Log, 0.06, [0.8, 1.2], PLAIN),
            (Prop::Bush, 0.08, [0.6, 1.0], [1.8, 1.2, 0.5]),
        ],
        // Shrubland.
        10 => &[
            (Prop::Bush, 0.3, [0.6, 1.2], [1.3, 0.9, 1.2]),
            (Prop::Boulder, 0.1, [0.5, 1.1], PLAIN),
            (Prop::Dead, 0.03, [0.7, 1.0], [2.4, 2.0, 1.8]),
        ],
        // Bare.
        11 => &[
            (Prop::Boulder, 0.34, [0.7, 1.9], PLAIN),
            (Prop::Dead, 0.04, [0.7, 1.0], [2.0, 1.9, 1.8]),
        ],
        // Taiga.
        12 => &[
            (Prop::Conifer, 0.5, [0.9, 1.6], PLAIN),
            (Prop::SnowRock, 0.08, [0.6, 1.2], PLAIN),
            (Prop::Log, 0.04, [0.8, 1.1], PLAIN),
        ],
        // Tundra.
        13 => &[
            (Prop::SnowRock, 0.12, [0.5, 1.1], PLAIN),
            (Prop::Bush, 0.1, [0.4, 0.7], [1.2, 1.0, 0.7]),
            (Prop::Conifer, 0.04, [0.6, 0.9], PLAIN),
        ],
        // Snow.
        14 => &[
            (Prop::SnowRock, 0.12, [0.6, 1.4], PLAIN),
            (Prop::Conifer, 0.04, [0.7, 1.0], [1.6, 1.9, 2.2]),
        ],
        // Scorched.
        15 => &[
            (Prop::Dead, 0.16, [0.8, 1.3], PLAIN),
            (Prop::Boulder, 0.2, [0.6, 1.6], [0.35, 0.3, 0.3]),
        ],
        _ => &[],
    }
}

/// How many places for a prop a hex has round its middle, which stays clear for whoever stands on the hex.
const PLACES: usize = 9;

/// Where a hex's places are: a ring of six and a wider ring of three between them, each moved off its spot.
fn place(hex: &Hex, place: usize, hex_spacing: f32) -> Vec2 {
    let lot = Vec3::new(hex.at.x, place as f32 * 1.7 + 0.3, hex.at.y);
    let (ring, turn) = if place < 6 {
        (0.5, place as f32 / 6.0 * TAU)
    } else {
        (0.3, (place as f32 - 6.0) / 3.0 * TAU + 0.5)
    };
    let jitter = Vec2::new(hash(lot * 1.9) - 0.5, hash(lot * 3.1) - 0.5) * 0.16;
    hex.at + (Vec2::new(turn.cos(), turn.sin()) * ring + jitter) * hex_spacing * 0.5 * 1.1
}

/// Every prop on the land: on explored hexes that hold no building, off the water; and reeds along the shore,
/// whatever the biome.
pub fn props(world: &World, hex_spacing: f32) -> Vec<Scattered> {
    let mut stood: BTreeMap<(Prop, i32, i32), Vec<f32>> = BTreeMap::new();
    let mut stand = |prop: Prop, at: Vec2, size: f32, tint: Colour, lot: Vec3| {
        let ground = Vec3::new(at.x, world.height_at(at.x, at.y), at.y);
        let cell = ((at.x / CELL).floor() as i32, (at.y / CELL).floor() as i32);
        let shade = 0.85 + hash(lot * 9.7) * 0.3;
        stood
            .entry((prop, cell.0, cell.1))
            .or_default()
            .extend_from_slice(&instance(
                ground,
                hash(lot * 4.3) * TAU,
                Vec3::new(size, size * (0.9 + hash(lot * 6.1) * 0.25), size),
                tint.map(|channel| channel * shade),
                hash(lot * 8.9),
            ));
    };
    for hex in world
        .hexes
        .iter()
        .filter(|hex| hex.known == Known::Explored)
    {
        if hex.built {
            continue;
        }
        for spot in 0..PLACES {
            let at = place(hex, spot, hex_spacing);
            let lot = Vec3::new(at.x, 5.3, at.y);
            let shore = world.shore_at(at.x, at.y);
            // Reeds stand in the wet margin of any shore.
            if shore > -0.05 && shore < 0.3 && hash(lot * 2.3) < 0.45 {
                stand(Prop::Reeds, at, 0.8 + hash(lot * 3.7) * 0.6, [1.0; 3], lot);
                continue;
            }
            if shore < 0.3 {
                continue;
            }
            let mut drawn = hash(lot * 1.1);
            for (prop, share, [least, most], tint) in growth(hex.biome) {
                if drawn < *share {
                    stand(
                        *prop,
                        at,
                        least + (most - least) * hash(lot * 5.9),
                        *tint,
                        lot,
                    );
                    break;
                }
                drawn -= share;
            }
        }
    }
    stood
        .into_iter()
        .map(|((prop, column, row), instances)| Scattered {
            kind: prop.kind(),
            shape: prop.shape(),
            instances,
            centre: Vec3::new((column as f32 + 0.5) * CELL, 0.0, (row as f32 + 0.5) * CELL),
            radius: CELL,
            reach: if prop.tall() { TALL_REACH } else { SMALL_REACH },
            casts_shadow: prop.tall(),
        })
        .collect()
}
