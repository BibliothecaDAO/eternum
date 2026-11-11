//! The game's own unit models hung on the bones `unit.wgsl` poses by maths. A model with a skeleton is bound by its
//! own weights; one built of rigid parts by its parts; a statue by where each vertex is: below the hips a leg,
//! above the neck a head. The model keeps its shape and its paint; its motion is the shader's.

use glam::{Mat3, Vec3};

use crate::scene::{Kit, KitPart, Snapshot, VERTEX_FLOATS};
use crate::shapes::{Build, Paint, RigVertex};

/// How tall a figure stands in the rig's own units, and how high a rider's head is over the ground.
const FIGURE_TALL: f32 = 1.03;
const MOUNTED_TALL: f32 = 1.5;

/// How much brighter than its texture a model is painted where it is drawn small.
const CROWD_LIFT: f32 = 1.6;

/// A skin at one fineness, and the texture that paints it there: negative for one painted at its vertices.
pub struct Level {
    pub texture: i32,
    pub vertices: Vec<f32>,
    pub indices: Vec<u32>,
}

/// The triangles of a model that one texture paints, at three finenesses: fine, with its texture; middling and
/// coarse, which a crowd is drawn with, painted at their vertices.
pub struct Skin {
    pub levels: [Level; 3],
}

/// A model ready to be posed: its measures and its skins.
pub struct Body {
    pub build: Build,
    pub skins: Vec<Skin>,
}

/// Where a vertex hangs: its bone, its place and facing in that bone's frame, and the bone it shares it with.
struct Hold {
    bone: f32,
    at: Vec3,
    normal: Vec3,
    other: Option<(f32, Vec3)>,
    share: f32,
}

impl Hold {
    fn on(bone: f32, rest: &Rest, at: Vec3, normal: Vec3) -> Hold {
        Hold {
            bone,
            at: rest.local(at),
            normal: rest.frame.transpose() * normal,
            other: None,
            share: 1.0,
        }
    }

    /// Shared with `other`, which carries `1 - share` of it.
    fn shared(mut self, other: f32, rest: &Rest, at: Vec3, share: f32) -> Hold {
        if share < 0.999 {
            self.other = Some((other, rest.local(at)));
            self.share = share;
        }
        self
    }
}

/// A bone at rest in the model: where its joint is and the frame its part hangs in.
#[derive(Clone, Copy)]
struct Rest {
    joint: Vec3,
    frame: Mat3,
}

impl Rest {
    fn upright(joint: Vec3) -> Rest {
        Rest {
            joint,
            frame: Mat3::IDENTITY,
        }
    }

    /// A limb that points along `toward` in the model: the shader hangs it down its frame's own Y.
    fn hanging(joint: Vec3, toward: Vec3) -> Rest {
        let y = -toward.normalize();
        let z = (Vec3::Z - y * Vec3::Z.dot(y)).normalize();
        Rest {
            joint,
            frame: Mat3::from_cols(y.cross(z), y, z),
        }
    }

    fn local(&self, at: Vec3) -> Vec3 {
        self.frame.transpose() * (at - self.joint)
    }
}

struct Source<'a> {
    kit: &'a Kit,
    floats: &'a [f32],
    /// The model's vertices are moved by `-origin` and grown by `scale` into the rig's units.
    origin: Vec3,
    scale: f32,
}

struct Vertex {
    at: Vec3,
    normal: Vec3,
    colour: [f32; 3],
    /// Its texture's colour where it sits on it.
    paint: [f32; 3],
    uv: [f32; 2],
}

