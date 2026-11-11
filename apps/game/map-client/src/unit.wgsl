// Units with no animation data: a figure and a horse posed in the vertex shader by maths alone, whether built of
// rounded parts or one of the game's own models hung on the same bones (kit.rs). Each instance carries where it
// stands, what it does, a seed and a tint; its walk, run, guard, strike, fall and ride all come from the clock. The gait is the game's own procedural knight's: a duty
// factor per pace, a swing arc, a hip bob (src/three/characters/procedural-character-gait.ts).
// The measures of the build being drawn (`Build`, shapes.rs).
struct Build {
  // The hips' height and half width, the thigh's length and the shin's.
  legs: vec4f,
  // The shoulders' height over the chest's joint and their half width, the upper arm's length and the forearm's.
  arms: vec4f,
  // The ankle's height, the head's joint over the chest's, the weapon hand's side, the chest's joint over the hips.
  trunk: vec4f,
  // A horse's back and leg joints' height, and how far its legs stand from its middle along and across.
  horse: vec4f,
  // Its upper and lower leg's length, and its neck's joint over and ahead of its back's.
  horse_legs: vec4f,
  // Its neck's length, its tail's joint over and behind its back's, and how much larger it is drawn.
  horse_ends: vec4f,
}
@group(1) @binding(0) var<uniform> build: Build;
// The model's painted texture; white for a build with none.
@group(1) @binding(1) var paint: texture_2d<f32>;
@group(1) @binding(2) var paint_sampler: sampler;

struct UnitInput {
  // Relative to the part's joint.
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
  // rgb: the part's colour. a: its gloss.
  @location(2) colour: vec4f,
  // x: the part's bone. y: 1 where the unit's tint paints it. z: its kit. w: how far along a cloth from its pin.
  @location(3) rig: vec4f,
  // xyz: the unit's anchor. w: its seed in [0, 1).
  @location(4) stand: vec4f,
  // x: the figure's height in world units. y: its kind. z: what it does. w: its heading.
  @location(5) build: vec4f,
  // x: a patrol's radius or a march's length. y: a patrol's first angle or an act's first moment. z: its speed,
  // signed by the way round. w: when it sets off.
  @location(6) path: vec4f,
  // x: its girth. y: where in its stride it starts.
  @location(7) manner: vec4f,
  @location(8) tint: vec4f,
  @location(9) uv: vec2f,
  // x: the other bone that carries the vertex. y: the first bone's share of it.
  @location(10) split: vec2f,
  // Where the vertex is relative to that other bone's joint.
  @location(11) other_position: vec3f,
}

struct UnitOutput {
  @builtin(position) clip: vec4f,
  @location(0) world: vec3f,
  @location(1) normal: vec3f,
  // a: the gloss, or an effect's opacity.
  @location(2) colour: vec4f,
  // xy: where on an effect's quad. z: 1 for cloth, whose facing is read off the screen; 2 a blob, 3 a trail, 4 dust.
  @location(3) mark: vec3f,
  @location(4) uv: vec2f,
}

const PI = 3.14159265;
const TAU = 6.2831853;


const SWORDSMAN = 0.0;
const SPEARMAN = 1.0;
const RIDER = 2.0;
const BEAST = 3.0;

const PATROL = 0.0;
const GUARD = 1.0;
const DUEL = 2.0;
const FALLS = 3.0;
const MARCH = 4.0;
const CHEER = 5.0;
const GRAZE = 6.0;

fn turn_x(angle: f32) -> mat3x3f {
  let c = cos(angle);
  let s = sin(angle);
  return mat3x3f(vec3f(1, 0, 0), vec3f(0, c, s), vec3f(0, -s, c));
}

fn turn_y(angle: f32) -> mat3x3f {
  let c = cos(angle);
  let s = sin(angle);
  return mat3x3f(vec3f(c, 0, -s), vec3f(0, 1, 0), vec3f(s, 0, c));
}

fn turn_z(angle: f32) -> mat3x3f {
  let c = cos(angle);
  let s = sin(angle);
  return mat3x3f(vec3f(c, s, 0), vec3f(-s, c, 0), vec3f(0, 0, 1));
}

// A limb hanging from its joint swung forward by `angle`.
fn swing(angle: f32) -> mat3x3f {
  return turn_x(-angle);
}

fn ease(value: f32) -> f32 {
  let x = clamp(value, 0.0, 1.0);
  return x * x * (3.0 - 2.0 * x);
}

fn between(value: f32, start: f32, end: f32) -> f32 {
  return ease((value - start) / (end - start));
}

// Up and back down over 0 to 1.
fn bump(value: f32) -> f32 {
  return sin(clamp(value, 0.0, 1.0) * PI);
}

