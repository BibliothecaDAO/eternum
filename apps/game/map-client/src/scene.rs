//! The patch as the page hands it over: a JSON table of meshes and one buffer of their vertices, indices and
//! instances, exactly what the game's own scene held when it was read.

use serde::Deserialize;

/// A vertex: where it is, which way it faces, its colour and gloss, and where it sits on its texture.
pub const VERTEX_FLOATS: usize = 12;
/// An instance: its placement and its tint.
pub const INSTANCE_FLOATS: usize = 20;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    pub meshes: Vec<MeshRecord>,
    /// How many floats the buffer holds before its textures' pixels.
    pub float_count: usize,
    pub light: Light,
    /// The textures the meshes are painted with: plain RGBA pixels in the buffer.
    #[serde(default)]
    pub textures: Vec<TextureRecord>,
    /// The game's own unit models, which the renderer poses itself.
    pub kits: Vec<Kit>,
    /// Every hex of the land, explored or not.
    pub hexes: Hexes,
}

/// One of the game's models: its parts, each at three finenesses, and the joints they hang from.
#[derive(Deserialize)]
pub struct Kit {
    pub name: String,
    pub parts: Vec<KitPart>,
    pub joints: Vec<KitJoint>,
    /// The joints a skinned vertex names, in the order it numbers them.
    pub bones: Vec<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KitPart {
    /// The names of the nodes the part hangs from, outermost first.
    pub path: Vec<String>,
    pub vertex_offset: usize,
    pub vertex_count: usize,
    /// Eight floats a vertex, four joints then their weights; negative for a part with no skin.
    pub skin_offset: i64,
    /// Three floats a vertex: its own colour, read off its texture.
    pub paint_offset: usize,
    pub levels: Vec<KitLevel>,
    pub texture: i32,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KitLevel {
    pub index_offset: usize,
    pub index_count: usize,
}

#[derive(Deserialize)]
pub struct KitJoint {
    pub name: String,
    pub at: [f32; 3],
}

/// The land's hexes: four floats each in the buffer (its middle's x and z, its biome's place among `biomes`, and how
/// it stands: 0 unexplored, 1 explored, 2 explored with a building on it).
#[derive(Deserialize)]
pub struct Hexes {
    pub offset: usize,
    pub count: usize,
    pub biomes: Vec<Biome>,
}

/// A biome as the game names it, and its ground's colour in the game's palette.
#[derive(Deserialize)]
pub struct Biome {
    pub name: String,
    pub colour: [f32; 3],
}

#[derive(Deserialize)]
pub struct TextureRecord {
    /// In bytes into the snapshot's buffer.
    pub offset: usize,
    pub size: u32,
}

/// How a mesh is shaded: the ground carries the hex grid, water moves, a plant sways, a bird flies, everything else
/// is plainly lit.
#[derive(Deserialize, Clone, Copy, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Kind {
    Solid,
    Ground,
    Water,
    Plant,
    Bird,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MeshRecord {
    pub kind: Kind,
    /// Offsets and counts, in floats or indices, into the snapshot's buffer.
    pub vertex_offset: usize,
    pub vertex_count: usize,
    pub index_offset: usize,
    pub index_count: usize,
    pub instance_offset: usize,
    pub instance_count: usize,
    pub casts_shadow: bool,
    /// Which of the snapshot's textures paints the mesh; negative for none.
    pub texture: i32,
}

#[derive(Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Light {
    pub toward: [f32; 3],
    pub colour: [f32; 3],
    pub sky: [f32; 3],
    pub ground: [f32; 3],
    /// The middle of the patch, which the shadow map is framed round.
    pub centre: [f32; 3],
}

impl Snapshot {
    /// The buffer's floats: every mesh's and model's vertices, indices and instances, and the hexes.
    pub fn floats<'a>(&self, buffer: &'a [u8]) -> &'a [f32] {
        bytemuck::cast_slice(&buffer[..self.float_count * 4])
    }
}

pub fn floats(buffer: &[u8], offset: usize, count: usize) -> &[u8] {
    &buffer[offset * 4..(offset + count) * 4]
}