impl<'a> Source<'a> {
    fn of(snapshot: &'a Snapshot, buffer: &'a [u8], name: &str) -> Option<Source<'a>> {
        let kit = snapshot.kits.iter().find(|kit| kit.name == name)?;
        Some(Source {
            kit,
            floats: snapshot.floats(buffer),
            origin: Vec3::ZERO,
            scale: 1.0,
        })
    }

    fn vertices(&self, part: &'a KitPart) -> impl Iterator<Item = Vertex> + 'a {
        let (origin, scale) = (self.origin, self.scale);
        let paint = self.floats[part.paint_offset..part.paint_offset + part.vertex_count * 3]
            .chunks_exact(3);
        self.floats[part.vertex_offset..part.vertex_offset + part.vertex_count * VERTEX_FLOATS]
            .chunks_exact(VERTEX_FLOATS)
            .zip(paint)
            .map(move |(v, paint)| Vertex {
                at: (Vec3::new(v[0], v[1], v[2]) - origin) * scale,
                normal: Vec3::new(v[3], v[4], v[5]),
                colour: [v[6], v[7], v[8]],
                paint: [paint[0], paint[1], paint[2]],
                uv: [v[10], v[11]],
            })
    }

    fn every_vertex(&self) -> impl Iterator<Item = Vertex> + '_ {
        self.kit.parts.iter().flat_map(|part| self.vertices(part))
    }

    /// The model's lowest and highest corner as it stands in the file.
    fn bounds(&self) -> (Vec3, Vec3) {
        self.every_vertex().fold(
            (Vec3::splat(f32::MAX), Vec3::splat(f32::MIN)),
            |(low, high), vertex| (low.min(vertex.at), high.max(vertex.at)),
        )
    }

    /// Stands the model on the ground at `middle`, `tall` high in the rig's units.
    fn standing(mut self, middle: Vec3, tall: f32) -> Self {
        let (low, high) = self.bounds();
        self.origin = Vec3::new(middle.x, low.y, middle.z);
        self.scale = tall / (high.y - low.y);
        self
    }

    fn joint(&self, name: &str) -> Vec3 {
        let found = self
            .kit
            .joints
            .iter()
            .find(|joint| joint.name.contains(name));
        let at = found
            .unwrap_or_else(|| panic!("{} has no joint {name}", self.kit.name))
            .at;
        (Vec3::from(at) - self.origin) * self.scale
    }

    /// The model's skins: every part's vertices held as `hold` says, parts of one texture drawn together.
    fn skins(&self, hold: impl Fn(&KitPart, usize, &Vertex) -> Hold) -> Vec<Skin> {
        let mut skins: Vec<Skin> = Vec::new();
        for part in &self.kit.parts {
            let at = skins
                .iter()
                .position(|skin| skin.levels[0].texture == part.texture);
            let skin = match at {
                Some(at) => &mut skins[at],
                None => {
                    let level = |texture| Level {
                        texture,
                        vertices: Vec::new(),
                        indices: Vec::new(),
                    };
                    skins.push(Skin {
                        levels: [level(part.texture), level(-1), level(-1)],
                    });
                    skins.last_mut().expect("the skin just added")
                }
            };
            let first = (skin.levels[0].vertices.len() / crate::shapes::RIG_FLOATS) as u32;
            let mut textured = Vec::with_capacity(part.vertex_count * crate::shapes::RIG_FLOATS);
            let mut painted = textured.clone();
            for (index, vertex) in self.vertices(part).enumerate() {
                let held = hold(part, index, &vertex);
                let (other_bone, other_at) = held.other.unwrap_or((held.bone, held.at));
                let rigged = RigVertex {
                    at: held.at,
                    normal: held.normal,
                    paint: Paint::of(vertex.colour).bone(held.bone),
                    cloth: 0.0,
                    uv: vertex.uv,
                    other_bone,
                    other_at,
                    share: held.share,
                };
                textured.extend_from_slice(&rigged.floats());
                // In a crowd a vertex carries its texture's colour itself, and rides one bone only: half the posing.
                // Seen small, a model's dark creases would make a crowd of it a dark mass: its paint is lifted.
                let [r, g, b] = [0, 1, 2]
                    .map(|channel| vertex.colour[channel] * vertex.paint[channel] * CROWD_LIFT);
                let in_crowd = RigVertex {
                    paint: Paint::of([r, g, b]).bone(held.bone),
                    share: 1.0,
                    ..rigged
                };
                painted.extend_from_slice(&in_crowd.floats());
            }
            // Every fineness draws from the same vertices, and each holds its own copy of them.
            for (fineness, (level, kept)) in part.levels.iter().zip(&mut skin.levels).enumerate() {
                let run = &self.floats[level.index_offset..level.index_offset + level.index_count];
                kept.vertices
                    .extend_from_slice(if fineness == 0 { &textured } else { &painted });
                kept.indices
                    .extend(run.iter().map(|index| index.to_bits() + first));
            }
        }
        skins
    }
}

/// How much of a vertex at `value` belongs past `edge`, shared over `band` on either side of it.
fn past(value: f32, edge: f32, band: f32) -> f32 {
    ((value - edge) / band * 0.5 + 0.5).clamp(0.0, 1.0)
}