// What a unit is doing, where, and how far through it: all read from its instance and the clock.
struct Life {
  origin: vec3f,
  heading: f32,
  // Its stride's phase in [0, 1), the ground one whole stride covers (in the figure's own units), and the share of
  // a stride a foot spends on the ground.
  phase: f32,
  stride: f32,
  duty: f32,
  // 0 standing, 1 walking, 2 running or trotting, 3 galloping; `go` fades it in and out.
  pace: f32,
  go: f32,
  activity: f32,
  // How far through a strike, or how far down in a fall, 0 to 1; and a fall's seconds since it began.
  moment: f32,
  clock: f32,
  // The lean into a turn.
  bank: f32,
  seed: f32,
  kind: f32,
  height: f32,
}

fn live(input: UnitInput, time: f32) -> Life {
  var life: Life;
  let height = input.build.x;
  let speed = abs(input.path.z);
  let way = select(-1.0, 1.0, input.path.z >= 0.0);
  let rate = speed / height;
  let mounted = input.build.y >= RIDER;
  life.seed = input.stand.w;
  life.kind = input.build.y;
  life.height = height;
  life.activity = input.build.z;
  life.origin = input.stand.xyz;
  life.heading = input.build.w;
  life.moment = 0.0;
  life.clock = 0.0;
  life.bank = 0.0;
  life.go = 0.0;
  // A man walks, or runs; a horse walks, trots or gallops.
  var period = select(select(1.05, 0.62, rate > 1.6), select(select(1.0, 0.64, rate > 1.9), 0.5, rate > 4.0), mounted);
  life.duty = select(select(0.62, 0.4, rate > 1.6), select(select(0.62, 0.42, rate > 1.9), 0.3, rate > 4.0), mounted);
  life.pace = select(select(1.0, 2.0, rate > 1.6), select(select(1.0, 2.0, rate > 1.9), 3.0, rate > 4.0), mounted);
  if (life.activity == PATROL) {
    // Round its post. The stride's phase is the ground covered, so feet do not slide.
    let radius = max(input.path.x, 0.05);
    let angle = input.path.y + way * speed * time / radius;
    life.origin = input.stand.xyz + vec3f(sin(angle), 0.0, cos(angle)) * radius;
    life.heading = angle + way * PI * 0.5;
    life.bank = way * clamp(speed * speed / radius * 0.1, 0.0, 0.28);
    life.go = 1.0;
  } else if (life.activity == MARCH) {
    // Straight ahead, for ever or as far as its length, then it stands.
    let gone = max(speed * (time - input.path.w), 0.0);
    let endless = input.path.x <= 0.0;
    let travelled = select(min(gone, input.path.x), gone, endless);
    life.origin = input.stand.xyz + vec3f(sin(life.heading), 0.0, cos(life.heading)) * travelled;
    life.go = select(smoothstep(0.0, 0.3, input.path.x - gone), 1.0, endless) * step(0.0001, gone);
  } else if (life.activity == DUEL) {
    life.moment = fract(time * 0.55 + input.path.y);
  } else if (life.activity == FALLS) {
    // Stands, is struck down, lies, and is back on its feet: a loop of eight seconds.
    let lap = fract(time / 8.0 + input.path.y) * 8.0;
    life.clock = lap - 2.0;
    life.moment = clamp(life.clock / 0.8, 0.0, 1.0) * (1.0 - between(lap, 6.4, 7.6));
  } else if (life.activity == CHEER) {
    life.moment = time * 1.3 - dot(input.stand.xz, vec2f(0.33, 0.21));
  }
  life.pace *= step(0.01, life.go);
  life.stride = speed * period / height * life.go;
  life.phase = fract(time / period + input.manner.y);
  life.origin.y = land_at(life.origin.xz).x;
  return life;
}

// A joint's place in the figure and the frame its part hangs in.
struct Joint {
  at: vec3f,
  frame: mat3x3f,
}

// A foot's place in its stride: x how far ahead of its middle, y how high, z how far through its swing (below
// zero while it carries weight).
fn footfall(leg_phase: f32, duty: f32, travel: f32, lift: f32) -> vec3f {
  let carried = leg_phase / duty;
  let swung = (leg_phase - duty) / (1.0 - duty);
  let on_ground = leg_phase < duty;
  return vec3f(
    select(travel * (ease(swung) - 0.5), travel * (0.5 - carried), on_ground),
    select(sin(PI * pow(max(swung, 0.0), 0.85)) * lift, 0.0, on_ground),
    select(swung, -1.0, on_ground),
  );
}

// The angles two bones of a limb take to reach `toward` (x ahead, y up) from their joint; `bend` is 1 for a knee
// that points ahead, -1 for one that points back. x: the upper bone's swing; y: the lower's.
fn reach(toward: vec2f, upper: f32, lower: f32, bend: f32) -> vec2f {
  let span = clamp(length(toward), abs(upper - lower) + 0.01, upper + lower - 0.003);
  let aim = atan2(toward.x, -toward.y);
  let at_joint = acos(clamp((upper * upper + span * span - lower * lower) / (2.0 * upper * span), -1.0, 1.0));
  let at_knee = acos(clamp((upper * upper + lower * lower - span * span) / (2.0 * upper * lower), -1.0, 1.0));
  let upper_swing = aim + bend * at_joint;
  return vec2f(upper_swing, upper_swing - bend * (PI - at_knee));
}

