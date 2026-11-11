//! What grows and flies over the land by rule: tufts of grass thick on grassland and thin under trees, the props of
//! every biome (`props.rs`), and birds wheeling over the woods and the shore.

use glam::{Mat4, Quat, Vec2, Vec3};
use std::f32::consts::TAU;

use crate::scene::{Kind, INSTANCE_FLOATS};
use crate::shapes::{hash, Colour, Paint, Shape};
use crate::world::{Ground, Known, World};

/// The side of the squares of ground the scatter is drawn by, each culled and dropped with distance on its own.
const CELL: f32 = 8.0;
const TUFT_SPACING: f32 = 0.13;
/// How far from the eye tufts are still drawn.
pub const TUFT_REACH: f32 = 26.0;

/// One mesh of the scatter over one square of ground.
pub struct Scattered {
    pub kind: Kind,
    pub shape: Shape,
    pub instances: Vec<f32>,
    /// Where its instances are, to cull it by, and how far from the eye it is still drawn.
    pub centre: Vec3,
    pub radius: f32,
    pub reach: f32,
    pub casts_shadow: bool,
}

pub fn instance(
    at: Vec3,
    turn: f32,
    scale: Vec3,
    tint: Colour,
    lot: f32,
) -> [f32; INSTANCE_FLOATS] {
    let placed = Mat4::from_scale_rotation_translation(scale, Quat::from_rotation_y(turn), at);
    let mut floats = [0.0; INSTANCE_FLOATS];
    floats[..16].copy_from_slice(&placed.to_cols_array());
    floats[16..19].copy_from_slice(&tint);
    floats[19] = lot;
    floats
}

/// Five blades from one root, each a single leaning triangle, dark at its foot and light at its tip.
fn tuft() -> Shape {
    let mut shape = Shape::default();
    let (foot, tip) = (Paint::of([0.36, 0.4, 0.26]), Paint::of([0.6, 0.68, 0.38]));
    for blade in 0..5 {
        let turn = blade as f32 / 5.0 * TAU + 0.4;
        let out = Vec3::new(turn.cos(), 0.0, turn.sin());
        let across = Vec3::new(-out.z, 0.0, out.x) * 0.011;
        let height = 0.05 + (blade % 3) as f32 * 0.02;
        let corners = [
            shape.point(out * 0.008 - across, foot),
            shape.point(out * 0.008 + across, foot),
            shape.point(out * (0.012 + height * 0.35) + Vec3::Y * height, tip),
        ];
        shape.triangle(corners);
    }
    shape
}

/// A bird seen from afar: two wings from a short body. `mesh.wgsl` flies it and beats its wings.
fn bird() -> Shape {
    let mut shape = Shape::default();
    let dark = Paint::of([0.06, 0.06, 0.07]);
    for side in [-1.0, 1.0] {
        let corners = [
            shape.point(Vec3::new(0.0, 0.0, 0.25), dark),
            shape.point(Vec3::new(side, 0.0, -0.1), dark),
            shape.point(Vec3::new(0.0, 0.0, -0.3), dark),
        ];
        shape.triangle(corners);
    }
    shape
}

/// Whether anything may grow at a point: on explored land, off the shore's wet sand.
fn grows(world: &World, at: Vec2) -> Option<Ground> {
    let hex = world.hex_at(at.x, at.y)?;
    let open = hex.known == Known::Explored && world.shore_at(at.x, at.y) > 0.2;
    open.then_some(hex.ground)
}

