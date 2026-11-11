//! What the renderer knows of the land beyond its meshes: a map of the ground's height and of the distance to the
//! shore, read off the ground mesh once, and a tile of ground detail made from noise. Shaders sample both; the cast
//! is placed with the map.

use std::collections::HashMap;

use glam::{Mat4, Vec2, Vec3};

use crate::scene::{Kind, Snapshot, VERTEX_FLOATS};

pub const MAP_SIZE: usize = 512;
pub const DETAIL_SIZE: usize = 256;
/// How far from the shore, in world units, the map still tells the distance.
const SHORE_REACH: f32 = 4.0;
const SEA_BED: f32 = -0.6;

/// What the ground of a biome is made of, as `mesh.wgsl` shades it.
#[derive(Clone, Copy, PartialEq)]
pub enum Ground {
    Water,
    Sand,
    Snow,
    Tundra,
    Rock,
    Lava,
    Grass,
    Forest,
    /// The ground of the Ethereal layers, under the surface.
    Ethereal,
}

impl Ground {
    fn of(biome: &str) -> Ground {
        match biome {
            "DeepOcean" | "Ocean" => Ground::Water,
            "Beach" | "SubtropicalDesert" | "TemperateDesert" => Ground::Sand,
            "Snow" => Ground::Snow,
            "Tundra" => Ground::Tundra,
            "Bare" => Ground::Rock,
            "Scorched" => Ground::Lava,
            "Underground" => Ground::Ethereal,
            "Grassland" | "Shrubland" => Ground::Grass,
            _ => Ground::Forest,
        }
    }
}

/// How well a hex is known: explored, next to explored land and so the next to explore, or deep in the unknown.
#[derive(Clone, Copy, PartialEq)]
pub enum Known {
    Explored,
    Frontier,
    Unknown,
}

/// The game's biomes in the order `globals.wgsl` numbers them; one it does not name is drawn as the last forest.
const BIOMES: [&str; 17] = [
    "DeepOcean",
    "Ocean",
    "Beach",
    "SubtropicalDesert",
    "TropicalRainForest",
    "TropicalSeasonalForest",
    "Grassland",
    "TemperateDesert",
    "TemperateRainForest",
    "TemperateDeciduousForest",
    "Shrubland",
    "Bare",
    "Taiga",
    "Tundra",
    "Snow",
    "Scorched",
    "Underground",
];

fn biome_number(name: &str) -> u8 {
    BIOMES.iter().position(|biome| *biome == name).unwrap_or(9) as u8
}

pub struct Hex {
    pub at: Vec2,
    pub ground: Ground,
    /// The biome's place in `BIOMES`.
    pub biome: u8,
    /// Whether a building stands on it, or may: the land's props keep off it.
    pub built: bool,
    /// Whether it is a realm's open plot, which the ground outlines.
    pub plot: bool,
    pub colour: [f32; 3],
    pub known: Known,
}

/// How deep into the unknown, in world units, the map still tells the distance from known land.
const UNKNOWN_REACH: f32 = 4.0;

pub struct World {
    /// The rectangle of ground the map covers: its west and north edge, its width and depth.
    pub bounds: [f32; 4],
    pub water_level: f32,
    pub hexes: Vec<Hex>,
    height: Vec<f32>,
    /// Positive on land, negative on water: the distance to the shore.
    shore: Vec<f32>,
    /// The nearest hex to every cell.
    nearest: Vec<Option<usize>>,
    /// Positive in the unknown: the distance from known land.
    unknown: Vec<f32>,
}