/// The articulated T1 knight, bound by its own skeleton's weights, its sword in its right hand and its shield on
/// its left forearm.
pub fn knight(snapshot: &Snapshot, buffer: &[u8]) -> Option<Body> {
    let source = Source::of(snapshot, buffer, "knight")?;
    let pelvis = source.joint("pelvis");
    let source = source.standing(pelvis, FIGURE_TALL);
    let joint = |name: &str| source.joint(name);
    let span = |from: &str, to: &str| (joint(to) - joint(from)).length();
    let toward = |from: &str, to: &str| joint(to) - joint(from);
    let hips = Vec3::new(0.0, joint("thigh_l").y, 0.0);
    let chest = hips + Vec3::Y * (joint("spine_02").y - hips.y);
    let build = Build {
        legs: [
            hips.y,
            joint("thigh_l").x.abs(),
            span("thigh_l", "calf_l"),
            span("calf_l", "foot_l"),
        ],
        arms: [
            joint("upperarm_l").y - chest.y,
            joint("upperarm_l").x.abs(),
            span("upperarm_l", "lowerarm_l"),
            span("lowerarm_l", "hand_l"),
        ],
        // The sword is in the model's right hand, which is on its -x.
        trunk: [
            joint("foot_l").y,
            joint("neck_01").y - chest.y,
            -1.0,
            chest.y - hips.y,
        ],
        ..Build::BASE
    };
    let mut rests = [Rest::upright(hips); 16];
    rests[1] = Rest::upright(chest);
    rests[2] = Rest::upright(chest + Vec3::Y * build.trunk[1]);
    for (side, sign, arm, leg, foot) in [("r", -1.0, 3, 7, 11), ("l", 1.0, 5, 9, 12)] {
        let named = |bone: &str| format!("{bone}_{side}");
        let along = |from: &str, to: &str| toward(&named(from), &named(to));
        let shoulder = chest + Vec3::new(sign * build.arms[1], build.arms[0], 0.0);
        let upper = along("upperarm", "lowerarm");
        rests[arm] = Rest::hanging(shoulder, upper);
        rests[arm + 1] = Rest::hanging(
            shoulder + upper.normalize() * build.arms[2],
            along("lowerarm", "hand"),
        );
        let hip = hips + Vec3::X * sign * build.legs[1];
        let thigh = along("thigh", "calf");
        let knee = hip + thigh.normalize() * build.legs[2];
        let shin = along("calf", "foot");
        rests[leg] = Rest::hanging(hip, thigh);
        rests[leg + 1] = Rest::hanging(knee, shin);
        rests[foot] = Rest::upright(knee + shin.normalize() * build.legs[3]);
    }
    // Which of the rig's bones each of the model's joints moves, and how much of a joint that sits between two.
    let bones: Vec<[(usize, f32); 2]> = source
        .kit
        .bones
        .iter()
        .map(|name| rig_bones(name))
        .collect();
    let skin_of = |part: &KitPart, index: usize| {
        let at = part.skin_offset as usize + index * 8;
        &source.floats[at..at + 8]
    };
    let mut skins = source.skins(|part, index, vertex| {
        let mut weights = [0.0_f32; 16];
        let skin = skin_of(part, index);
        for slot in 0..4 {
            for (bone, share) in bones[skin[slot] as usize] {
                weights[bone] += skin[slot + 4] * share;
            }
        }
        let mut order: Vec<usize> = (0..16).collect();
        order.sort_by(|a, b| weights[*b].total_cmp(&weights[*a]));
        let (first, second) = (order[0], order[1]);
        Hold::on(first as f32, &rests[first], vertex.at, vertex.normal).shared(
            second as f32,
            &rests[second],
            vertex.at,
            weights[first] / (weights[first] + weights[second]).max(1e-6),
        )
    });
    // The sword's blade runs up its own Y: it is laid along the weapon bone's Z, its grip in the palm.
    let palm = build.arms[3] * 0.45;
    let scale = source.scale;
    if let Some(sword) = Source::of(snapshot, buffer, "sword") {
        skins.extend(sword.skins(|_, _, vertex| {
            let (at, normal) = (vertex.at * scale, vertex.normal);
            Hold {
                bone: 13.0,
                at: Vec3::new(at.x, -at.z - palm, at.y),
                normal: Vec3::new(normal.x, -normal.z, normal.y),
                other: None,
                share: 1.0,
            }
        }));
    }
    // The shield's face looks along its own Z: it is strapped outside the left forearm, facing out.
    if let Some(shield) = Source::of(snapshot, buffer, "shield") {
        let forearm = build.arms[3];
        skins.extend(shield.skins(|_, _, vertex| {
            let (at, normal) = (vertex.at * scale, vertex.normal);
            Hold {
                bone: 6.0,
                at: Vec3::new(0.05 + at.z, at.y - forearm * 0.55, -at.x),
                normal: Vec3::new(normal.z, normal.y, -normal.x),
                other: None,
                share: 1.0,
            }
        }));
    }
    Some(Body { build, skins })
}

