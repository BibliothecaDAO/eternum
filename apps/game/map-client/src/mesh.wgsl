// Every mesh of the patch: instanced and lit (lit.wgsl). The ground takes its relief and grain from the detail
// tile; the water its depth, foam and waves from the land map.
struct Material {
  // x: 0 solid, 1 ground, 2 water, 3 a plant that sways, 4 a bird on the wing.
  kind: vec4f,
}
@group(1) @binding(0) var<uniform> material: Material;
// A model's painted texture; white for a mesh that has none.
@group(1) @binding(1) var paint: texture_2d<f32>;
@group(1) @binding(2) var paint_sampler: sampler;
struct VertexInput {
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
  // a: the surface's gloss.
  @location(2) colour: vec4f,
  @location(3) uv: vec2f,
  @location(4) model_0: vec4f,
  @location(5) model_1: vec4f,
  @location(6) model_2: vec4f,
  @location(7) model_3: vec4f,
  @location(8) tint: vec4f,
}

struct VertexOutput {
  @builtin(position) clip: vec4f,
  @location(0) world: vec3f,
  @location(1) normal: vec3f,
  @location(2) colour: vec4f,
  // How high a plant's vertex stands over its foot, as a share of the plant.
  @location(3) reach: f32,
  @location(4) uv: vec2f,
}

fn swell(ground: vec2f, time: f32) -> f32 {
  return sin(ground.x * 1.45 + ground.y * 0.58 - time * 1.05) * 0.62
    + sin(ground.x * -0.63 + ground.y * 1.22 - time * 0.83) * 0.28;
}

fn place(input: VertexInput) -> vec4f {
  let model = mat4x4f(input.model_0, input.model_1, input.model_2, input.model_3);
  var world = model * vec4f(input.position, 1.0);
  if (material.kind.x == 2.0) {
    world.y += (swell(world.xz, globals.eye.w) - 1.0) * 0.03;
  }
  if (material.kind.x == 3.0) {
    // A plant leans with the wind by its height over its foot, and its leaves shiver.
    let foot = model[3].xyz;
    let reach = max(world.y - foot.y, 0.0);
    let time = globals.eye.w;
    let gust = sin(time * 1.7 + foot.x * 0.9 + foot.z * 0.7) + sin(time * 3.1 + foot.x * 2.3) * 0.4;
    let shiver = sin(time * 5.3 + world.x * 9.0 + world.z * 7.0 + world.y * 5.0);
    world.x += gust * reach * reach * 0.045 + shiver * reach * 0.006;
    world.z += gust * reach * reach * 0.02;
  }
  if (material.kind.x == 4.0) {
    // A bird wheels round its placement's middle, at the placement's size from it, and beats its wings.
    let time = globals.eye.w;
    let lot = input.tint.a;
    let radius = length(model[0].xyz);
    let way = select(-1.0, 1.0, lot > 0.5);
    let angle = lot * 40.0 + way * time * (0.5 + lot * 0.3) / radius;
    let round_it = vec3f(cos(angle), 0.0, sin(angle));
    let ahead = vec3f(-round_it.z, 0.0, round_it.x) * way;
    let beat = sin(time * (7.0 + lot * 3.0) + lot * 20.0);
    let wing = abs(input.position.x);
    let local = vec3f(input.position.x * (1.0 - 0.25 * abs(beat)), wing * beat * 0.55, input.position.z) * 0.085;
    let at = model[3].xyz + round_it * radius + vec3f(0.0, sin(time * 0.4 + lot * 9.0) * 0.25, 0.0);
    world = vec4f(at + cross(ahead, vec3f(0.0, 1.0, 0.0)) * local.x + vec3f(0.0, local.y, 0.0) + ahead * local.z, 1.0);
  }
  return world;
}

@vertex
fn vs(input: VertexInput) -> VertexOutput {
  let model = mat4x4f(input.model_0, input.model_1, input.model_2, input.model_3);
  let world = place(input);
  var output: VertexOutput;
  output.clip = globals.view_proj * world;
  output.world = world.xyz;
  output.normal = normalize((model * vec4f(input.normal, 0.0)).xyz);
  output.colour = vec4f(input.colour.rgb * input.tint.rgb, input.colour.a);
  output.reach = clamp(input.position.y * 1.6, 0.0, 1.0);
  output.uv = input.uv;
  return output;
}

@vertex
fn vs_shadow(input: VertexInput) -> @builtin(position) vec4f {
  return globals.light_view_proj * place(input);
}

fn hex_line(ground: vec2f) -> f32 {
  let edge = hex_edge_distance(ground);
  return 1.0 - smoothstep(0.006, fwidth(edge) * 1.3 + 0.012, edge);
}

struct Surface {
  albedo: vec3f,
  normal: vec3f,
  gloss: f32,
  // Light the surface gives off itself.
  glow: vec3f,
}

const WIND = vec2f(0.8, 0.6);