impl World {
    pub fn read(snapshot: &Snapshot, buffer: &[u8], hex_spacing: f32) -> World {
        let floats: &[f32] = snapshot.floats(buffer);
        let ground = triangles(snapshot, floats, Kind::Ground);
        let water = triangles(snapshot, floats, Kind::Water);
        let hexes = read_hexes(snapshot, floats, hex_spacing);
        let water_level = if water.is_empty() {
            f32::MIN
        } else {
            water.iter().flatten().map(|corner| corner.y).sum::<f32>() / (water.len() * 3) as f32
        };
        let bounds = bounds_of(&ground, &hexes, hex_spacing);
        let nearest = nearest_hexes(&hexes, bounds, hex_spacing);
        let mut height = vec![f32::MIN; MAP_SIZE * MAP_SIZE];
        for triangle in &ground {
            rasterise(&mut height, bounds, triangle);
        }
        let mut wet = vec![false; MAP_SIZE * MAP_SIZE];
        for triangle in &water {
            cover(bounds, triangle, |cell, _| wet[cell] = true);
        }
        for (cell, height) in height.iter_mut().enumerate() {
            if *height == f32::MIN {
                // No ground was drawn here: it is sea bed, or land nobody has seen yet, which lies flat.
                let unseen_land =
                    nearest[cell].is_some_and(|hex| hexes[hex].ground != Ground::Water);
                *height = if unseen_land { 0.0 } else { SEA_BED };
                wet[cell] = !unseen_land;
            }
            wet[cell] = wet[cell] && *height <= water_level + 0.01;
        }
        let texel = bounds[2] / MAP_SIZE as f32;
        let shore = signed_distance(&wet, texel, SHORE_REACH);
        let known: Vec<bool> = nearest
            .iter()
            .map(|hex| hex.is_some_and(|hex| hexes[hex].known == Known::Explored))
            .collect();
        let unknown = signed_distance(&known, texel, UNKNOWN_REACH);
        World {
            bounds,
            water_level,
            hexes,
            height,
            shore,
            nearest,
            unknown,
        }
    }

    /// The hex a point of the ground lies in.
    pub fn hex_at(&self, x: f32, z: f32) -> Option<&Hex> {
        let (u, v) = self.cell(x, z);
        self.nearest[v * MAP_SIZE + u].map(|hex| &self.hexes[hex])
    }

    /// What the shaders read of the land's features, four bytes a cell: the biome with how well the hex is
    /// known, the distance into the unknown (half way up the byte at its edge, lower over known land), and
    /// whether the hex is a realm's open plot.
    pub fn feature_texels(&self) -> Vec<u8> {
        let byte = |share: f32| (share.clamp(0.0, 1.0) * 255.0) as u8;
        (0..MAP_SIZE * MAP_SIZE)
            .flat_map(|cell| {
                let (biome, known, plot) =
                    self.nearest[cell].map_or((0, Known::Unknown, false), |hex| {
                        let hex = &self.hexes[hex];
                        (hex.biome, hex.known, hex.plot)
                    });
                [
                    biome * 4 + known as u8,
                    byte(0.5 + self.unknown[cell] / UNKNOWN_REACH * 0.5),
                    if plot { 255 } else { 0 },
                    0,
                ]
            })
            .collect()
    }

    /// The colour the game's palette gives the ground of every cell's hex.
    pub fn palette_texels(&self) -> Vec<u8> {
        (0..MAP_SIZE * MAP_SIZE)
            .flat_map(|cell| {
                let [r, g, b] = self.nearest[cell].map_or([0.0; 3], |hex| self.hexes[hex].colour);
                // The palette's colours are linear light; a byte holds them as the eye sees them.
                [r, g, b, 1.0]
                    .map(|value: f32| (value.clamp(0.0, 1.0).powf(1.0 / 2.2) * 255.0) as u8)
            })
            .collect()
    }

    fn cell(&self, x: f32, z: f32) -> (usize, usize) {
        let u = ((x - self.bounds[0]) / self.bounds[2] * MAP_SIZE as f32) as isize;
        let v = ((z - self.bounds[1]) / self.bounds[3] * MAP_SIZE as f32) as isize;
        (
            u.clamp(0, MAP_SIZE as isize - 1) as usize,
            v.clamp(0, MAP_SIZE as isize - 1) as usize,
        )
    }

    pub fn height_at(&self, x: f32, z: f32) -> f32 {
        let (u, v) = self.cell(x, z);
        self.height[v * MAP_SIZE + u]
    }

    /// The distance to the shore: positive on land.
    pub fn shore_at(&self, x: f32, z: f32) -> f32 {
        let (u, v) = self.cell(x, z);
        self.shore[v * MAP_SIZE + u]
    }