/// The rig's bones a joint of the T1 knight's skeleton moves.
fn rig_bones(name: &str) -> [(usize, f32); 2] {
    let (arm, leg, foot) = if name.ends_with("_r") {
        (3, 7, 11)
    } else {
        (5, 9, 12)
    };
    let whole = |bone: usize| [(bone, 1.0), (bone, 0.0)];
    match name.rsplit_once('_').map_or(name, |(stem, _)| stem) {
        "upperarm" | "upperarm_twist" => whole(arm),
        "elbow_half" => [(arm, 0.5), (arm + 1, 0.5)],
        "lowerarm" | "hand" => whole(arm + 1),
        "thigh" => whole(leg),
        "knee_half" => [(leg, 0.5), (leg + 1, 0.5)],
        "calf" => whole(leg + 1),
        "foot" | "ball" | "ball_leaf" => whole(foot),
        "spine" | "clavicle" => whole(1),
        "neck" => whole(2),
        _ if name == "Head" => whole(2),
        _ => whole(0),
    }
}

/// Where a statue's joints are, as shares of its height.
pub struct Standing {
    pub name: &'static str,
    pub tall: f32,
    pub hips: f32,
    pub knees: f32,
    pub ankles: f32,
    pub neck: f32,
}

pub const CROSSBOWMAN: Standing = Standing {
    name: "crossbowman",
    tall: FIGURE_TALL,
    hips: 0.47,
    knees: 0.26,
    ankles: 0.06,
    neck: 0.84,
};

/// A statue on two legs, bound by where each vertex is: its legs walk, its trunk leans and turns, its head looks
/// about; its arms stay as they were sculpted.
pub fn statue(snapshot: &Snapshot, buffer: &[u8], measures: &Standing) -> Option<Body> {
    let source = Source::of(snapshot, buffer, measures.name)?;
    let (low, high) = source.bounds();
    let feet = centre(
        source
            .every_vertex()
            .filter(|v| v.at.y < low.y + (high.y - low.y) * 0.12),
    );
    let source = source.standing(feet, measures.tall);
    let tall = measures.tall;
    let (hips, knees, ankles, neck) = (
        measures.hips * tall,
        measures.knees * tall,
        measures.ankles * tall,
        measures.neck * tall,
    );
    let legs = source.every_vertex().filter(|v| v.at.y < knees);
    let out = mean(legs.map(|v| v.at.x.abs()));
    let chest_rise = (neck - hips) * 0.2;
    let build = Build {
        // The hips ride a little low, so a knee always has some bend to walk with.
        legs: [hips * 0.985, out, hips - knees, knees - ankles],
        trunk: [ankles, neck - hips - chest_rise, 1.0, chest_rise],
        ..Build::BASE
    };
    let pelvis = Rest::upright(Vec3::Y * hips);
    let chest = Rest::upright(Vec3::Y * (hips + chest_rise));
    let head = Rest::upright(Vec3::Y * neck);
    let head_middle = centre(source.every_vertex().filter(|v| v.at.y > neck));
    let band = tall * 0.03;
    let skins = source.skins(|_, _, vertex| {
        let (at, normal) = (vertex.at, vertex.normal);
        if at.y >= hips + band {
            let on_chest = past(at.y, hips + chest_rise, band * 2.0);
            let near_head =
                Vec3::new(at.x - head_middle.x, 0.0, at.z - head_middle.z).length() < tall * 0.13;
            let on_head = if near_head {
                past(at.y, neck, band)
            } else {
                0.0
            };
            return if on_head > 0.5 {
                Hold::on(2.0, &head, at, normal).shared(1.0, &chest, at, on_head)
            } else if on_head > 0.0 {
                Hold::on(1.0, &chest, at, normal).shared(2.0, &head, at, 1.0 - on_head)
            } else if on_chest > 0.5 {
                Hold::on(1.0, &chest, at, normal).shared(0.0, &pelvis, at, on_chest)
            } else {
                Hold::on(0.0, &pelvis, at, normal).shared(1.0, &chest, at, 1.0 - on_chest)
            };
        }
        let (sign, thigh, foot) = if at.x < 0.0 {
            (-1.0, 7.0, 11.0)
        } else {
            (1.0, 9.0, 12.0)
        };
        let hip = Vec3::new(sign * out, hips, 0.0);
        let upper = Rest::upright(hip);
        let lower = Rest::upright(hip - Vec3::Y * (hips - knees));
        let sole = Rest::upright(hip - Vec3::Y * (hips - ankles));
        let on_pelvis = past(at.y, hips, band);
        let on_thigh = past(at.y, knees, band);
        if on_pelvis > 0.5 {
            Hold::on(0.0, &pelvis, at, normal).shared(thigh, &upper, at, on_pelvis)
        } else if on_thigh > 0.5 {
            Hold::on(thigh, &upper, at, normal).shared(
                if on_pelvis > 0.0 { 0.0 } else { thigh + 1.0 },
                if on_pelvis > 0.0 { &pelvis } else { &lower },
                at,
                if on_pelvis > 0.0 {
                    1.0 - on_pelvis
                } else {
                    on_thigh
                },
            )
        } else if at.y > ankles {
            Hold::on(thigh + 1.0, &lower, at, normal).shared(thigh, &upper, at, 1.0 - on_thigh)
        } else {
            Hold::on(foot, &sole, at, normal)
        }
    });
    Some(Body { build, skins })
}

