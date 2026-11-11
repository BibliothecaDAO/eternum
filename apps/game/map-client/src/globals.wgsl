// What every pass reads: the camera, the light, the land map's rectangle and the hex grid's spacing.
struct Globals {
  view_proj: mat4x4f,
  inv_view_proj: mat4x4f,
  light_view_proj: mat4x4f,
  // xyz: the camera's place; w: the world clock in seconds.
  eye: vec4f,
  // w: 1 where the surface encodes colour for the screen itself.
  toward_light: vec4f,
  // w: the width of ground one texel of the shadow map covers.
  light_colour: vec4f,
  sky: vec4f,
  ground: vec4f,
  // x, y: the hexes' horizontal and vertical spacing. z, w: the frame's size in pixels.
  hex_and_screen: vec4f,
  // The land map's rectangle of ground: west, north, width, depth.
  world_bounds: vec4f,
  // x: the water's level. y: 1 while an order is shown.
  water: vec4f,
  // x: 1 where shadows are softened over nine taps. y: contact shadow taps. z: mist steps. w: the shadow map's size.
  quality: vec4f,
  // The camera's right and up, for whatever faces it.
  camera_right: vec4f,
  camera_up: vec4f,
  // An order shown on the map, as four hexes' middles on the ground: the army picked (xy), the two hexes it
  // crosses (zw, then xy), and the hex it is sent to (zw).
  order_from: vec4f,
  order_to: vec4f,
}
@group(0) @binding(0) var<uniform> globals: Globals;

fn hash3(p: vec3f) -> f32 {
  var q = fract(p * vec3f(0.1031, 0.1030, 0.0973));
  q += dot(q, q.yxz + 33.33);
  return fract((q.x + q.y) * q.z);
}

// Smooth value noise in [0, 1].
fn noise3(p: vec3f) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash3(i), hash3(i + vec3f(1, 0, 0)), u.x), mix(hash3(i + vec3f(0, 1, 0)), hash3(i + vec3f(1, 1, 0)), u.x), u.y),
    mix(mix(hash3(i + vec3f(0, 0, 1)), hash3(i + vec3f(1, 0, 1)), u.x), mix(hash3(i + vec3f(0, 1, 1)), hash3(i + vec3f(1, 1, 1)), u.x), u.y),
    u.z,
  );
}

// A ground position from the middle of the hex it lies in. The grid's hexes stand on a point: flat sides east and west.
fn from_hex_middle(ground: vec2f) -> vec2f {
  let period = vec2f(globals.hex_and_screen.x, globals.hex_and_screen.y * 2.0);
  let even = ground - floor(ground / period + 0.5) * period;
  let odd_ground = ground - period * 0.5;
  let odd = odd_ground - floor(odd_ground / period + 0.5) * period;
  return select(odd, even, dot(even, even) < dot(odd, odd));
}

// How far a point is from a hex's middle as a hex measures it: every point of one hex outline is as far. A hex of
// the grid ends at half the grid's horizontal spacing.
fn hex_reach(from_middle: vec2f) -> f32 {
  let local = abs(from_middle);
  return max(local.x, dot(local, vec2f(0.5, 0.8660254)));
}

// The distance to the nearest edge of the hex a ground position lies in, as the game's ground shader draws its grid.
fn hex_edge_distance(ground: vec2f) -> f32 {
  return globals.hex_and_screen.x * 0.5 - hex_reach(from_hex_middle(ground));
}

// 1 where two ground positions lie in the same hex.
fn same_hex(one: vec2f, other: vec2f) -> f32 {
  let apart = (one - from_hex_middle(one)) - (other - from_hex_middle(other));
  return step(dot(apart, apart), 0.01);
}

