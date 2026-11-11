//! What grows and flies over the land by rule, beyond what the game's scene held: tufts of grass thick on grassland
//! and thin under trees, companions round every tree of a forest so it stands as a wood, and birds wheeling over
//! the woods and the shore.

use glam::{Mat4, Quat, Vec2, Vec3};
use std::f32::consts::TAU;

use crate::scene::{Kind, MeshRecord, Snapshot, INSTANCE_FLOATS, VERTEX_FLOATS};
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
}

fn instance(at: Vec3, turn: f32, scale: Vec3, tint: Colour, lot: f32) -> [f32; INSTANCE_FLOATS] {
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

/// Whether anything may grow at a point: on explored land, off the roads, the river's bed and the shore's wet sand.
fn grows(world: &World, at: Vec2) -> Option<Ground> {
    let hex = world.hex_at(at.x, at.y)?;
    let open = hex.known == Known::Explored
        && world.shore_at(at.x, at.y) > 0.2
        && world.river_at(at.x, at.y) > 0.32
        && world.road_at(at.x, at.y) > 0.2;
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
        let share = match grows(world, at) {
            Some(Ground::Grass) => 0.85,
            Some(Ground::Forest) => 0.4,
            Some(Ground::Tundra) => 0.12,
            Some(Ground::Sand) => 0.025,
            _ => 0.0,
        };
        // Tufts stand in drifts: thick here, thin there.
        let drift = 0.45 + hash(Vec3::new((at.x * 0.7).floor(), 1.9, (at.y * 0.7).floor())) * 0.9;
        if hash(lot * 7.7) >= share * drift {
            continue;
        }
        let hex = world
            .hex_at(at.x, at.y)
            .expect("a point where something grows is in a hex");
        let shade = 0.75 + hash(lot * 9.1) * 0.6;
        // A tuft is the ground's own colour, greener and brighter.
        let [red, green, blue] = hex.colour;
        let tint = [red * 1.5 * shade, green * 1.9 * shade, blue * 1.2 * shade];
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
    }
}

pub fn scatter(world: &World) -> Vec<Scattered> {
    let mut all = tufts(world);
    all.push(birds(world));
    all.retain(|scattered| !scattered.instances.is_empty());
    all
}

/// The companions a mesh of the game's scene gains: round every tree that stands in a forest, two or three more of
/// it, smaller, so the forest's hexes read as a wood and not as a tree each.
pub fn companions(
    snapshot: &Snapshot,
    buffer: &[u8],
    world: &World,
    record: &MeshRecord,
) -> Vec<f32> {
    let floats: &[f32] = snapshot.floats(buffer);
    let vertices =
        &floats[record.vertex_offset..record.vertex_offset + record.vertex_count * VERTEX_FLOATS];
    let tall = vertices
        .chunks_exact(VERTEX_FLOATS)
        .map(|vertex| vertex[1])
        .fold(0.0, f32::max);
    // Trees only: a shrub, a log or a rock stands alone.
    if record.kind != Kind::Plant || tall < 0.45 {
        return Vec::new();
    }
    let instances = &floats
        [record.instance_offset..record.instance_offset + record.instance_count * INSTANCE_FLOATS];
    let mut added = Vec::new();
    for placed in instances.chunks_exact(INSTANCE_FLOATS) {
        let tree = Mat4::from_cols_slice(&placed[..16]);
        let foot = tree.w_axis.truncate();
        let in_forest = world
            .hex_at(foot.x, foot.z)
            .is_some_and(|hex| hex.ground == Ground::Forest);
        if !in_forest {
            continue;
        }
        let lot = Vec3::new(foot.x, 3.1, foot.z);
        for companion in 0..2 + (hash(lot * 1.3) * 2.0) as usize {
            let own = lot + Vec3::splat(companion as f32 * 1.7);
            let turn = hash(own * 2.1) * TAU;
            let away = Vec2::new(turn.cos(), turn.sin()) * (0.32 + hash(own * 3.3) * 0.38);
            let at = Vec2::new(foot.x, foot.z) + away;
            if grows(world, at) != Some(Ground::Forest) {
                continue;
            }
            let moved = Mat4::from_translation(Vec3::new(at.x, world.height_at(at.x, at.y), at.y))
                * Mat4::from_rotation_y(hash(own * 4.7) * TAU)
                * Mat4::from_scale(Vec3::splat(0.62 + hash(own * 6.1) * 0.3))
                * Mat4::from_translation(-foot)
                * tree;
            let mut companion = [0.0; INSTANCE_FLOATS];
            companion[..16].copy_from_slice(&moved.to_cols_array());
            let shade = 0.82 + hash(own * 8.3) * 0.3;
            for channel in 0..3 {
                companion[16 + channel] = placed[16 + channel] * shade;
            }
            companion[19] = placed[19];
            added.extend_from_slice(&companion);
        }
    }
    added
}