// How much higher the ground is under a point of the figure than under its middle, in the figure's units.
fn rise_under(life: Life, at: vec3f) -> f32 {
  let ground = life.origin + turn_y(life.heading) * vec3f(at.x, 0.0, at.z) * life.height;
  return clamp((land_at(ground.xz).x - life.origin.y) / life.height, -0.2, 0.2);
}

// ---------------------------------------------------------------------------------------------------------------
// The horse.

struct Mount {
  body: Joint,
  // Where the rider's hips sit.
  seat: vec3f,
  stride: f32,
}

fn horse_gait(pair: f32, pace: f32) -> f32 {
  // Fore left, fore right, hind left, hind right: a walk's four even beats, a trot's diagonals, a gallop's roll.
  var walk = array<f32, 4>(0.25, 0.75, 0.0, 0.5);
  var trot = array<f32, 4>(0.5, 0.0, 0.0, 0.5);
  var gallop = array<f32, 4>(0.32, 0.5, 0.0, 0.15);
  let leg = i32(pair);
  return select(select(walk[leg], trot[leg], pace > 1.5), gallop[leg], pace > 2.5);
}

fn mount(life: Life, time: f32) -> Mount {
  let stride = life.phase * TAU;
  let trot = step(1.5, life.pace) * step(life.pace, 2.5);
  let gallop = step(2.5, life.pace);
  let walk = life.go * (1.0 - trot) * (1.0 - gallop);
  let breath = sin(time * 1.3 + life.seed * 31.0);
  let bob = (-cos(stride * 2.0) * (0.012 * walk + 0.03 * trot) + cos(stride - 1.2) * 0.055 * gallop) * life.go + breath * 0.004;
  let pitch = sin(stride - 0.4) * 0.1 * gallop + sin(stride * 2.0) * 0.012 * walk;
  var horse: Mount;
  horse.stride = stride;
  horse.body.at = vec3f(0.0, build.horse.x + bob, 0.0);
  horse.body.frame = turn_z(life.bank) * turn_x(pitch);
  horse.seat = horse.body.at + horse.body.frame * vec3f(0.0, 0.125, -0.03);
  return horse;
}

fn horse_pose(bone: f32, life: Life, time: f32) -> Joint {
  let horse = mount(life, time);
  let stride = horse.stride;
  let gallop = step(2.5, life.pace);
  let grazing = select(0.0, 0.5 + 0.5 * sin(time * 0.31 + life.seed * 50.0), life.activity == GRAZE);
  var joint = horse.body;
  if (bone == 17.0 || bone == 18.0) {
    // The neck nods with every step, reaches out in a gallop, and goes down to graze.
    let idle = sin(time * 0.7 + life.seed * 13.0) * 0.06 * (1.0 - life.go);
    let neck = 0.8 + idle + sin(stride * 2.0 + 0.5) * 0.07 * life.go * (1.0 - gallop) + (0.25 + cos(stride) * 0.12) * gallop
      + smoothstep(0.35, 0.65, grazing) * 1.45;
    joint.at = horse.body.at + horse.body.frame * vec3f(0.0, build.horse_legs.zw);
    joint.frame = horse.body.frame * turn_x(neck);
    if (bone == 18.0) {
      joint.at += joint.frame * vec3f(0.0, build.horse_ends.x, 0.0);
      joint.frame = horse.body.frame * turn_x(neck + 1.05 - smoothstep(0.35, 0.65, grazing) * 0.5 + sin(time * 9.0) * 0.04 * smoothstep(0.6, 0.7, grazing));
    }
  } else if (bone >= 19.0 && bone <= 26.0) {
    let pair = floor((bone - 19.0) * 0.5);
    let lower = (bone - 19.0) % 2.0 == 1.0;
    let fore = pair < 2.0;
    let side = select(1.0, -1.0, pair % 2.0 == 0.0);
    let along = select(-build.horse.z, build.horse.z, fore);
    let step_now = footfall(fract(life.phase + horse_gait(pair, life.pace)), life.duty, life.stride * life.duty / build.horse_ends.w, 0.07 + life.pace * 0.045);
    // At rest a horse shifts a hind hoof now and then.
    var foot = vec3f(side * build.horse.w, 0.0, along + step_now.x * life.go);
    foot.y = step_now.y * life.go + rise_under(life, foot);
    let shoulder = horse.body.at + horse.body.frame * vec3f(side * build.horse.w, build.horse.y - build.horse.x, along);
    let angles = reach(vec2f(foot.z - shoulder.z, foot.y - shoulder.y), build.horse_legs.x, build.horse_legs.y, select(-1.0, 1.0, fore));
    joint.at = shoulder;
    joint.frame = swing(angles.x);
    if (lower) {
      joint.at = shoulder + joint.frame * vec3f(0.0, -build.horse_legs.x, 0.0);
      joint.frame = swing(angles.y);
    }
  } else if (bone == 27.0) {
    joint.at = horse.body.at + horse.body.frame * vec3f(0.0, build.horse_ends.yz);
    joint.frame = horse.body.frame * turn_x(0.35 + life.go * 0.25 + gallop * 0.6);
  }
  joint.at *= build.horse_ends.w;
  return joint;
}