/// Tufts over the land, on a grid each point of which is moved off its place: as many as the ground's kind grows.
fn tufts(world: &World) -> Vec<Scattered> {
    let [west, north, width, depth] = world.bounds;
    let mut cells: std::collections::BTreeMap<(i32, i32), Vec<f32>> = Default::default();
    let (columns, rows) = (
        (width / TUFT_SPACING) as usize,
        (depth / TUFT_SPACING) as usize,
    );
    for point in 0..columns * rows {
        let on_grid = Vec2::new((point % columns) as f32, (point / columns) as f32) * TUFT_SPACING;
        let lot = Vec3::new(on_grid.x, 0.71, on_grid.y);
        let at = Vec2::new(west, north)
            + on_grid
            + Vec2::new(hash(lot * 3.3), hash(lot * 5.9)) * TUFT_SPACING;
        if matches!(grows(world, at), None | Some(Ground::Lava)) {
            continue;
        }
        // A tuft is of the ground a little way off, so growth spills over a frontier and thins out beyond it.
        let spill = Vec2::new(hash(lot * 11.3) - 0.5, hash(lot * 13.7) - 0.5) * 1.5;
        let Some(hex) = world
            .hex_at(at.x + spill.x, at.y + spill.y)
            .filter(|hex| hex.known == Known::Explored)
        else {
            continue;
        };
        // How thick each biome grows, and how dry its growth is.
        let (share, dry) = match hex.biome {
            6 => (0.85, 0.0),
            10 => (0.5, 0.7),
            4 => (0.6, 0.0),
            5 => (0.42, 0.6),
            8 => (0.5, 0.0),
            9 => (0.32, 0.3),
            12 => (0.2, 0.2),
            13 => (0.12, 0.5),
            3 | 7 => (0.03, 1.0),
            2 => (0.02, 0.6),
            _ => (0.0, 0.0),
        };
        // Tufts stand in drifts: thick here, thin there.
        let drift = 0.45 + hash(Vec3::new((at.x * 0.7).floor(), 1.9, (at.y * 0.7).floor())) * 0.9;
        if hash(lot * 7.7) >= share * drift {
            continue;
        }
        let shade = 0.75 + hash(lot * 9.1) * 0.6;
        // A tuft is the ground's own colour, greener and brighter; a dry one is straw.
        let [red, green, blue] = hex.colour;
        let fresh = [red * 1.5, green * 1.9, blue * 1.2];
        let straw = [0.62, 0.5, 0.2];
        let tint =
            [0, 1, 2].map(|channel| (fresh[channel] * (1.0 - dry) + straw[channel] * dry) * shade);
        let size = 0.7 + hash(lot * 4.3) * 0.8;
        let ground = Vec3::new(at.x, world.height_at(at.x, at.y), at.y);
        let cell = ((at.x / CELL).floor() as i32, (at.y / CELL).floor() as i32);
        cells.entry(cell).or_default().extend_from_slice(&instance(
            ground,
            hash(lot * 2.3) * TAU,
            Vec3::splat(size),
            tint,
            1.0,
        ));
    }
    cells
        .into_iter()
        .map(|((column, row), instances)| Scattered {
            kind: Kind::Plant,
            shape: tuft(),
            instances,
            centre: Vec3::new((column as f32 + 0.5) * CELL, 0.0, (row as f32 + 0.5) * CELL),
            radius: CELL,
            reach: TUFT_REACH,
            casts_shadow: false,
        })
        .collect()
}

/// Flocks of a few birds, each wheeling over a hex of forest or of water near the shore.
fn birds(world: &World) -> Scattered {
    let mut instances = Vec::new();
    for hex in world
        .hexes
        .iter()
        .filter(|hex| hex.known == Known::Explored)
    {
        let lot = Vec3::new(hex.at.x, 2.3, hex.at.y);
        let over_shore = hex.ground == Ground::Water && world.shore_at(hex.at.x, hex.at.y) > -2.5;
        let chance = if hex.ground == Ground::Forest || over_shore {
            0.16
        } else {
            0.03
        };
        if hash(lot * 1.1) >= chance {
            continue;
        }
        for bird in 0..3 + (hash(lot * 3.7) * 4.0) as usize {
            let own = lot + Vec3::splat(bird as f32);
            let height = 2.2 + hash(own * 2.9) * 1.6;
            // `mesh.wgsl` reads a bird's circle off its placement: its middle, and its radius as the placement's size.
            instances.extend_from_slice(&instance(
                Vec3::new(hex.at.x, height, hex.at.y),
                0.0,
                Vec3::splat(0.8 + hash(own * 5.1) * 1.4),
                [1.0; 3],
                hash(own * 7.3),
            ));
        }
    }
    let [west, north, width, depth] = world.bounds;
    Scattered {
        kind: Kind::Bird,
        shape: bird(),
        instances,
        centre: Vec3::new(west + width / 2.0, 0.0, north + depth / 2.0),
        radius: width.max(depth),
        reach: f32::MAX,
        casts_shadow: false,
    }
}

pub fn scatter(world: &World, hex_spacing: f32) -> Vec<Scattered> {
    let mut all = tufts(world);
    all.push(birds(world));
    all.extend(crate::props::props(world, hex_spacing));
    all.retain(|scattered| !scattered.instances.is_empty());
    all
}