    /// The map as half floats, four to a texel: height, shore distance, and two spare.
    pub fn texels(&self) -> Vec<u16> {
        self.height
            .iter()
            .zip(&self.shore)
            .flat_map(|(&height, &shore)| [half(height), half(shore), 0, half(1.0)])
            .collect()
    }
}

fn triangles(snapshot: &Snapshot, floats: &[f32], kind: Kind) -> Vec<[Vec3; 3]> {
    let mut found = Vec::new();
    for mesh in snapshot.meshes.iter().filter(|mesh| mesh.kind == kind) {
        let placed =
            Mat4::from_cols_slice(&floats[mesh.instance_offset..mesh.instance_offset + 16]);
        let corner = |index: f32| {
            let at = mesh.vertex_offset + index.to_bits() as usize * VERTEX_FLOATS;
            placed.transform_point3(Vec3::new(floats[at], floats[at + 1], floats[at + 2]))
        };
        for face in floats[mesh.index_offset..mesh.index_offset + mesh.index_count].chunks_exact(3)
        {
            found.push([corner(face[0]), corner(face[1]), corner(face[2])]);
        }
    }
    found
}

/// The land's hexes, each marked explored, the next to explore, or unknown.
fn read_hexes(snapshot: &Snapshot, floats: &[f32], hex_spacing: f32) -> Vec<Hex> {
    let record = &snapshot.hexes;
    let rows = floats[record.offset..record.offset + record.count * 4].chunks_exact(4);
    let explored: Vec<Vec2> = rows
        .clone()
        .filter(|row| row[3] > 0.5)
        .map(|row| Vec2::new(row[0], row[1]))
        .collect();
    rows.map(|row| {
        let at = Vec2::new(row[0], row[1]);
        let biome = &record.biomes[row[2] as usize];
        let beside_explored = || {
            explored
                .iter()
                .any(|other| (*other - at).length() < hex_spacing * 1.2)
        };
        Hex {
            at,
            ground: Ground::of(&biome.name),
            biome: biome_number(&biome.name),
            built: row[3] > 1.5,
            plot: row[3] > 2.5,
            colour: biome.colour,
            known: if row[3] > 0.5 {
                Known::Explored
            } else if beside_explored() {
                Known::Frontier
            } else {
                Known::Unknown
            },
        }
    })
    .collect()
}

/// The rectangle of ground the map covers: all the ground drawn and every hex, with a margin.
fn bounds_of(triangles: &[[Vec3; 3]], hexes: &[Hex], hex_spacing: f32) -> [f32; 4] {
    let (mut low, mut high) = (Vec2::splat(f32::MAX), Vec2::splat(f32::MIN));
    let corners = triangles
        .iter()
        .flatten()
        .map(|corner| Vec2::new(corner.x, corner.z));
    for at in corners.chain(hexes.iter().map(|hex| hex.at)) {
        low = low.min(at);
        high = high.max(at);
    }
    if low.x > high.x {
        return [0.0, 0.0, 1.0, 1.0];
    }
    let margin = hex_spacing.max(1.0);
    [
        low.x - margin,
        low.y - margin,
        high.x - low.x + margin * 2.0,
        high.y - low.y + margin * 2.0,
    ]
}