// ---------------------------------------------------------------------------------------------------------------
// The figure.

// The trunk a figure's limbs hang from, and how far it is through whatever it is doing.
struct Trunk {
  pelvis: vec3f,
  hips: mat3x3f,
  chest: Joint,
  // The chest's frame without its bend: what cloth hangs in.
  upright: mat3x3f,
  stride: f32,
  // A blow: how far wound up, and how far through.
  wound: f32,
  through: f32,
  // A fall: how far down, and the limbs' slack, which lags it.
  down: f32,
  slack: f32,
  flail: f32,
  run: f32,
}

fn trunk(life: Life, time: f32) -> Trunk {
  var body: Trunk;
  let stride = life.phase * TAU;
  let run = step(1.5, life.pace);
  let go = life.go;
  let riding = life.kind == RIDER;
  let breath = sin(time * 1.6 + life.seed * 40.0);
  let manner = fract(life.seed * 17.3);
  body.stride = stride;
  body.run = run;

  // The hips are lowest as a foot takes the weight and highest as the other passes; in a run, lowest mid-stance.
  let lowest = mix(0.02, 0.2, run) * TAU;
  let bob = (-cos((stride - lowest) * 2.0) * 0.016 * (1.0 + run * 1.5) - 0.012 * (1.0 + run)) * go * mix(0.8, 1.2, manner);
  // At rest the weight shifts slowly from one foot to the other.
  let shift = sin(time * 0.37 + life.seed * 9.0);
  let sway = mix(shift * 0.022, -sin(stride) * 0.018, go);
  let hips_turn = cos(stride) * 0.15 * go * (1.0 + run * 0.4);
  let hips_roll = mix(shift * 0.03, -sin(stride) * 0.05, go);
  var pelvis = vec3f(sway, build.legs.x + bob + breath * 0.003, 0.0);
  var root = turn_z(life.bank);
  var bend = mix(0.03 + breath * 0.008, 0.07 + run * 0.17, go);
  var twist = -hips_turn * 1.5;

  body.wound = 0.0;
  body.through = 0.0;
  if (life.activity == DUEL) {
    // A blow: wound up slowly with the weight going back, let go fast with a step into it, and recovered.
    let moment = life.moment;
    let hit = between(moment, 0.34, 0.43);
    body.wound = ease(moment / 0.34) * (1.0 - hit);
    body.through = hit * (1.0 - between(moment, 0.58, 0.95));
    pelvis.z += -0.05 * body.wound + 0.14 * body.through;
    pelvis.y -= 0.05 * body.through + 0.012 * body.wound;
    twist += -0.6 * body.wound + 0.5 * body.through;
    bend += -0.1 * body.wound + 0.3 * body.through;
  }

  body.down = 0.0;
  body.slack = 0.0;
  body.flail = 0.0;
  if (life.activity == FALLS) {
    // A fall: the knees give and the body crumples, goes over on its back, bounces once and lies as it landed.
    let down = life.moment;
    let landed = max(life.clock - 0.8, 0.0);
    let bounce = exp(-6.0 * landed) * abs(sin(landed * 10.0)) * 0.07 * step(0.0001, landed) * step(0.99, down);
    let side = fract(life.seed * 5.3) * 2.0 - 1.0;
    body.down = down;
    body.slack = ease(down * 1.2 - 0.2);
    body.flail = bump(down * 1.1) * (1.0 - down * 0.6);
    pelvis = vec3f(side * 0.1 * down, mix(build.legs.x, 0.075, down * down) + bounce, -0.36 * ease(down));
    let crumple = bump(down * 1.5) * (1.0 - down);
    root = turn_y(side * 0.8 * down) * turn_x(crumple * 0.35 - PI * 0.5 * between(down, 0.2, 1.0) - bounce * 1.6) * turn_z(side * 0.3 * down);
    bend = 0.55 * crumple + 0.03;
    twist = side * 0.35 * body.slack;
  }

  // At rest each stands his own way: turned a little, the weight on the foot he favours.
  let favours = (fract(life.seed * 3.9) - 0.5) * (1.0 - go) * step(life.activity, GUARD);
  twist += favours * 0.5;
  var hips_frame = root * turn_y(hips_turn + favours * 0.25) * turn_z(hips_roll + favours * 0.08);
  if (riding) {
    // In the saddle: the horse carries the hips, the rider rises to the trot and leans into the gallop.
    let horse = mount(life, time);
    let trot = step(1.5, life.pace) * step(life.pace, 2.5);
    pelvis = horse.seat * build.horse_ends.w + vec3f(0.0, max(sin(stride * 2.0 + 0.8), 0.0) * 0.035 * trot, 0.0);
    root = horse.body.frame;
    hips_frame = root;
    bend = 0.05 + step(2.5, life.pace) * 0.3 + sin(stride * 2.0) * 0.03 * life.go;
    twist = 0.0;
  }
  body.pelvis = pelvis;
  body.hips = hips_frame;
  body.upright = root * turn_y(twist);
  body.chest.at = pelvis + root * vec3f(0.0, build.trunk.w, 0.0);
  body.chest.frame = body.upright * turn_x(bend) * turn_z(-hips_roll * 1.2);
  return body;
}

