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

// Small things strewn on the ground, each a hex of `size` in one of a grid's cells, `fine` cells to a unit of ground
// and a `share` of them holding one. x: 1 inside one. y: a number of its own, in [0, 1).
fn strewn(at: vec2f, fine: f32, share: f32, size: f32) -> vec2f {
  let cell = floor(at * fine);
  let lot = vec3f(cell.x, 3.7, cell.y);
  let middle = (cell + 0.25 + 0.5 * vec2f(hash3(lot * 1.3), hash3(lot * 2.9))) / fine;
  let inside = step(hex_reach(at - middle) * fine, size) * step(hash3(lot * 5.1), share);
  return vec2f(inside, hash3(lot * 7.7));
}

// The biome of the hex a point lies in, read at the hex's middle: the hex's own edge is its biome's.
fn biome_at(point: vec2f) -> f32 {
  let ground = point - from_hex_middle(point);
  let uv = clamp((ground - globals.world_bounds.xy) / globals.world_bounds.zw, vec2f(0.0), vec2f(0.9999));
  let packed = round(textureLoad(feature_map, vec2i(uv * vec2f(textureDimensions(feature_map))), 0).r * 255.0);
  return floor(packed / 4.0);
}

// What lies round a point of ground, each as the share of six points about it: what a frontier carries across.
struct Around {
  snow: f32,
  lava: f32,
  sand: f32,
  green: f32,
  rock: f32,
}

fn around(at: vec2f, reach: f32) -> Around {
  var found: Around;
  for (var tap = 0; tap < 6; tap++) {
    let angle = f32(tap) * 1.0471976 + 0.5;
    let ground = ground_of(biome_at(at + vec2f(cos(angle), sin(angle)) * reach));
    found.snow += select(0.0, 1.0, ground == SNOW || ground == TUNDRA);
    found.lava += select(0.0, 1.0, ground == LAVA);
    found.sand += select(0.0, 1.0, ground == SAND);
    found.green += select(0.0, 1.0, ground == GRASS || ground == FOREST);
    found.rock += select(0.0, 1.0, ground == ROCK);
  }
  found.snow /= 6.0;
  found.lava /= 6.0;
  found.sand /= 6.0;
  found.green /= 6.0;
  found.rock /= 6.0;
  return found;
}

