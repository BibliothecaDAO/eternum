// The frame's one full-screen pass: contact shadows, cloud shadows, the mist as a volume, a grade and the tone map.
// The scene as it was lit; beside each pixel's colour, how far from the eye its surface is, 0 where nothing was drawn.
@group(1) @binding(0) var scene_colour: texture_2d<f32>;
// The land's features (`read_features`) and the game's palette colour of every hex.
@group(1) @binding(1) var feature_map: texture_2d<f32>;
@group(1) @binding(2) var palette_map: texture_2d<f32>;
@group(1) @binding(3) var linear_sampler: sampler;

const AO_REACH = 0.7;
const MIST_DEPTH = 1.3;
// The mist is dark: near black in its depths, a dusky violet where the key light grazes its tops, with a purple
// light of its own moving inside it, and a pale rim where it meets known land.
const MIST_DEEP = vec3f(0.016, 0.014, 0.03);
const MIST_TOP = vec3f(0.09, 0.07, 0.17);
const MIST_INNER_LIGHT = vec3f(0.55, 0.2, 1.0);
const MIST_RIM = vec3f(0.62, 0.5, 0.85);
const MIST_REACH = 60.0;

@vertex
fn vs(@builtin(vertex_index) index: u32) -> @builtin(position) vec4f {
  // One triangle over the whole frame.
  return vec4f(f32((index << 1u) & 2u) * 2.0 - 1.0, f32(index & 2u) * 2.0 - 1.0, 0.0, 1.0);
}

// Where the surface drawn at a pixel is; where nothing was drawn, a point far along the pixel's ray.
fn world_at(pixel: vec2i) -> vec3f {
  let size = globals.hex_and_screen.zw;
  let at = clamp(pixel, vec2i(0), vec2i(size) - 1);
  let uv = (vec2f(at) + 0.5) / size;
  let far = globals.inv_view_proj * vec4f(uv.x * 2.0 - 1.0, 1.0 - uv.y * 2.0, 1.0, 1.0);
  let toward = far.xyz / far.w - globals.eye.xyz;
  let distance = textureLoad(scene_colour, at, 0).a;
  return globals.eye.xyz + select(toward, normalize(toward) * distance, distance > 0.0);
}

fn contact_shadow(pixel: vec2i, ground: vec3f) -> f32 {
  let normal = normalize(cross(dpdy(ground), dpdx(ground)));
  let size = globals.hex_and_screen.zw;
  let reach = AO_REACH / length(ground - globals.eye.xyz) * 1.4 * size.y;
  let turn = fract(52.9829189 * fract(dot(vec2f(pixel), vec2f(0.06711056, 0.00583715)))) * 6.283;
  let taps = i32(globals.quality.y);
  var occlusion = 0.0;
  for (var tap = 0; tap < taps; tap++) {
    let angle = f32(tap) * 2.4 + turn;
    let offset = vec2f(cos(angle), sin(angle)) * sqrt((f32(tap) + 0.5) / f32(taps)) * reach;
    let toward = world_at(pixel + vec2i(offset)) - ground;
    let distance = max(length(toward), 0.0001);
    let rise = max(dot(normal, toward) / distance - 0.12, 0.0);
    occlusion += rise * smoothstep(AO_REACH * 1.6, 0.0, distance);
  }
  return clamp(1.0 - occlusion / f32(taps) * 2.4, 0.3, 1.0);
}

fn cloud_light(ground: vec2f) -> f32 {
  let time = globals.eye.w;
  let drift = vec2f(time * 0.35, time * 0.12);
  let cover = noise3(vec3f(ground * 0.09 + drift, time * 0.01)) * 0.67 + noise3(vec3f(ground * 0.23 - drift * 0.6, 3.7)) * 0.33;
  return mix(1.0, 0.7, smoothstep(0.46, 0.76, cover));
}