// One leg: by reach to where its foot should be while the figure stands or walks, slack when it falls, bent
// round the horse when it rides.
fn leg(side: f32, part: f32, life: Life, body: Trunk) -> Joint {
  let hip = body.pelvis + body.hips * vec3f(side * build.legs.y, 0.0, 0.0);
  var upper_frame: mat3x3f;
  var lower_frame: mat3x3f;
  var foot_pitch = 0.0;
  if (life.kind == RIDER) {
    let grip = turn_z(side * 0.5);
    upper_frame = body.hips * grip * swing(1.05);
    lower_frame = body.hips * grip * swing(-0.2);
  } else if (life.activity == FALLS) {
    // Slack: the knees give first, then each leg lies as its own seed has it.
    let lot = fract(life.seed * (31.0 + side * 7.0));
    let give = body.flail;
    let splay = turn_z(side * mix(0.04, 0.1 + fract(lot * 7.0) * 0.45, body.slack));
    let thigh = give * 0.9 + body.slack * lot * lot * 1.3;
    let knee = give * 1.5 + body.slack * (lot * lot * 1.9 + 0.1);
    upper_frame = body.hips * splay * swing(thigh);
    lower_frame = body.hips * splay * swing(thigh - knee);
    foot_pitch = body.slack * 0.6;
  } else {
    let leg_phase = fract(life.phase + select(0.0, 0.5, side > 0.0));
    let step_now = footfall(leg_phase, life.duty, life.stride * life.duty, 0.06 + body.run * 0.1);
    // At rest the feet stand a little apart, one a touch ahead; a blow takes a step into it.
    let lead = select(0.0, 1.0, side * build.trunk.z < 0.0);
    let stance = mix(1.35, 1.0, life.go) + (body.wound + body.through) * 0.5;
    var foot = vec3f(side * build.legs.y * 1.1 * stance, build.trunk.x, mix(-side * 0.03, step_now.x, life.go));
    foot.z += (lead * 2.0 - 1.0) * 0.09 * (body.wound + body.through) + lead * body.through * 0.1;
    foot.y += step_now.y * life.go + lead * bump(body.through * 2.0) * step(body.wound, 0.01) * 0.03;
    foot.y += rise_under(life, foot);
    let toward = foot - hip;
    let angles = reach(vec2f(toward.z, toward.y), build.legs.z, build.legs.w, 1.0);
    let splay = turn_z(-side * atan2(toward.x, -toward.y));
    upper_frame = splay * swing(angles.x);
    lower_frame = splay * swing(angles.y);
    // The toe points down as the foot leaves the ground and up as it comes to land.
    let swung = step_now.z;
    foot_pitch = select(0.0, (1.0 - swung) * (1.0 - swung) * 0.75 - smoothstep(0.55, 1.0, swung) * 0.35, swung >= 0.0) * life.go;
  }
  var joint: Joint;
  joint.at = hip;
  joint.frame = upper_frame;
  if (part >= 1.0) {
    joint.at += upper_frame * vec3f(0.0, -build.legs.z, 0.0);
    joint.frame = lower_frame;
  }
  if (part >= 2.0) {
    joint.at += lower_frame * vec3f(0.0, -build.legs.w, 0.0);
    joint.frame = turn_x(foot_pitch);
    if (life.activity == FALLS || life.kind == RIDER) {
      joint.frame = lower_frame * turn_x(foot_pitch);
    }
  }
  return joint;
}