/// The nearest hex to every cell of the map; none where the nearest is further than a hex away.
fn nearest_hexes(hexes: &[Hex], bounds: [f32; 4], hex_spacing: f32) -> Vec<Option<usize>> {
    let bucket = |at: Vec2| {
        (
            (at.x / hex_spacing).floor() as i32,
            (at.y / hex_spacing).floor() as i32,
        )
    };
    let mut buckets: HashMap<(i32, i32), Vec<usize>> = HashMap::new();
    for (index, hex) in hexes.iter().enumerate() {
        buckets.entry(bucket(hex.at)).or_default().push(index);
    }
    (0..MAP_SIZE * MAP_SIZE)
        .map(|cell| {
            let at = Vec2::new(
                bounds[0] + ((cell % MAP_SIZE) as f32 + 0.5) / MAP_SIZE as f32 * bounds[2],
                bounds[1] + ((cell / MAP_SIZE) as f32 + 0.5) / MAP_SIZE as f32 * bounds[3],
            );
            let (bu, bv) = bucket(at);
            let around = (-1..=1).flat_map(|dv| (-1..=1).map(move |du| (bu + du, bv + dv)));
            around
                .filter_map(|key| buckets.get(&key))
                .flatten()
                .map(|hex| (*hex, (hexes[*hex].at - at).length()))
                // The nearest middle within a hex's own corners: beyond the hexes named there is no hex.
                .filter(|(_, distance)| *distance < hex_spacing * 0.58)
                .min_by(|a, b| a.1.total_cmp(&b.1))
                .map(|(hex, _)| hex)
        })
        .collect()
}

/// Writes the triangle's height into every cell whose middle it covers, keeping the highest.
fn rasterise(height: &mut [f32], bounds: [f32; 4], triangle: &[Vec3; 3]) {
    cover(bounds, triangle, |cell, level| {
        height[cell] = height[cell].max(level)
    });
}

fn cover(bounds: [f32; 4], triangle: &[Vec3; 3], mut write: impl FnMut(usize, f32)) {
    let size = MAP_SIZE as f32;
    let on_map = |corner: Vec3| {
        (
            (corner.x - bounds[0]) / bounds[2] * size,
            (corner.z - bounds[1]) / bounds[3] * size,
        )
    };
    let [a, b, c] = triangle.map(on_map);
    let area = (b.0 - a.0) * (c.1 - a.1) - (b.1 - a.1) * (c.0 - a.0);
    if area.abs() < 1e-9 {
        return;
    }
    let span = |low: f32, high: f32| {
        (low.floor().max(0.0) as usize)..=(high.ceil().min(size - 1.0).max(0.0) as usize)
    };
    for v in span(a.1.min(b.1).min(c.1), a.1.max(b.1).max(c.1)) {
        for u in span(a.0.min(b.0).min(c.0), a.0.max(b.0).max(c.0)) {
            let (x, y) = (u as f32 + 0.5, v as f32 + 0.5);
            let wa = ((b.0 - x) * (c.1 - y) - (b.1 - y) * (c.0 - x)) / area;
            let wb = ((c.0 - x) * (a.1 - y) - (c.1 - y) * (a.0 - x)) / area;
            let wc = 1.0 - wa - wb;
            // A little slack closes the seams between triangles.
            if wa >= -0.02 && wb >= -0.02 && wc >= -0.02 {
                write(
                    v * MAP_SIZE + u,
                    wa * triangle[0].y + wb * triangle[1].y + wc * triangle[2].y,
                );
            }
        }
    }
}

/// The distance from every cell to the nearest cell of the other kind, by two sweeps, never told further than
/// `reach`: negative where the cell is marked.
fn signed_distance(wet: &[bool], texel: f32, reach: f32) -> Vec<f32> {
    let to = |target: bool| {
        let far = reach / texel;
        let mut distance: Vec<f32> = wet
            .iter()
            .map(|&cell| if cell == target { 0.0 } else { far })
            .collect();
        let size = MAP_SIZE as isize;
        let relax =
            |distance: &mut Vec<f32>, u: isize, v: isize, du: isize, dv: isize, cost: f32| {
                let (nu, nv) = (u + du, v + dv);
                if nu >= 0 && nv >= 0 && nu < size && nv < size {
                    let near = distance[(nv * size + nu) as usize] + cost;
                    let here = &mut distance[(v * size + u) as usize];
                    *here = here.min(near);
                }
            };
        for v in 0..size {
            for u in 0..size {
                relax(&mut distance, u, v, -1, 0, 1.0);
                relax(&mut distance, u, v, 0, -1, 1.0);
                relax(&mut distance, u, v, -1, -1, 1.414);
                relax(&mut distance, u, v, 1, -1, 1.414);
            }
        }
        for v in (0..size).rev() {
            for u in (0..size).rev() {
                relax(&mut distance, u, v, 1, 0, 1.0);
                relax(&mut distance, u, v, 0, 1, 1.0);
                relax(&mut distance, u, v, 1, 1, 1.414);
                relax(&mut distance, u, v, -1, 1, 1.414);
            }
        }
        distance
    };
    let (to_water, to_land) = (to(true), to(false));
    wet.iter()
        .enumerate()
        .map(|(cell, &is_wet)| {
            if is_wet {
                -to_land[cell] * texel
            } else {
                to_water[cell] * texel
            }
        })
        .collect()
}