fn land_uv(ground: vec2f) -> vec2f {
  return clamp((ground - globals.world_bounds.xy) / globals.world_bounds.zw, vec2f(0.0), vec2f(0.9999));
}

fn features_at(ground: vec2f) -> Features {
  let uv = land_uv(ground);
  let cell = textureLoad(feature_map, vec2i(uv * vec2f(textureDimensions(feature_map))), 0);
  return read_features(cell, textureSampleLevel(feature_map, linear_sampler, uv, 0.0));
}

// How unexplored the ground is: 0 known, 1 in the unknown, soft across the edge between them. Past the land map
// is the world nobody has seen.
fn coverage(ground: vec2f) -> f32 {
  let outside = (abs((ground - globals.world_bounds.xy) / globals.world_bounds.zw - 0.5) - 0.5) * globals.world_bounds.zw;
  let beyond_edge = smoothstep(-0.9, 0.4, max(outside.x, outside.y));
  return max(smoothstep(-0.3, 0.5, features_at(ground).unknown), beyond_edge);
}

// What is known of the hex a point lies in, read at the hex's middle: every point of a hex is told the same.
fn hex_known(ground: vec2f) -> vec2f {
  let uv = land_uv(ground - from_hex_middle(ground));
  let packed = round(textureLoad(feature_map, vec2i(uv * vec2f(textureDimensions(feature_map))), 0).r * 255.0);
  let biome = floor(packed / 16.0);
  return vec2f(biome, packed - biome * 16.0);
}

// The mist over unexplored ground: a dark, deep volume in two drifting layers whose top rises and falls, with veins
// of purple light wandering inside it and now and then a glow far within. It is marched from where the eye's ray
// enters it to the ground. It lies thin over the hexes next to known land, so the next hex to explore shows through
// it, and thick beyond them; where it meets known land its edge is lit and wisps of it creep a little way over the
// ground; over unexplored water it lies low and flat.
fn veil_with_mist(scene: vec3f, ground: vec3f, pixel: vec2i) -> vec3f {
  let eye = globals.eye.xyz;
  let time = globals.eye.w;
  let toward = ground - eye;
  let ray = toward * min(1.0, MIST_REACH / length(toward));
  let fall = min(ray.y, -0.0001);
  let enter = clamp((MIST_DEPTH - eye.y) / fall, 0.0, 1.0);
  let exit = clamp(-eye.y / fall, enter, 1.0);
  let steps = i32(globals.quality.z);
  let step = ray * ((exit - enter) / f32(steps));
  let step_length = length(step);
  // Each pixel starts a little further or nearer, which hides the steps.
  let jitter = fract(52.9829189 * fract(dot(vec2f(pixel), vec2f(0.06711056, 0.00583715))));
  var at = eye + ray * enter + step * jitter;
  var transmittance = 1.0;
  var glow = vec3f(0.0);
  for (var index = 0; index < steps; index++) {
    let covered = coverage(at.xz);
    // Over known ground well away from the mist there is none, and nothing to work out.
    if (covered > 0.04) {
      let unknown = smoothstep(0.3, 0.85, covered);
      let into = features_at(at.xz).unknown;
      let deep = smoothstep(1.3, 3.2, into);
      // The mist's top is not level: it swells slowly, as a sea does.
      let top = MIST_DEPTH * (0.72 + 0.28 * noise3(vec3f(at.x * 0.13 + time * 0.03, time * 0.05, at.z * 0.13)));
      let height = clamp(at.y / top, 0.0, 1.0);
      let low = noise3(vec3f(at.x * 0.4 + time * 0.12, at.y * 1.3, at.z * 0.4 - time * 0.08));
      let high = noise3(vec3f(at.x * 1.1 - time * 0.16, at.y * 2.6 + time * 0.05, at.z * 1.1 + time * 0.07));
      let billow = low * 0.7 + high * 0.3;
      var density = unknown * mix(0.1, 2.4, deep) * pow(1.0 - height, 1.3) * smoothstep(0.25, 0.75, billow + (1.0 - height) * 0.35);
      // Wisps over the land's edge: low, thin, reaching in and drawing back.
      let wisp = (1.0 - unknown) * smoothstep(0.04, 0.3, covered) * smoothstep(0.3, 0.0, at.y)
        * smoothstep(0.5, 0.8, high + 0.25 * sin(time * 0.6 + at.x * 0.7 + at.z * 0.5));
      density += wisp * 1.6;
      let absorbed = exp(-density * step_length);
      // Slow veins of purple light wander through its depths, and now and then something glows far inside.
      let vein = noise3(vec3f(at.x * 0.23 - time * 0.05, time * 0.11, at.z * 0.23 + time * 0.04));
      let far_light = pow(max(sin(time * 0.5 + noise3(vec3f(at.x * 0.07, 1.7, at.z * 0.07)) * 12.0), 0.0), 10.0);
      let inner = MIST_INNER_LIGHT * (pow(smoothstep(0.52, 0.9, vein), 2.0) * (0.35 + 0.65 * deep) + far_light * deep * 0.28);
      let rim = MIST_RIM * smoothstep(1.1, 0.0, into) * 0.5;
      let body = mix(MIST_DEEP, MIST_TOP, smoothstep(0.1, 0.9, height + (billow - 0.5) * 0.5));
      glow += (body + inner + rim) * transmittance * (1.0 - absorbed);
      transmittance *= absorbed;
    }
    at += step;
  }
  return scene * transmittance + glow * (globals.toward_light.y * 0.3 + 0.7);
}

