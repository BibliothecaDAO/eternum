//! A figure's vertex and measures as `unit.wgsl` reads them, and small meshes built in code.

use glam::Vec3;

pub type Colour = [f32; 3];

/// A figure's vertex, as `unit.wgsl` reads it.
pub const RIG_FLOATS: usize = 21;

/// A vertex hung on one bone, or shared between two.
#[derive(Clone, Copy)]
pub struct RigVertex {
    /// Relative to its bone's joint, in the bone's own frame.
    pub at: Vec3,
    pub normal: Vec3,
    pub paint: Paint,
    /// How far along a cloth from its pinned edge, 0 to 1; 0 for everything rigid.
    pub cloth: f32,
    pub uv: [f32; 2],
    /// The other bone that carries it, where it would be on that one, and the first bone's share of it.
    pub other_bone: f32,
    pub other_at: Vec3,
    pub share: f32,
}

impl RigVertex {
    pub fn floats(&self) -> [f32; RIG_FLOATS] {
        let (at, normal, paint, other) = (self.at, self.normal, self.paint, self.other_at);
        let [r, g, b] = paint.colour;
        [
            at.x,
            at.y,
            at.z,
            normal.x,
            normal.y,
            normal.z,
            r,
            g,
            b,
            paint.gloss,
            paint.bone,
            paint.tint,
            paint.kit,
            self.cloth,
            self.uv[0],
            self.uv[1],
            self.other_bone,
            self.share,
            other.x,
            other.y,
            other.z,
        ]
    }
}

/// A figure's and a horse's measures, as `unit.wgsl` reads them: where the joints are and how long the bones.
#[repr(C)]
#[derive(Clone, Copy, bytemuck::Pod, bytemuck::Zeroable)]
pub struct Build {
    /// The hips' height and half width, the thigh's length and the shin's.
    pub legs: [f32; 4],
    /// The shoulders' height over the chest's joint and their half width, the upper arm's length and the forearm's.
    pub arms: [f32; 4],
    /// The ankle's height, the head's joint over the chest's, the weapon hand's side (1 or -1), and the chest's
    /// joint over the hips.
    pub trunk: [f32; 4],
    /// A horse's back and leg joints' height, and how far its legs stand from its middle along and across.
    pub horse: [f32; 4],
    /// Its upper and lower leg's length, and its neck's joint over and ahead of its back's.
    pub horse_legs: [f32; 4],
    /// Its neck's length, its tail's joint over and behind its back's, and how much larger it is drawn.
    pub horse_ends: [f32; 4],
}

impl Build {
    /// Measures every build starts from: a model replaces the ones it has joints for.
    pub const BASE: Build = Build {
        legs: [0.47, 0.07, 0.225, 0.225],
        arms: [0.26, 0.165, 0.165, 0.15],
        trunk: [0.035, 0.31, 1.0, 0.07],
        horse: [0.72, 0.6, 0.3, 0.1],
        horse_legs: [0.3, 0.33, 0.1, 0.34],
        horse_ends: [0.36, 0.07, -0.4, 1.2],
    };
}

/// How a part is painted and posed.
#[derive(Clone, Copy)]
pub struct Paint {
    pub colour: Colour,
    /// 0 matt, 1 polished steel.
    pub gloss: f32,
    pub bone: f32,
    /// 1 where the unit's side colours the part.
    pub tint: f32,
    /// Which units wear the part: 0 all of them (`unit.wgsl` reads the rest).
    pub kit: f32,
}

impl Paint {
    pub const fn of(colour: Colour) -> Self {
        Self {
            colour,
            gloss: 0.0,
            bone: 0.0,
            tint: 0.0,
            kit: 0.0,
        }
    }

    pub const fn bone(mut self, bone: f32) -> Self {
        self.bone = bone;
        self
    }
}

#[derive(Clone, Copy)]
struct Vertex {
    at: Vec3,
    normal: Vec3,
    paint: Paint,
}

/// A small mesh built in code: a tuft, a bird, an effect's quads, a prop turned and squashed from a few solids.
#[derive(Default)]
pub struct Shape {
    vertices: Vec<Vertex>,
    indices: Vec<u32>,
}

impl Shape {
    pub fn indices(&self) -> &[u32] {
        &self.indices
    }

    /// Its vertices as a mesh's: place, facing, colour and gloss, and no place on a texture.
    pub fn scenery_floats(&self) -> Vec<f32> {
        self.vertices
            .iter()
            .flat_map(|vertex| {
                let [r, g, b] = vertex.paint.colour;
                let (at, normal) = (vertex.at, vertex.normal);
                [
                    at.x,
                    at.y,
                    at.z,
                    normal.x,
                    normal.y,
                    normal.z,
                    r,
                    g,
                    b,
                    vertex.paint.gloss,
                    0.0,
                    0.0,
                ]
            })
            .collect()
    }