/// The mounted paladin, a statue of horse and rider in one: the horse's legs are found below its belly and walk,
/// trot and gallop; everything above rides its back.
pub fn mounted_statue(snapshot: &Snapshot, buffer: &[u8]) -> Option<Body> {
    let source = Source::of(snapshot, buffer, "paladin")?;
    let (low, high) = source.bounds();
    let hooves = centre(
        source
            .every_vertex()
            .filter(|v| v.at.y < low.y + (high.y - low.y) * 0.2),
    );
    let source = source.standing(hooves, MOUNTED_TALL);
    let (joint, knee) = (MOUNTED_TALL * 0.36, MOUNTED_TALL * 0.19);
    let legs = || source.every_vertex().filter(|v| v.at.y < knee);
    let out = mean(legs().map(|v| v.at.x.abs()));
    let half = mean(legs().map(|v| v.at.z.abs()));
    let back = joint * 1.25;
    let build = Build {
        horse: [back * 0.97, joint * 0.97, half, out],
        horse_legs: [joint - knee, knee, 0.1, 0.34],
        horse_ends: [0.36, 0.07, -0.4, 1.0],
        ..Build::BASE
    };
    let body = Rest::upright(Vec3::Y * back);
    let band = MOUNTED_TALL * 0.025;
    let skins = source.skins(|_, _, vertex| {
        let (at, normal) = (vertex.at, vertex.normal);
        if at.y >= joint + band {
            return Hold::on(16.0, &body, at, normal);
        }
        // Fore left, fore right, hind left, hind right, as the shader numbers them.
        let pair = (if at.z > 0.0 { 0.0 } else { 2.0 }) + (if at.x < 0.0 { 0.0 } else { 1.0 });
        let upper_bone = 19.0 + pair * 2.0;
        let shoulder = Vec3::new(out * at.x.signum(), joint, half * at.z.signum());
        let upper = Rest::upright(shoulder);
        let lower = Rest::upright(shoulder - Vec3::Y * (joint - knee));
        let on_body = past(at.y, joint, band);
        let on_upper = past(at.y, knee, band);
        if on_body > 0.5 {
            Hold::on(16.0, &body, at, normal).shared(upper_bone, &upper, at, on_body)
        } else if on_body > 0.0 {
            Hold::on(upper_bone, &upper, at, normal).shared(16.0, &body, at, 1.0 - on_body)
        } else if on_upper > 0.5 {
            Hold::on(upper_bone, &upper, at, normal).shared(upper_bone + 1.0, &lower, at, on_upper)
        } else {
            Hold::on(upper_bone + 1.0, &lower, at, normal).shared(
                upper_bone,
                &upper,
                at,
                1.0 - on_upper,
            )
        }
    });
    Some(Body { build, skins })
}