// The ground, by what its biome is made of: rippled sand, drifted snow, tundra with snow in its hollows, slabs of
// rock, a crust over lava that glows in its cracks, grass the wind runs over, a forest's litter. A biome's edge
// wanders off the hexes' edges. The hex grid shows where the unknown is near.
fn ground_surface(input: VertexOutput) -> Surface {
  let time = globals.eye.w;
  let at = input.world.xz;
  let top = smoothstep(0.55, 0.9, input.normal.y);
  let base = input.colour.rgb;
  let near = textureSample(detail_tile, tile_sampler, at * 0.95);
  let middle = textureSample(detail_tile, tile_sampler, at.yx * 0.31 + vec2f(0.13, 0.57));
  let far = textureSample(detail_tile, tile_sampler, at.yx * 0.11 + vec2f(0.37, 0.11));
  let flow = textureSample(wave_tile, tile_sampler, at * 0.27 + vec2f(time * 0.04, time * 0.025));
  let line = hex_line(at);
  let grain = near.g * 0.55 + far.g * 0.45;
  let here = features_at(at);
  // The kind is read a little way off, by a slow noise: a biome's edge is not a hex's.
  let wander = vec2f(middle.g - 0.5, far.g - 0.5) * 1.1 + (near.ba - 0.5) * 0.12;
  let kind = features_at(at + wander).ground;

  var albedo = base * (0.84 + grain * 0.3) * (0.9 + far.r * 0.16);
  var slope = vec2f(0.0);
  var gloss = 0.0;
  var glow = vec3f(0.0);
  if (kind == SAND) {
    // Ripples the wind has combed, bent by the lie of the land.
    let phase = dot(at, WIND) * 15.0 + far.g * 10.0 + middle.g * 4.0;
    albedo = base * (0.9 + 0.1 * sin(phase)) * (0.92 + far.r * 0.14);
    slope = WIND * cos(phase) * 0.22;
    gloss = step(0.93, near.r * near.g * 1.6) * 0.5;
  } else if (kind == SNOW || kind == TUNDRA) {
    // Tundra keeps its snow in patches; a snowfield is all drift.
    let lies = select(1.0, smoothstep(0.42, 0.56, middle.g * 0.6 + far.g * 0.4), kind == TUNDRA);
    let bare = base * vec3f(0.94, 0.8, 0.7) * (0.7 + near.r * 0.42);
    let snow = mix(base, vec3f(0.86, 0.9, 0.96), 0.55) * (0.93 + grain * 0.1);
    albedo = mix(bare, snow, lies);
    slope = mix((near.ba - 0.5) * 0.7, (middle.ba - 0.5) * 0.45, lies);
    gloss = lies * step(0.9, near.r * near.g * 1.7) * 0.8;
  } else if (kind == ROCK) {
    // Slabs with cracks between them, and smaller stones on the slabs.
    albedo = base * vec3f(0.9, 0.86, 0.82) * (0.52 + middle.r * 0.5) * (0.78 + near.r * 0.3);
    slope = (middle.ba - 0.5) * 1.3 + (near.ba - 0.5) * 0.5;
  } else if (kind == LAVA) {
    // A dark crust in plates; the cracks between them glow, and the glow travels along them.
    let crack = 1.0 - smoothstep(0.02, 0.4, middle.r);
    let heat = crack * (0.45 + 0.55 * sin(time * 1.1 + flow.b * 14.0 + far.g * 9.0));
    albedo = base * 0.55 * (0.6 + middle.r * 0.5) * (0.8 + near.r * 0.3);
    slope = (middle.ba - 0.5) * 1.5;
    glow = vec3f(5.0, 1.3, 0.2) * heat * heat + vec3f(1.4, 0.2, 0.02) * crack;
  } else if (kind == GRASS) {
    // Tufts lighter and darker, patches gone dry, and the wind's gusts running over it as bands of lighter green.
    let tufts = near.g * 0.5 + middle.g * 0.5;
    let gust = smoothstep(0.55, 1.0, sin(dot(at, WIND) * 0.85 - time * 1.3 + far.g * 7.0));
    albedo = base * (0.8 + tufts * 0.4) * (1.0 + gust * 0.1);
    albedo = mix(albedo, albedo * vec3f(1.12, 1.02, 0.7), smoothstep(0.45, 0.75, far.g) * 0.5);
    slope = (near.ba - 0.5) * 0.15;
  } else if (kind == FOREST) {
    // Litter and moss under the trees: darker, mottled.
    albedo = base * (0.62 + grain * 0.4) * mix(vec3f(1.0), vec3f(0.8, 0.95, 0.7), smoothstep(0.4, 0.7, middle.g));
    slope = (near.ba - 0.5) * 0.3;
  }

  // The side of a raised hex: darker earth in bands. The shore: a dark wet band.
  let strata = 0.55 + 0.25 * sin(input.world.y * 38.0 + grain * 5.0);
  albedo = mix(base * vec3f(0.5, 0.42, 0.36) * strata, albedo, top);
  let shore = land_at(at).y;
  albedo *= mix(0.6, 1.0, smoothstep(0.0, 0.3, shore + (grain - 0.5) * 0.2));
  // The grid is faint over land well known, and plain where the next hex to explore is near.
  let near_unknown = smoothstep(-2.2, -0.2, here.unknown);
  albedo = mix(albedo, albedo * 0.45, line * mix(0.16, 0.6, near_unknown) * top);

  // An order: its path in running dashes, and the picked army's hex lit along its edges.
  let marks = order_marks(at);
  let pulse = 0.8 + 0.2 * sin(time * 3.0);
  glow = glow * top + vec3f(1.0, 0.8, 0.35) * (marks.x * 1.1 + marks.y * 1.6 * pulse) * top;

  var surface: Surface;
  surface.albedo = albedo;
  surface.normal = normalize(normalize(input.normal) + vec3f(-slope.x, 0.0, -slope.y) * top);
  surface.gloss = gloss;
  surface.glow = glow;
  return surface;
}