// One arm, and the weapon in the right hand. `part`: 0 the upper arm, 1 the forearm, 2 the weapon.
fn arm(side: f32, part: f32, life: Life, body: Trunk, time: f32) -> Joint {
  let stride = body.stride;
  let go = life.go;
  let manner = fract(life.seed * 23.7);
  let shield_arm = side * build.trunk.z < 0.0 && life.kind == SWORDSMAN;
  let weapon_arm = side * build.trunk.z > 0.0;
  let spear = life.kind != SWORDSMAN;
  // Arms swing against the legs, the forearm a beat behind the upper arm.
  let reach_out = (0.42 + body.run * 0.4) * mix(0.7, 1.2, manner) * go;
  var raise = side * cos(stride) * reach_out;
  var elbow = 0.22 + go * (0.2 + body.run * 0.95) + max(side * cos(stride - 0.7), 0.0) * 0.45 * go;
  var out = 0.12 + manner * 0.06;
  var wrist = 0.25;
  if (shield_arm) {
    // The shield rides in front of the body, and comes up to meet the other's blow.
    let parry = select(0.0, bump((life.moment - 0.78) / 0.3) + bump((life.moment + 0.22) / 0.3) * step(life.moment, 0.08), life.activity == DUEL);
    raise = raise * 0.35 + 0.3 + parry * 0.75;
    elbow = 1.2 + parry * 0.3;
    out = 0.05;
  }
  if (life.kind == RIDER && !weapon_arm) {
    // The reins.
    raise = 0.5;
    elbow = 1.0 + sin(stride * 2.0) * 0.06 * go;
  }
  if (weapon_arm && spear) {
    // A spear is carried upright, its hand at the hip; a thrust draws it back level and drives it out.
    raise = raise * 0.25 + 0.3;
    elbow = 1.27;
    wrist = 0.0;
    let level = max(body.wound, body.through);
    raise = mix(raise, -0.75 * body.wound + 0.95 * body.through, level);
    elbow = mix(elbow, 1.5 * body.wound + 0.25, level);
    wrist = mix(wrist, PI * 0.5 - (-0.75 * body.wound + 0.95 * body.through) + (1.5 * body.wound + 0.25) * -1.0 + 0.1, level);
  }
  if (weapon_arm && !spear) {
    // A sword hangs point down as he walks, goes up and back for a blow, and snaps through it.
    raise = raise * 0.55 + 0.12 + 2.5 * body.wound - 0.35 * body.through;
    elbow = elbow * 0.6 + 0.3 + 1.0 * body.wound - 0.2 * body.through;
    out += 0.4 * body.wound;
    wrist = 0.35 - 1.5 * body.wound + 0.55 * body.through;
  }
  if (weapon_arm && life.activity == CHEER) {
    // The weapon is pumped overhead, each man a beat after his neighbour.
    let pump = sin(life.moment * TAU * 0.5);
    raise = 2.5 + pump * 0.25;
    elbow = 0.5 - pump * 0.4;
    wrist = select(0.3, -1.2, spear);
  }
  // Falling, the arms are thrown up, then lie out from the body where they land.
  let lot = fract(life.seed * (41.0 + side * 3.0));
  raise = mix(raise, lot * 0.5 - 0.1, body.slack) + body.flail * 1.7;
  out = mix(out, 0.35 + lot * 1.7, body.slack);
  elbow = mix(elbow, 0.15 + fract(lot * 5.0) * 1.5, body.slack);

  // A shield is carried across the body, its face to the front.
  let across = select(0.0, -side * 0.95, shield_arm) * (1.0 - body.slack);
  let upper = body.chest.frame * turn_y(across) * turn_z(side * out) * swing(raise);
  let lower = upper * swing(elbow);
  var joint: Joint;
  joint.at = body.chest.at + body.chest.frame * vec3f(side * build.arms.y, build.arms.x, 0.0);
  joint.frame = upper;
  if (part >= 1.0) {
    joint.at += upper * vec3f(0.0, -build.arms.z, 0.0);
    joint.frame = lower;
  }
  if (part >= 2.0) {
    joint.at += lower * vec3f(0.0, -build.arms.w, 0.0);
    joint.frame = lower * turn_x(wrist);
  }
  return joint;
}

// Where a part's joint sits and how it is turned, for what the unit is doing at `time`.
fn pose(bone: f32, life: Life, time: f32) -> Joint {
  if (bone >= 16.0) {
    return horse_pose(bone, life, time);
  }
  let body = trunk(life, time);
  var joint: Joint;
  joint.at = body.pelvis;
  joint.frame = body.hips;
  if (bone == 1.0) {
    joint = body.chest;
  } else if (bone == 2.0) {
    // The head stays level and looks where the unit goes; at rest it looks about; in a fall it whips and lolls.
    let about = (sin(time * 0.5 + life.seed * 21.0) * 0.5 + sin(time * 1.3 + life.seed * 7.0) * 0.18) * (1.0 - life.go);
    let side = fract(life.seed * 5.3) * 2.0 - 1.0;
    joint.at = body.chest.at + body.chest.frame * vec3f(0.0, build.trunk.y, 0.0);
    joint.frame = body.upright * turn_y(about - life.bank * 1.2) * turn_x(0.5 * body.flail - 0.2 * body.down - 0.12 * body.wound + 0.15 * body.through) * turn_z(side * 0.45 * body.slack);
  } else if (bone >= 3.0 && bone <= 6.0) {
    joint = arm(select(1.0, -1.0, bone < 5.0), (bone - 3.0) % 2.0, life, body, time);
  } else if (bone >= 7.0 && bone <= 10.0) {
    joint = leg(select(1.0, -1.0, bone < 9.0), (bone - 7.0) % 2.0, life, body);
  } else if (bone == 11.0 || bone == 12.0) {
    joint = leg(select(1.0, -1.0, bone == 11.0), 2.0, life, body);
  } else if (bone == 13.0) {
    joint = arm(build.trunk.z, 2.0, life, body, time);
  } else if (bone == 14.0 || bone == 15.0) {
    // Cloth hangs from the chest in a frame that turns with it but does not bow.
    joint.at = body.chest.at;
    joint.frame = body.upright;
  }
  return joint;
}