/// A 32-bit float as a 16-bit one.
fn half(value: f32) -> u16 {
    let bits = value.to_bits();
    let sign = ((bits >> 16) & 0x8000) as u16;
    let exponent = ((bits >> 23) & 0xff) as i32 - 127 + 15;
    let mantissa = bits & 0x007f_ffff;
    if exponent <= 0 {
        return sign;
    }
    if exponent >= 31 {
        return sign | 0x7bff;
    }
    sign | ((exponent as u16) << 10) | (mantissa >> 13) as u16
}

fn lattice(x: i32, y: i32, period: i32, salt: u32) -> (f32, f32) {
    let (x, y) = (x.rem_euclid(period) as u32, y.rem_euclid(period) as u32);
    let mut state =
        x.wrapping_mul(0x9e37_79b1) ^ y.wrapping_mul(0x85eb_ca77) ^ salt.wrapping_mul(0xc2b2_ae3d);
    state ^= state >> 15;
    state = state.wrapping_mul(0x2c1b_3c6d);
    state ^= state >> 12;
    let other = state.wrapping_mul(0x297a_2d39) ^ (state >> 15);
    (
        (state & 0xffff) as f32 / 65_535.0,
        (other & 0xffff) as f32 / 65_535.0,
    )
}

/// Smooth noise that repeats every `period` cells.
fn tiling_noise(x: f32, y: f32, period: i32, salt: u32) -> f32 {
    let (cx, cy) = (x.floor(), y.floor());
    let (fx, fy) = (x - cx, y - cy);
    let (ux, uy) = (fx * fx * (3.0 - 2.0 * fx), fy * fy * (3.0 - 2.0 * fy));
    let at = |dx: i32, dy: i32| lattice(cx as i32 + dx, cy as i32 + dy, period, salt).0;
    let top = at(0, 0) + (at(1, 0) - at(0, 0)) * ux;
    let bottom = at(0, 1) + (at(1, 1) - at(0, 1)) * ux;
    top + (bottom - top) * uy
}

/// How far a point is from the edge of its cell of a scatter of stones that repeats every `period` cells, and a
/// number that names the stone.
fn tiling_stones(x: f32, y: f32, period: i32, salt: u32) -> (f32, f32) {
    let (cx, cy) = (x.floor() as i32, y.floor() as i32);
    let (mut nearest, mut second, mut name) = (f32::MAX, f32::MAX, 0.0);
    for dy in -1..=1 {
        for dx in -1..=1 {
            let (jx, jy) = lattice(cx + dx, cy + dy, period, salt);
            let (px, py) = (
                (cx + dx) as f32 + 0.15 + jx * 0.7,
                (cy + dy) as f32 + 0.15 + jy * 0.7,
            );
            let distance = ((px - x).powi(2) + (py - y).powi(2)).sqrt();
            if distance < nearest {
                second = nearest;
                nearest = distance;
                name = jx;
            } else if distance < second {
                second = distance;
            }
        }
    }
    (second - nearest, name)
}