// The ground, by its biome: a beach's fine wet sand, a desert's dunes, a dry pan's cracked plates, grass with flowers
// the wind runs over, heath with bare earth, the wet floor of a rain forest, red earth, moss, fallen leaves, needles
// with snow in the hollows, tundra, a snowfield, slabs of rock with lichen, a crust over lava. A biome's edge wanders
// off the hexes' edges and breaks into patches, and each ground carries something of itself over the frontier: snow
// dusts what lies beside it, sand blows over grass, grass creeps into sand, stones roll off the rock, ash lies round
// the lava. The hex grid shows where the unknown is near.
fn ground_surface(input: VertexOutput) -> Surface {
  let time = globals.eye.w;
  let at = input.world.xz;
  let top = smoothstep(0.55, 0.9, input.normal.y);
  let near = textureSample(detail_tile, tile_sampler, at * 0.95);
  let middle = textureSample(detail_tile, tile_sampler, at.yx * 0.31 + vec2f(0.13, 0.57));
  let far = textureSample(detail_tile, tile_sampler, at.yx * 0.11 + vec2f(0.37, 0.11));
  let flow = textureSample(wave_tile, tile_sampler, at * 0.27 + vec2f(time * 0.04, time * 0.025));
  let line = hex_line(at);
  let grain = near.g * 0.55 + far.g * 0.45;
  let here = features_at(at);
  // The biome is read a little way off: by a slow noise, so its edge is not a hex's, and by a fine one, so the edge
  // breaks into patches of either ground.
  let wander = vec2f(middle.g - 0.5, far.g - 0.5) * 1.1;
  let other = textureSample(detail_tile, tile_sampler, at.yx * 0.71 + vec2f(0.31, 0.77));
  let patches = vec2f(near.g - 0.5, other.g - 0.5) * 0.7;
  let lies_at = at + wander + patches;
  let biome = biome_at(lies_at);
  // Small things are drawn only near the eye: far off they would only glitter.
  let close = smoothstep(18.0, 8.0, length(globals.eye.xyz - input.world));
  let kind = ground_of(biome);
  // The colour follows the ground it paints, softened by the mesh's own blend across the hexes.
  let palette_uv = clamp((lies_at - from_hex_middle(lies_at) - globals.world_bounds.xy) / globals.world_bounds.zw, vec2f(0.0), vec2f(0.9999));
  let painted = pow(textureSampleLevel(palette_map, map_sampler, palette_uv, 0.0).rgb, vec3f(2.2));
  let base = mix(input.colour.rgb, painted, select(0.7, 0.0, kind == WATER));
  let glint = strewn(at, 34.0, 0.1, 0.22);
  let sparkle = glint.x * close * (0.55 + 0.45 * sin(time * 2.6 + glint.y * 40.0));

  var albedo = base * (0.84 + grain * 0.3) * (0.9 + far.r * 0.16);
  var slope = vec2f(0.0);
  var gloss = 0.0;
  var glow = vec3f(0.0);
  if (biome == BEACH) {
    // Fine ripples, pale and dry above, darker where the sea has been; shells.
    let phase = dot(at, WIND) * 26.0 + far.g * 8.0 + middle.g * 3.0;
    albedo = base * vec3f(1.08, 1.04, 0.95) * (0.94 + 0.06 * sin(phase)) * (0.94 + far.r * 0.1);
    albedo = mix(albedo, vec3f(0.95, 0.9, 0.84), strewn(at, 11.0, 0.12, 0.2).x * close * 0.8);
    slope = WIND * cos(phase) * 0.1;
    gloss = sparkle * 0.6;
  } else if (biome == SUBTROPICAL_DESERT) {
    // Dunes: long crests lit on one side, the wind's ripples over them.
    let across = vec2f(0.55, 0.83);
    let rise = dot(at, across) * 2.3 + far.g * 6.0 + middle.g * 1.5;
    let phase = dot(at, WIND) * 17.0 + far.g * 10.0;
    albedo = base * mix(vec3f(0.84, 0.76, 0.7), vec3f(1.14, 1.06, 0.9), sin(rise) * 0.5 + 0.5) * (0.93 + 0.07 * sin(phase));
    slope = across * cos(rise) * 0.55 + WIND * cos(phase) * 0.14;
    gloss = sparkle * 0.5;
  } else if (biome == TEMPERATE_DESERT) {
    // A dry pan: plates of baked earth with cracks between them, gravel, the stain of old scrub.
    let crack = 1.0 - smoothstep(0.02, 0.2, middle.r);
    albedo = base * vec3f(0.96, 0.9, 0.84) * (0.8 + middle.g * 0.3) * (1.0 - crack * 0.62);
    albedo = mix(albedo, base * vec3f(0.66, 0.7, 0.52), smoothstep(0.6, 0.78, far.g) * 0.5);
    let gravel = strewn(at, 8.0, 0.2 * smoothstep(0.45, 0.7, other.g), 0.12 + 0.16 * near.g);
    albedo = mix(albedo, vec3f(0.5, 0.45, 0.4) * (0.7 + gravel.y * 0.6), gravel.x * close * 0.8);
    slope = (middle.ba - 0.5) * crack * 1.2 + (near.ba - 0.5) * 0.2;
  } else if (kind == SNOW || kind == TUNDRA) {
    // Tundra keeps its snow in patches; a snowfield is all drift, blue in its hollows.
    let lies = select(1.0, smoothstep(0.42, 0.56, middle.g * 0.6 + far.g * 0.4), kind == TUNDRA);
    let bare = base * vec3f(0.94, 0.8, 0.7) * (0.7 + near.r * 0.42);
    let drift = mix(vec3f(0.74, 0.82, 0.98), vec3f(1.0), smoothstep(0.3, 0.7, middle.g));
    let snow = mix(base, vec3f(0.86, 0.9, 0.96), 0.55) * (0.93 + grain * 0.1) * drift;
    albedo = mix(bare, snow, lies);
    // Bare ground is cracked by the frost; snow lies smooth, combed a little by the wind.
    let combed = dot(at, WIND) * 6.0 + far.g * 9.0 + middle.g * 4.0;
    let smooth_snow = select(0.0, 1.0, kind == SNOW);
    slope = mix((near.ba - 0.5) * 0.7, mix((middle.ba - 0.5) * 0.45, WIND * cos(combed) * 0.12, smooth_snow), lies);
    gloss = lies * sparkle * 0.9;
  } else if (kind == ROCK) {
    // Slabs with cracks between them, smaller stones on the slabs, lichen where it is damp.
    albedo = base * vec3f(0.9, 0.86, 0.82) * (0.52 + middle.r * 0.5) * (0.78 + near.r * 0.3);
    albedo = mix(albedo, vec3f(0.36, 0.42, 0.2) * (0.7 + near.g * 0.5), smoothstep(0.58, 0.74, far.g * 0.55 + near.g * 0.45) * 0.4);
    slope = (middle.ba - 0.5) * 1.3 + (near.ba - 0.5) * 0.5;
  } else if (kind == ETHEREAL) {
    // The ground under the world: dark slate in plates, with veins of the mist's own light that brighten and fade,
    // and crystals strewn over it that catch it.
    let vein = 1.0 - smoothstep(0.02, 0.22, middle.r);
    let breath = 0.5 + 0.5 * sin(time * 0.7 + far.g * 9.0 + flow.b * 6.0);
    albedo = vec3f(0.11, 0.1, 0.15) * (0.6 + middle.r * 0.6) * (0.8 + near.r * 0.3);
    slope = (middle.ba - 0.5) * 1.2;
    glow = vec3f(0.9, 0.35, 1.6) * vein * vein * (0.25 + 0.75 * breath);
    let crystal = strewn(at, 6.0, 0.14, 0.2 + 0.16 * near.g);
    albedo = mix(albedo, vec3f(0.45, 0.3, 0.7), crystal.x * close);
    gloss = crystal.x * close * 0.9;
  } else if (kind == LAVA) {
    // A dark crust in plates; the cracks between them glow, and the glow travels along them.
    let crack = 1.0 - smoothstep(0.02, 0.4, middle.r);
    let heat = crack * (0.45 + 0.55 * sin(time * 1.1 + flow.b * 14.0 + far.g * 9.0));
    albedo = base * 0.55 * (0.6 + middle.r * 0.5) * (0.8 + near.r * 0.3);
    slope = (middle.ba - 0.5) * 1.5;
    glow = vec3f(5.0, 1.3, 0.2) * heat * heat + vec3f(1.4, 0.2, 0.02) * crack;
  } else if (biome == GRASSLAND) {
    // Tufts lighter and darker, the wind's gusts running over it as bands of lighter green, and flowers.
    let tufts = near.g * 0.5 + middle.g * 0.5;
    let gust = smoothstep(0.55, 1.0, sin(dot(at, WIND) * 0.85 - time * 1.3 + far.g * 7.0));
    albedo = base * (0.8 + tufts * 0.4) * (1.0 + gust * 0.12);
    let bloom = strewn(at, 13.0, 0.22, 0.2);
    let flower = mix(mix(vec3f(0.95, 0.92, 0.82), vec3f(0.98, 0.78, 0.12), step(0.4, bloom.y)), vec3f(0.62, 0.36, 0.85), step(0.75, bloom.y));
    albedo = mix(albedo, flower, bloom.x * close * smoothstep(0.42, 0.6, far.g));
    slope = (near.ba - 0.5) * 0.15;
  } else if (biome == SHRUBLAND) {
    // Heath: dry grass, patches of bare earth, heather.
    let tufts = near.g * 0.5 + middle.g * 0.5;
    let gust = smoothstep(0.6, 1.0, sin(dot(at, WIND) * 0.85 - time * 1.3 + far.g * 7.0));
    albedo = base * vec3f(1.08, 1.0, 0.78) * (0.76 + tufts * 0.42) * (1.0 + gust * 0.08);
    albedo = mix(albedo, vec3f(0.4, 0.29, 0.19) * (0.8 + near.g * 0.4), smoothstep(0.5, 0.66, middle.g * 0.6 + far.g * 0.4) * 0.75);
    albedo = mix(albedo, albedo * vec3f(1.25, 0.8, 1.3), smoothstep(0.66, 0.82, far.r) * 0.45);
    slope = (near.ba - 0.5) * 0.25;
  } else if (biome == TROPICAL_RAIN_FOREST) {
    // A wet floor, dark and rich, with standing water that takes the sky.
    albedo = base * vec3f(0.72, 0.98, 0.74) * (0.56 + grain * 0.46);
    albedo = mix(albedo, base * vec3f(0.95, 1.3, 0.6), smoothstep(0.62, 0.72, near.g) * 0.35);
    gloss = smoothstep(0.6, 0.76, middle.g) * 0.7;
    albedo *= 1.0 - gloss * 0.35;
    slope = (near.ba - 0.5) * 0.3 * (1.0 - gloss);
  } else if (biome == TROPICAL_SEASONAL_FOREST) {
    // Dry season: yellowed growth over red earth.
    albedo = base * (0.7 + grain * 0.4) * mix(vec3f(1.0), vec3f(1.16, 1.0, 0.6), smoothstep(0.4, 0.7, far.g));
    albedo = mix(albedo, vec3f(0.5, 0.21, 0.11) * (0.8 + near.g * 0.4), smoothstep(0.58, 0.72, middle.g) * 0.65);
    slope = (near.ba - 0.5) * 0.3;
  } else if (biome == TEMPERATE_RAIN_FOREST) {
    // Moss in cushions over a damp floor.
    albedo = base * vec3f(0.78, 0.98, 0.88) * (0.58 + grain * 0.4);
    albedo = mix(albedo, base * vec3f(0.9, 1.4, 0.66), smoothstep(0.52, 0.7, middle.g) * 0.55);
    gloss = smoothstep(0.55, 0.85, far.g) * 0.25;
    slope = (middle.ba - 0.5) * 0.5;
  } else if (biome == TEMPERATE_DECIDUOUS_FOREST) {
    // Fallen leaves, orange and yellow, over the litter.
    albedo = base * (0.62 + grain * 0.4);
    let fallen = strewn(at, 10.0, 0.3, 0.2 + 0.14 * near.g);
    let leaf = mix(vec3f(0.7, 0.3, 0.07), vec3f(0.84, 0.64, 0.14), fallen.y);
    albedo = mix(albedo, leaf * (0.8 + near.g * 0.4), max(fallen.x * close, smoothstep(0.5, 0.75, far.g) * 0.3) * 0.85);
    slope = (near.ba - 0.5) * 0.35;
  } else if (biome == TAIGA) {
    // Needles under the firs, and snow that has stayed in the hollows.
    albedo = base * vec3f(0.92, 0.86, 0.76) * (0.55 + grain * 0.4);
    albedo = mix(albedo, vec3f(0.3, 0.2, 0.12) * (0.8 + near.g * 0.4), smoothstep(0.5, 0.7, middle.g) * 0.45);
    let lies = smoothstep(0.5, 0.6, far.g * 0.5 + other.g * 0.5);
    albedo = mix(albedo, vec3f(0.8, 0.86, 0.95), lies * 0.9);
    slope = (near.ba - 0.5) * 0.3 * (1.0 - lies);
    gloss = lies * sparkle * 0.7;
  } else if (kind == FOREST) {
    albedo = base * (0.62 + grain * 0.4) * mix(vec3f(1.0), vec3f(0.8, 0.95, 0.7), smoothstep(0.4, 0.7, middle.g));
    slope = (near.ba - 0.5) * 0.3;
  }

  // What the grounds round it carry over the frontier.
  let beside = around(lies_at, 0.8);
  let ragged = near.g * 0.6 + middle.g * 0.4;
  if (kind != SNOW && kind != LAVA) {
    // Snow dusts what lies beside it, thicker toward the snow.
    let dusted = smoothstep(0.62, 0.78, beside.snow * 0.9 + ragged * 0.5) * select(1.0, 0.0, kind == TUNDRA);
    albedo = mix(albedo, vec3f(0.84, 0.89, 0.96), dusted * 0.85);
    gloss = max(gloss, dusted * sparkle * 0.7);
    glow *= 1.0 - dusted;
  }
  if (kind != LAVA) {
    // Ash round the lava, and the last of its heat in the cracks of the ground beside it.
    let scorched = smoothstep(0.1, 0.7, beside.lava + (ragged - 0.5) * 0.4);
    albedo = mix(albedo, albedo * vec3f(0.3, 0.26, 0.26), scorched * 0.8);
    let ember = (1.0 - smoothstep(0.02, 0.1, middle.r)) * scorched * scorched;
    glow += vec3f(2.4, 0.5, 0.06) * ember * (0.5 + 0.5 * sin(time * 1.3 + far.g * 9.0));
  }
  if (kind == GRASS || kind == FOREST) {
    // Sand blown in from a desert lies in streaks down the wind; stones have rolled off the rock.
    let streak = smoothstep(0.45, 0.75, sin(dot(at, vec2f(-WIND.y, WIND.x)) * 9.0 + far.g * 12.0) * 0.5 + 0.5);
    let blown = smoothstep(0.25, 0.8, beside.sand + (ragged - 0.5) * 0.5) * streak;
    albedo = mix(albedo, vec3f(0.78, 0.62, 0.36) * (0.85 + near.g * 0.3), blown * 0.6);
  }
  if (kind == SAND) {
    // Grass creeps into the sand in patches, the earth under it darker.
    let crept = smoothstep(0.5, 0.72, beside.green * 0.8 + ragged * 0.55);
    albedo = mix(albedo, vec3f(0.3, 0.38, 0.14) * (0.75 + near.g * 0.5), crept * 0.75);
  }
  if (kind != ROCK && kind != LAVA) {
    let stone = strewn(at, 7.0, beside.rock * 0.8, 0.3);
    albedo = mix(albedo, vec3f(0.44, 0.42, 0.4) * (0.6 + stone.y * 0.6), stone.x * 0.9);
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