// A cloth's vertex moved off its place at rest: swept back by the unit's pace, and waving, more the further it
// is from where it is pinned.
fn blown(bone: f32, at: vec3f, along: f32, life: Life, time: f32) -> vec3f {
  var moved = at;
  let pace = life.go * (1.0 + step(1.5, life.pace) * 1.4);
  let phase = life.seed * 30.0;
  if (bone == 14.0) {
    // A cloak.
    moved.z -= along * along * (0.03 + pace * 0.055) + sin(time * (2.6 + pace * 2.5) - along * 5.0 + phase) * 0.022 * along * (0.35 + pace * 0.6);
    moved.y += along * along * pace * 0.02;
    moved.x += sin(time * 2.1 + along * 4.0 + phase) * 0.02 * along * (0.4 + pace);
  } else if (bone == 15.0) {
    // A banner.
    moved.x += sin(time * 5.5 - along * 7.0 + phase) * 0.06 * along;
    moved.y -= along * along * 0.07 * (1.0 - min(pace, 1.0) * 0.6) + sin(time * 4.1 - along * 5.0 + phase) * 0.02 * along;
  } else if (bone == 27.0) {
    // A tail.
    moved.x += sin(time * 2.2 + along * 3.0 + phase) * 0.05 * along * (1.0 - life.go * 0.5);
  }
  return moved;
}

// Whether this unit wears a part of that kit.
fn wears(kit: f32, life: Life) -> bool {
  let lot = fract(life.seed * 13.7);
  if (kit == 1.0) { return life.kind == SWORDSMAN; }
  if (kit == 2.0) { return life.kind == SPEARMAN || life.kind == RIDER; }
  if (kit == 3.0) { return life.kind == RIDER; }
  if (kit == 4.0) { return lot < 0.5; }
  if (kit == 5.0) { return lot >= 0.5; }
  if (kit == 6.0) { return life.kind == RIDER || fract(life.seed * 91.3) < 0.4; }
  if (kit == 7.0) { return life.kind == SPEARMAN && fract(life.seed * 57.1) < 0.12; }
  return true;
}

const NOWHERE = vec4f(2.0, 2.0, 2.0, 1.0);

fn place_unit(input: UnitInput) -> UnitOutput {
  let time = globals.eye.w;
  let life = live(input, time);
  let bone = input.rig.x;
  let cloth = input.rig.w;
  let joint = pose(bone, life, time);
  let facing = turn_y(life.heading);
  // A unit's girth widens its trunk; cloth is blown off its place at rest.
  var local = input.position;
  if (bone <= 1.0) {
    local = vec3f(local.x * input.manner.x, local.y, local.z * input.manner.x);
  }
  if (cloth > 0.0) {
    local = blown(bone, local, cloth, life, time);
  }
  if (bone >= 16.0) {
    local *= build.horse_ends.w;
  }
  var posed = joint.at + joint.frame * local;
  if (input.split.y < 0.999) {
    // A vertex two bones share lies between where each would carry it.
    let other = pose(input.split.x, life, time);
    let scale = select(1.0, build.horse_ends.w, input.split.x >= 16.0);
    posed = mix(other.at + other.frame * input.other_position * scale, posed, input.split.y);
  }
  var output: UnitOutput;
  output.uv = input.uv;
  output.world = life.origin + facing * posed * life.height;
  if (cloth > 0.0) {
    output.world.y = max(output.world.y, life.origin.y + 0.012);
  }
  output.normal = facing * joint.frame * input.normal;
  // Each unit's cloth, leather and skin are a shade of their own.
  let shade = 0.82 + fract(life.seed * 71.9) * 0.36;
  let painted = mix(input.colour.rgb * mix(shade, 1.0, input.colour.a), input.colour.rgb * input.tint.rgb * 2.0, input.rig.y);
  output.colour = vec4f(painted, input.colour.a);
  output.mark = vec3f(0.0, 0.0, step(0.0001, cloth));
  output.clip = globals.view_proj * vec4f(output.world, 1.0);
  if (!wears(input.rig.z, life)) {
    output.clip = NOWHERE;
  }
  return output;
}

@vertex
fn vs(input: UnitInput) -> UnitOutput {
  return place_unit(input);
}

@vertex
fn vs_shadow(input: UnitInput) -> @builtin(position) vec4f {
  let placed = place_unit(input);
  return select(globals.light_view_proj * vec4f(placed.world, 1.0), NOWHERE, placed.clip.x == NOWHERE.x && placed.clip.z == NOWHERE.z);
}

@fragment
fn fs(input: UnitOutput) -> @location(0) vec4f {
  // Cloth has no facing of its own once it is blown: it is read off the screen.
  let across = cross(dpdx(input.world), dpdy(input.world));
  let view = globals.eye.xyz - input.world;
  let flat_normal = normalize(across) * sign(dot(across, view));
  let normal = normalize(mix(normalize(input.normal), flat_normal, input.mark.z));
  let sun = sunlight(input.world, normal);
  let albedo = input.colour.rgb * textureSample(paint, paint_sampler, input.uv).rgb;
  let colour = lit_by(albedo, normal, sun) + shine(input.world, normal, input.colour.a, sun) * mix(vec3f(1.0), albedo, 0.5);
  return vec4f(colour, length(view));
}