    /// Its vertices as a figure's, each on the one bone its paint names.
    pub fn rig_floats(&self) -> Vec<f32> {
        self.vertices
            .iter()
            .flat_map(|vertex| {
                RigVertex {
                    at: vertex.at,
                    normal: vertex.normal,
                    paint: vertex.paint,
                    cloth: 0.0,
                    uv: [0.0; 2],
                    other_bone: vertex.paint.bone,
                    other_at: vertex.at,
                    share: 1.0,
                }
                .floats()
            })
            .collect()
    }

    /// One vertex, facing up.
    pub fn point(&mut self, at: Vec3, paint: Paint) -> u32 {
        self.vertices.push(Vertex {
            at,
            normal: Vec3::Y,
            paint,
        });
        (self.vertices.len() - 1) as u32
    }

    pub fn triangle(&mut self, corners: [u32; 3]) {
        self.indices.extend_from_slice(&corners);
    }

    fn push(&mut self, at: Vec3, normal: Vec3, paint: Paint) {
        self.vertices.push(Vertex { at, normal, paint });
    }

    /// A flat quad.
    pub fn face(&mut self, corners: [Vec3; 4], paint: Paint) {
        let normal = (corners[1] - corners[0])
            .cross(corners[2] - corners[0])
            .normalize_or_zero();
        let first = self.vertices.len() as u32;
        for corner in corners {
            self.push(corner, normal, paint);
        }
        self.indices
            .extend_from_slice(&[first, first + 1, first + 2, first, first + 2, first + 3]);
    }

    /// A shape turned on a lathe from `from` towards `to`: rings of `sides` at each `(along, radius)` of the
    /// profile, `along` in the same units as the points, smooth all round. A radius of 0 closes an end.
    pub fn lathe(
        &mut self,
        from: Vec3,
        to: Vec3,
        profile: &[(f32, f32)],
        sides: u32,
        paint: Paint,
    ) {
        let axis = (to - from).normalize_or_zero();
        let across = axis.any_orthonormal_vector();
        let other = axis.cross(across);
        let first = self.vertices.len() as u32;
        for (ring, &(along, radius)) in profile.iter().enumerate() {
            let before = profile[ring.saturating_sub(1)];
            let after = profile[(ring + 1).min(profile.len() - 1)];
            let (run, rise) = (after.0 - before.0, after.1 - before.1);
            for side in 0..sides {
                let angle = side as f32 / sides as f32 * std::f32::consts::TAU;
                let outward = across * angle.cos() + other * angle.sin();
                let normal = (outward * run - axis * rise).normalize_or_zero();
                // A closed end faces along the axis.
                let normal = if radius == 0.0 {
                    axis * if ring == 0 { -1.0 } else { 1.0 }
                } else {
                    normal
                };
                self.push(from + axis * along + outward * radius, normal, paint);
            }
        }
        for ring in 0..profile.len() as u32 - 1 {
            for side in 0..sides {
                let next = (side + 1) % sides;
                let (a, b) = (first + ring * sides + side, first + ring * sides + next);
                let (c, d) = (a + sides, b + sides);
                self.indices.extend_from_slice(&[a, c, b, b, c, d]);
            }
        }
    }

    /// A limb: a rounded rod from `from` to `to`, `start` thick at one end and `end` at the other.
    pub fn limb(&mut self, from: Vec3, to: Vec3, start: f32, end: f32, sides: u32, paint: Paint) {
        let length = (to - from).length();
        self.lathe(
            from,
            to,
            &[
                (-start, 0.0),
                (-start * 0.6, start * 0.8),
                (0.0, start),
                (length, end),
                (length + end * 0.6, end * 0.8),
                (length + end, 0.0),
            ],
            sides,
            paint,
        );
    }

    /// A ball squashed to `radii`.
    pub fn ball(&mut self, centre: Vec3, radii: Vec3, sides: u32, paint: Paint) {
        let first = self.vertices.len();
        let rings = (sides / 2).max(3);
        let profile: Vec<(f32, f32)> = (0..=rings)
            .map(|ring| {
                let angle = ring as f32 / rings as f32 * std::f32::consts::PI;
                (
                    -angle.cos(),
                    if ring % rings == 0 { 0.0 } else { angle.sin() },
                )
            })
            .collect();
        self.lathe(Vec3::ZERO, Vec3::Y, &profile, sides, paint);
        for vertex in &mut self.vertices[first..] {
            let on_ball = vertex.at;
            vertex.at = centre + on_ball * radii;
            vertex.normal = (on_ball / radii).normalize_or_zero();
        }
    }
}

pub fn hash(at: Vec3) -> f32 {
    ((at.x * 127.1 + at.y * 311.7 + at.z * 74.7).sin() * 43_758.547)
        .fract()
        .abs()
}