// The floor of the unknown, where no ground is drawn. A hex next to known land shows what it will be and asks to be
// tapped: its biome's colour under dusk, lighter toward its middle; a lit rim that breathes; a hex of light that
// grows from its middle to its rim and fades, each hex in its own time; a small hex at its middle. Unexplored water
// is dark and glints. Further in there is only the dark, and the grid's lines, faint.
fn unknown_floor(eye: vec3f, ray: vec3f) -> vec3f {
  let time = globals.eye.w;
  let ground = (eye + ray * (-eye.y / min(ray.y, -0.0001))).xz;
  let from_middle = from_hex_middle(ground);
  let middle = ground - from_middle;
  let reach = hex_reach(from_middle) / (globals.hex_and_screen.x * 0.5);
  let told = hex_known(ground);
  let next = select(0.0, 1.0, told.y == FRONTIER);
  let palette = pow(textureSampleLevel(palette_map, linear_sampler, land_uv(middle), 0.0).rgb, vec3f(2.2));
  // A line keeps its width on the screen: far off it is wider on the ground.
  let fine = 0.02 + length(ground - eye.xz) * 0.0022;
  let lot = hash3(vec3f(middle.x, 4.1, middle.y));
  let dusk = (globals.sky.rgb + globals.light_colour.rgb * globals.toward_light.y) * 0.42;
  let grain = noise3(vec3f(ground.x * 3.1, 0.3, ground.y * 3.1));
  var seen = mix(palette, MIST_TOP * 2.0, 0.25) * dusk * (0.62 + 0.55 * (1.0 - reach)) * (0.86 + grain * 0.28);
  if (told.x <= OCEAN) {
    let glint = pow(noise3(vec3f(ground.x * 2.2 + time * 0.3, time * 0.4, ground.y * 2.2)), 6.0);
    seen = palette * dusk * 0.5 + vec3f(0.5, 0.55, 0.8) * glint * 0.6;
  }
  var floor_colour = MIST_DEEP + MIST_TOP * band(reach, 1.0, fine * 1.4) * 0.5 * (1.0 - next);
  floor_colour = mix(floor_colour, seen, next);
  let rim = band(reach, 0.94, fine * 1.6);
  let halo = smoothstep(0.5, 1.0, reach);
  let breath = 0.75 + 0.25 * sin(time * 1.6 + lot * 6.283);
  let wave = fract(time / 2.6 + lot);
  let pulse = band(reach, wave * 0.92, fine * 2.2) * (1.0 - wave) * (1.0 - wave);
  let mark = band(reach, 0.17, fine * 1.4);
  floor_colour += (MIST_RIM * (rim * 1.7 + halo * halo * 0.3) * breath + vec3f(0.85, 0.75, 1.0) * (pulse * 1.1 + mark * 0.7)) * next;
  // The hex an army is sent to stands out of the rest: clearer, its rim brighter, the path running into it.
  let marks = order_marks(ground);
  floor_colour = mix(floor_colour, seen * 2.0, marks.z * 0.7);
  floor_colour += vec3f(1.0, 0.8, 0.35) * (marks.x * 1.1 + marks.z * (rim * 1.6 + halo * 0.4));
  return floor_colour;
}