/// A biome creature on four legs, built of rigid parts on hip and knee joints: each part rides the horse's bone of
/// its name.
pub fn creature(snapshot: &Snapshot, buffer: &[u8]) -> Option<Body> {
    const SHOULDER_TALL: f32 = 0.5;
    let mut source = Source::of(snapshot, buffer, "deer")?;
    let hip_height = source.joint("hip_FL").y;
    source.scale = SHOULDER_TALL / hip_height;
    let legs = ["FL", "FR", "BL", "BR"];
    let hip = |leg: &str| source.joint(&format!("hip_{leg}"));
    let knee = |leg: &str| source.joint(&format!("knee_{leg}"));
    let part_of = |name: &str| {
        source
            .kit
            .parts
            .iter()
            .find(|part| part.path.iter().any(|node| node.contains(name)))
    };
    let hoof = |leg: &str| {
        let lower = part_of(&format!("lower_{leg}")).expect("a creature's lower leg");
        let lowest = source
            .vertices(lower)
            .map(|v| v.at.y)
            .fold(f32::MAX, f32::min);
        centre(source.vertices(lower).filter(|v| v.at.y < lowest + 0.02))
    };
    let (out, half) = (hip("FL").x.abs(), hip("FL").z.abs());
    let back = SHOULDER_TALL * 1.15;
    let torso = part_of("torso").expect("a creature's torso");
    let front = source
        .vertices(torso)
        .map(|v| v.at.z)
        .fold(f32::MIN, f32::max);
    let top = source
        .vertices(torso)
        .map(|v| v.at.y)
        .fold(f32::MIN, f32::max);
    let neck = Vec3::new(0.0, top - (top - back) * 0.6, front * 0.8);
    let build = Build {
        horse: [back, SHOULDER_TALL, half, out],
        horse_legs: [
            (knee("FL") - hip("FL")).length(),
            (hoof("FL") - knee("FL")).length(),
            neck.y - back,
            neck.z,
        ],
        horse_ends: [0.36, 0.07, -0.4, 1.0],
        ..Build::BASE
    };
    let body = Rest::upright(Vec3::Y * back);
    // The shader holds a neck 0.8 of a radian forward of upright at rest.
    let neck_rest = Rest {
        joint: neck,
        frame: Mat3::from_rotation_x(0.8),
    };
    let skins = source.skins(|part, _, vertex| {
        let named = |name: &str| part.path.iter().any(|node| node.contains(name));
        let leg = legs.iter().position(|leg| named(&format!("_{leg}")));
        let rest = match leg {
            Some(leg) => {
                let name = legs[leg];
                // The shader's pairs: fore before hind, and the leg on -x first.
                let pair =
                    (if name.starts_with('F') { 0 } else { 2 }) + usize::from(hip(name).x > 0.0);
                let shoulder = Vec3::new(
                    out * hip(name).x.signum(),
                    SHOULDER_TALL,
                    half * hip(name).z.signum(),
                );
                let thigh = knee(name) - hip(name);
                if named("upper_") {
                    (19.0 + pair as f32 * 2.0, Rest::hanging(shoulder, thigh))
                } else {
                    let below = shoulder + thigh.normalize() * build.horse_legs[0];
                    (
                        20.0 + pair as f32 * 2.0,
                        Rest::hanging(below, hoof(name) - knee(name)),
                    )
                }
            }
            None if named("head_and_neck") => (17.0, neck_rest),
            None => (16.0, body),
        };
        Hold::on(rest.0, &rest.1, vertex.at, vertex.normal)
    });
    Some(Body { build, skins })
}

fn centre(vertices: impl Iterator<Item = Vertex>) -> Vec3 {
    let (sum, count) = vertices.fold((Vec3::ZERO, 0.0), |(sum, count), v| {
        (sum + v.at, count + 1.0)
    });
    sum / f32::max(count, 1.0)
}

fn mean(values: impl Iterator<Item = f32>) -> f32 {
    let (sum, count) = values.fold((0.0, 0.0), |(sum, count), value| (sum + value, count + 1.0));
    sum / f32::max(count, 1.0)
}
