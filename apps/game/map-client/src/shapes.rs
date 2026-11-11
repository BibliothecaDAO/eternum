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

/// A small mesh built in code, a vertex and a triangle at a time: a tuft, a bird, an effect's quads.
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
}

pub fn hash(at: Vec3) -> f32 {
    ((at.x * 127.1 + at.y * 311.7 + at.z * 74.7).sin() * 43_758.547)
        .fract()
        .abs()
}