// What lies where nothing was drawn: the sky above the horizon, the floor of the unknown below it.
fn beyond(ray: vec3f) -> vec3f {
  let up = normalize(ray).y;
  let sky = mix(vec3f(0.78, 0.8, 0.8), vec3f(0.2, 0.38, 0.72), smoothstep(0.0, 0.5, up));
  return mix(unknown_floor(globals.eye.xyz, ray), sky, smoothstep(-0.04, 0.03, up));
}

fn grade(source: vec3f, uv: vec2f) -> vec3f {
  let luminance = dot(source, vec3f(0.2126, 0.7152, 0.0722));
  let contrasted = mix(vec3f(luminance), source, 1.12) * mix(0.9, 1.08, smoothstep(0.05, 0.8, luminance));
  let warmed = contrasted * mix(vec3f(0.96, 0.99, 1.06), vec3f(1.05, 1.0, 0.94), smoothstep(0.1, 0.9, luminance));
  return warmed * (smoothstep(0.95, 0.35, length(uv - 0.5)) * 0.22 + 0.78);
}

fn aces(colour: vec3f) -> vec3f {
  let x = colour * 0.8;
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), vec3f(0.0), vec3f(1.0));
}

// The frame as the eye should see it, before it is encoded for a screen.
fn finished(position: vec4f) -> vec3f {
  let pixel = vec2i(position.xy);
  let ground = world_at(pixel);
  let drawn = step(0.0001, textureLoad(scene_colour, pixel, 0).a);
  var lit = textureLoad(scene_colour, pixel, 0).rgb;
  lit *= mix(1.0, contact_shadow(pixel, ground), drawn);
  lit *= mix(1.0, cloud_light(ground.xz), 1.0 - coverage(ground.xz));
  // The air between the eye and the far ground: a little of the sky's colour.
  let far_off = max(length(ground - globals.eye.xyz) - 12.0, 0.0);
  lit = mix(lit, globals.sky.rgb * vec3f(1.1, 1.3, 1.6), (1.0 - exp(-far_off * 0.012)) * 0.4);
  lit = mix(beyond(ground - globals.eye.xyz), lit, drawn);
  lit = veil_with_mist(lit, ground, pixel);
  lit = grade(lit, position.xy / globals.hex_and_screen.zw);
  return aces(lit);
}

// Straight to the surface. One that encodes for the screen itself (WebGL2's) takes the colour as it is.
@fragment
fn fs(@builtin(position) position: vec4f) -> @location(0) vec4f {
  let shown = finished(position);
  return vec4f(mix(pow(shown, vec3f(1.0 / 2.2)), shown, globals.toward_light.w), 1.0);
}

// To the frame the edge-smoothing pass reads, which holds colour as the eye sees it.
@fragment
fn fs_encoded(@builtin(position) position: vec4f) -> @location(0) vec4f {
  return vec4f(pow(finished(position), vec3f(1.0 / 2.2)), 1.0);
}