// The game's biomes, as the land's feature map numbers them (world.rs).
const DEEP_OCEAN = 0.0;
const OCEAN = 1.0;
const BEACH = 2.0;
const SUBTROPICAL_DESERT = 3.0;
const TROPICAL_RAIN_FOREST = 4.0;
const TROPICAL_SEASONAL_FOREST = 5.0;
const GRASSLAND = 6.0;
const TEMPERATE_DESERT = 7.0;
const TEMPERATE_RAIN_FOREST = 8.0;
const TEMPERATE_DECIDUOUS_FOREST = 9.0;
const SHRUBLAND = 10.0;
const BARE = 11.0;
const TAIGA = 12.0;
const TUNDRA_BIOME = 13.0;
const SNOW_BIOME = 14.0;
const SCORCHED = 15.0;
// What a biome's ground is made of.
const WATER = 0.0;
const SAND = 1.0;
const SNOW = 2.0;
const TUNDRA = 3.0;
const ROCK = 4.0;
const LAVA = 5.0;
const GRASS = 6.0;
const FOREST = 7.0;
// How well a hex is known.
const FRONTIER = 1.0;

fn ground_of(biome: f32) -> f32 {
  if (biome <= OCEAN) { return WATER; }
  if (biome == BEACH || biome == SUBTROPICAL_DESERT || biome == TEMPERATE_DESERT) { return SAND; }
  if (biome == SNOW_BIOME) { return SNOW; }
  if (biome == TUNDRA_BIOME) { return TUNDRA; }
  if (biome == BARE) { return ROCK; }
  if (biome == SCORCHED) { return LAVA; }
  if (biome == GRASSLAND || biome == SHRUBLAND) { return GRASS; }
  return FOREST;
}

// What the land's feature map tells of a point.
struct Features {
  // The biome, what its ground is made of, and how well its hex is known: 0 explored, 1 the next to explore, 2 unknown.
  biome: f32,
  ground: f32,
  known: f32,
  // How far into the unknown, in world units: negative over known land.
  unknown: f32,
}

// `cell` is the map's own texel, which holds the biome; `blended` its neighbours' blend, which holds the distance.
fn read_features(cell: vec4f, blended: vec4f) -> Features {
  let packed = round(cell.r * 255.0);
  var features: Features;
  features.biome = floor(packed / 16.0);
  features.ground = ground_of(features.biome);
  features.known = packed - features.biome * 16.0;
  features.unknown = (blended.g - 0.5) * 8.0;
  return features;
}

fn distance_to_stretch(at: vec2f, start: vec2f, end: vec2f) -> vec2f {
  let along = clamp(dot(at - start, end - start) / max(dot(end - start, end - start), 0.000001), 0.0, 1.0);
  return vec2f(length(start + (end - start) * along - at), along * length(end - start));
}

// How an order marks a point of the ground. x: its path, dashes that run toward where the army is sent. y: the
// edges of the hex the army stands on. z: the hex it is sent to, whole. All 0 while no order is shown.
fn order_marks(at: vec2f) -> vec3f {
  let stops = array<vec2f, 4>(globals.order_from.xy, globals.order_from.zw, globals.order_to.xy, globals.order_to.zw);
  var nearest = vec2f(1000.0, 0.0);
  var gone = 0.0;
  for (var stretch = 0; stretch < 3; stretch++) {
    let here = distance_to_stretch(at, stops[stretch], stops[stretch + 1]);
    if (here.x < nearest.x) {
      nearest = vec2f(here.x, gone + here.y);
    }
    gone += length(stops[stretch + 1] - stops[stretch]);
  }
  let time = globals.eye.w;
  let dashes = smoothstep(0.35, 0.5, abs(fract(nearest.y * 2.4 - time * 1.2) - 0.5) * 2.0);
  let path = (1.0 - smoothstep(0.045, 0.075, nearest.x)) * dashes;
  let edge = hex_edge_distance(at);
  let on_picked = same_hex(at, stops[0]) * (1.0 - smoothstep(0.03, 0.07, edge));
  let on_target = same_hex(at, stops[3]);
  return vec3f(path, on_picked, on_target) * globals.water.y;
}

// 1 within `width` of where `value` equals `at`, falling off to either side.
fn band(value: f32, at: f32, width: f32) -> f32 {
  return 1.0 - smoothstep(0.0, width, abs(value - at));
}