// The water: clear and green over the shallows, dark over the deep, foam lapping the shore, the sky on its waves.
fn water_surface(input: VertexOutput) -> Surface {
  let time = globals.eye.w;
  let ground = input.world.xz;
  let offshore = max(-land_at(ground).y, 0.0);
  let one = textureSample(wave_tile, tile_sampler, ground * 0.23 + vec2f(time * 0.021, time * 0.013));
  let two = textureSample(wave_tile, tile_sampler, ground.yx * 0.37 - vec2f(time * 0.017, -time * 0.024));
  let ripple = (one.rg - 0.5) + (two.rg - 0.5);
  let swell_slope = vec2f(
    swell(ground + vec2f(0.05, 0.0), time) - swell(ground, time),
    swell(ground + vec2f(0.0, 0.05), time) - swell(ground, time),
  );
  let depth = smoothstep(0.0, 2.4, offshore);
  let shallow = mix(input.colour.rgb, vec3f(0.14, 0.6, 0.52), 0.5) * 1.2;
  let deep = input.colour.rgb * vec3f(0.5, 0.68, 0.9);
  var albedo = mix(shallow, deep, depth);
  // Light dances on the bed of the shallows.
  albedo += vec3f(0.3, 0.38, 0.26) * one.a * two.a * (1.0 - depth) * (1.0 - depth);
  albedo = mix(albedo, albedo * 0.72, hex_line(ground) * 0.3);
  // Foam: a ragged band at the waterline, and thin lines that travel to the shore and fade.
  let ragged = one.b * 0.6 + two.b * 0.4;
  let band = 1.0 - smoothstep(0.02, 0.16, offshore + (ragged - 0.5) * 0.2);
  let wave = fract(offshore * 1.25 + time * 0.16 + ragged * 0.7);
  let lapping = smoothstep(0.84, 0.96, wave) * smoothstep(1.4, 0.15, offshore) * smoothstep(0.3, 0.6, ragged);
  let foam = clamp(band + lapping * 0.75, 0.0, 1.0);
  var surface: Surface;
  surface.albedo = mix(albedo, vec3f(0.86, 0.92, 0.9), foam);
  surface.normal = normalize(vec3f(-swell_slope.x * 0.6 - ripple.x * 0.5, 1.0, -swell_slope.y * 0.6 - ripple.y * 0.5));
  surface.gloss = 1.0 - foam;
  surface.glow = vec3f(0.0);
  return surface;
}

@fragment
fn fs(input: VertexOutput) -> @location(0) vec4f {
  var surface: Surface;
  surface.albedo = input.colour.rgb * textureSample(paint, paint_sampler, input.uv).rgb;
  surface.normal = normalize(input.normal);
  surface.gloss = input.colour.a;
  surface.glow = vec3f(0.0);
  if (material.kind.x == 1.0) {
    surface = ground_surface(input);
  }
  if (material.kind.x == 2.0) {
    surface = water_surface(input);
  }
  let sun = sunlight(input.world, surface.normal);
  var colour = lit_by(surface.albedo, surface.normal, sun);
  let view = normalize(globals.eye.xyz - input.world);
  if (material.kind.x == 2.0) {
    // The sky on the water, more of it the flatter the eye looks, and the sun's glitter.
    let fresnel = pow(1.0 - clamp(dot(surface.normal, view), 0.0, 1.0), 4.0);
    colour = mix(colour, globals.sky.rgb * vec3f(1.5, 1.9, 2.4), fresnel * 0.6 * surface.gloss);
    let half_way = normalize(view + globals.toward_light.xyz);
    colour += globals.light_colour.rgb * pow(max(dot(surface.normal, half_way), 0.0), 220.0) * sun * surface.gloss * 2.5;
  } else if (material.kind.x == 3.0) {
    // Leaves: dark inside the crown, and lit through from behind.
    let through = max(dot(-surface.normal, globals.toward_light.xyz), 0.0) * sun;
    colour = colour * mix(0.62, 1.08, input.reach) + surface.albedo * globals.light_colour.rgb * through * 0.22;
  } else if (surface.gloss > 0.0) {
    colour += shine(input.world, surface.normal, surface.gloss, sun) * surface.albedo;
  }
  // Beside the colour, how far from the eye the surface is: the post pass finds the surface again by it.
  return vec4f(colour + surface.glow, length(globals.eye.xyz - input.world));
}