/// The ground's detail as a tile that repeats, with its smaller copies. Red: the height of its stones, low in the
/// cracks between them. Green: a grain. Blue and alpha: the stones' slope east and south, round 0.5.
pub fn detail_tile() -> Vec<u8> {
    let size = DETAIL_SIZE;
    let stones = |u: f32, v: f32| {
        let (edge, name) = tiling_stones(u * 9.0, v * 9.0, 9, 3);
        let (fine, _) = tiling_stones(u * 23.0, v * 23.0, 23, 7);
        let crack = (edge * 4.5).clamp(0.0, 1.0).powf(0.6);
        crack * (0.72 + name * 0.28) * (0.85 + (fine * 3.0).clamp(0.0, 1.0) * 0.15)
    };
    let grain = |u: f32, v: f32| {
        tiling_noise(u * 8.0, v * 8.0, 8, 11) * 0.5
            + tiling_noise(u * 24.0, v * 24.0, 24, 13) * 0.3
            + tiling_noise(u * 56.0, v * 56.0, 56, 17) * 0.2
    };
    let mut level = Vec::with_capacity(size * size * 4);
    let step = 1.0 / size as f32;
    for y in 0..size {
        for x in 0..size {
            let (u, v) = (x as f32 * step, y as f32 * step);
            let height = stones(u, v);
            let east = stones(u + step, v) - stones(u - step, v);
            let south = stones(u, v + step) - stones(u, v - step);
            let byte = |value: f32| (value.clamp(0.0, 1.0) * 255.0) as u8;
            level.extend_from_slice(&[
                byte(height),
                byte(grain(u, v)),
                byte(0.5 + east * 2.0),
                byte(0.5 + south * 2.0),
            ]);
        }
    }
    with_smaller_copies(level, size)
}

pub fn detail_levels() -> u32 {
    levels_of(DETAIL_SIZE)
}

/// How many copies a square texture of that size has, itself and each half its size down to one texel.
pub fn levels_of(size: usize) -> u32 {
    size.trailing_zeros() + 1
}

/// A square texture of four bytes a texel, followed by each smaller copy of it, down to one texel.
pub fn with_smaller_copies(mut texels: Vec<u8>, size: usize) -> Vec<u8> {
    let (mut from, mut size) = (0, size);
    while size > 1 {
        let half = size / 2;
        let mut smaller = Vec::with_capacity(half * half * 4);
        for y in 0..half {
            for x in 0..half {
                for channel in 0..4 {
                    let at = |dx: usize, dy: usize| {
                        texels[from + ((y * 2 + dy) * size + x * 2 + dx) * 4 + channel] as u32
                    };
                    smaller.push(((at(0, 0) + at(1, 0) + at(0, 1) + at(1, 1)) / 4) as u8);
                }
            }
        }
        from = texels.len();
        texels.extend_from_slice(&smaller);
        size = half;
    }
    texels
}

/// The water's detail as a tile that repeats. Red and green: the slope of its ripples east and south, round 0.5.
/// Blue: a raggedness for its foam. Alpha: the bright net light casts on a shallow bed.
pub fn wave_tile() -> Vec<u8> {
    let size = DETAIL_SIZE;
    let ripples = |u: f32, v: f32| {
        tiling_noise(u * 6.0, v * 6.0, 6, 21) * 0.55
            + tiling_noise(u * 13.0, v * 13.0, 13, 23) * 0.3
            + tiling_noise(u * 29.0, v * 29.0, 29, 27) * 0.15
    };
    let mut level = Vec::with_capacity(size * size * 4);
    let step = 1.0 / size as f32;
    for y in 0..size {
        for x in 0..size {
            let (u, v) = (x as f32 * step, y as f32 * step);
            let east = ripples(u + step, v) - ripples(u - step, v);
            let south = ripples(u, v + step) - ripples(u, v - step);
            let ragged = tiling_noise(u * 10.0, v * 10.0, 10, 31) * 0.6
                + tiling_noise(u * 37.0, v * 37.0, 37, 33) * 0.4;
            let (edge, _) = tiling_stones(u * 7.0 + ripples(u, v) * 0.6, v * 7.0, 7, 37);
            let net = (1.0 - edge * 5.0).clamp(0.0, 1.0).powi(3);
            let byte = |value: f32| (value.clamp(0.0, 1.0) * 255.0) as u8;
            level.extend_from_slice(&[
                byte(0.5 + east * 9.0),
                byte(0.5 + south * 9.0),
                byte(ragged),
                byte(net),
            ]);
        }
    }
    with_smaller_copies(level, size)
}