// ---------------------------------------------------------------------------------------------------------------
// What a unit leaves on the air and the ground: a soft shadow under it, a blade's trail, the dust of its feet.

@vertex
fn vs_effect(input: UnitInput) -> UnitOutput {
  let time = globals.eye.w;
  let bone = input.rig.x;
  let now = live(input, time);
  let facing = turn_y(now.heading);
  let mounted = now.kind >= RIDER;
  var output: UnitOutput;
  output.normal = vec3f(0.0, 1.0, 0.0);
  var hidden = false;
  if (bone == 28.0) {
    // The shadow: under the hips, longer under a horse, spread out under a fallen body.
    let body = trunk(now, time);
    let middle = select(vec3f(body.pelvis.x, 0.0, body.pelvis.z - body.down * 0.2), vec3f(0.0), mounted);
    let size = select(vec2f(0.3 + body.down * 0.1, 0.3 + body.down * 0.3), vec2f(0.5, 0.75), mounted);
    output.world = now.origin + facing * (middle + vec3f(input.position.x * size.x, 0.0, input.position.z * size.y)) * now.height;
    output.world.y = land_at(output.world.xz).x + 0.012;
    output.colour = vec4f(0.0, 0.0, 0.0, 0.5);
    output.mark = vec3f(input.position.xz, 2.0);
    // Round the shadow goes a ring of the unit's side: its colour rides where a facing would.
    output.normal = input.tint.rgb;
  } else if (bone == 29.0) {
    // The trail: the blade where it was up to a few hundredths of a second ago, fading with its age.
    let age = input.position.x;
    let then = time - age * 0.11;
    let was = live(input, then);
    let hand = pose(13.0, was, then);
    let on_blade = hand.at + hand.frame * vec3f(0.0, 0.0, 0.1 + input.position.y * 0.36);
    output.world = was.origin + turn_y(was.heading) * on_blade * was.height;
    let swinging = between(was.moment, 0.33, 0.36) * (1.0 - between(was.moment, 0.47, 0.56));
    output.colour = vec4f(1.5, 1.4, 1.2, (1.0 - age) * (1.0 - age) * swinging * 0.16);
    output.mark = vec3f(age, input.position.y * 2.0 - 1.0, 3.0);
    hidden = now.activity != DUEL || now.kind != SWORDSMAN;
  } else {
    // Dust: a puff where each of the last few feet came down, growing, rising and fading.
    let period = max(now.stride * now.height / max(abs(input.path.z), 0.001), 0.2);
    let beats = (time / period + input.manner.y) * 2.0;
    let age = (fract(beats) + input.position.z) * 0.5 * period;
    let then = time - age;
    let was = live(input, then);
    let old = clamp(age / 1.1, 0.0, 1.0);
    let which = (floor(beats) - input.position.z) % 2.0;
    let side = select(-1.0, 1.0, which == 0.0);
    let foot = was.origin + turn_y(was.heading) * vec3f(side * select(build.legs.y, build.horse.w, mounted), 0.0, was.stride * 0.3) * was.height;
    let size = (0.07 + old * 0.2) * now.height * select(1.0, 1.7, mounted);
    output.world = foot + (globals.camera_right.xyz * input.position.x + globals.camera_up.xyz * input.position.y) * size
      + vec3f(0.0, size * 0.6 + old * 0.09 * now.height, 0.0);
    let strength = select(0.0, select(0.5, 1.0, now.pace >= 3.0), now.pace >= 2.0);
    output.colour = vec4f(0.62, 0.55, 0.44, (1.0 - old) * (1.0 - old) * 0.5 * strength);
    output.mark = vec3f(input.position.xy, 4.0);
    hidden = strength == 0.0;
  }
  output.clip = globals.view_proj * vec4f(output.world, 1.0);
  if (hidden) {
    output.clip = NOWHERE;
  }
  return output;
}

@fragment
fn fs_effect(input: UnitOutput) -> @location(0) vec4f {
  let from_middle = length(input.mark.xy);
  var opacity = input.colour.a * smoothstep(1.0, 0.25, from_middle);
  var colour = input.colour.rgb;
  if (input.mark.z == 3.0) {
    opacity = input.colour.a * smoothstep(1.0, 0.4, abs(input.mark.y));
  }
  if (input.mark.z == 4.0) {
    colour = lit_by(colour, vec3f(0.0, 1.0, 0.0), 1.0);
  }
  if (input.mark.z == 2.0) {
    let ring = smoothstep(0.7, 0.8, from_middle) * smoothstep(0.98, 0.9, from_middle);
    colour = mix(colour, input.normal * 2.2, ring);
    opacity = max(opacity, ring * 0.85);
  }
  return vec4f(colour, opacity);
}
