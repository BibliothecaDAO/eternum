// How every surface is lit: the sky's dome, the key light with its shadow from one map, a shine and a rim.
@group(2) @binding(0) var shadow_map: texture_depth_2d;
@group(2) @binding(1) var shadow_sampler: sampler_comparison;
// The land: its height and shore distance on a map, a tile of ground detail and one of the water's.
@group(3) @binding(0) var land_map: texture_2d<f32>;
@group(3) @binding(1) var detail_tile: texture_2d<f32>;
@group(3) @binding(2) var wave_tile: texture_2d<f32>;
// Its features (`read_features`) and the game's palette colour of every hex.
@group(3) @binding(3) var feature_map: texture_2d<f32>;
@group(3) @binding(4) var palette_map: texture_2d<f32>;
@group(3) @binding(5) var map_sampler: sampler;
@group(3) @binding(6) var tile_sampler: sampler;

fn features_at(ground: vec2f) -> Features {
  let uv = clamp((ground - globals.world_bounds.xy) / globals.world_bounds.zw, vec2f(0.0), vec2f(0.9999));
  let cell = textureLoad(feature_map, vec2i(uv * vec2f(textureDimensions(feature_map))), 0);
  return read_features(cell, textureSampleLevel(feature_map, map_sampler, uv, 0.0));
}

// x: the ground's height. y: the distance to the shore, positive on land.
fn land_at(ground: vec2f) -> vec2f {
  let uv = (ground - globals.world_bounds.xy) / globals.world_bounds.zw;
  return textureSampleLevel(land_map, map_sampler, uv, 0.0).xy;
}

// How much of the key light reaches a point: 0 in shadow.
fn sunlight(world: vec3f, normal: vec3f) -> f32 {
  let in_light = globals.light_view_proj * vec4f(world + normal * globals.light_colour.w * 1.6, 1.0);
  let at = vec2f(in_light.x * 0.5 + 0.5, 0.5 - in_light.y * 0.5);
  let texel = 1.0 / globals.quality.w;
  let reach = i32(globals.quality.x);
  var lit = 0.0;
  for (var y = -reach; y <= reach; y++) {
    for (var x = -reach; x <= reach; x++) {
      lit += textureSampleCompareLevel(shadow_map, shadow_sampler, at + vec2f(f32(x), f32(y)) * texel, in_light.z - 0.0015);
    }
  }
  let taps = f32((reach * 2 + 1) * (reach * 2 + 1));
  let inside = step(0.0, at.x) * step(at.x, 1.0) * step(0.0, at.y) * step(at.y, 1.0);
  return mix(1.0, lit / taps, inside);
}

fn lit_by(albedo: vec3f, normal: vec3f, sun: f32) -> vec3f {
  let sky = mix(globals.ground.rgb, globals.sky.rgb, normal.y * 0.5 + 0.5);
  return albedo * (sky + globals.light_colour.rgb * max(dot(normal, globals.toward_light.xyz), 0.0) * sun);
}

fn lit(albedo: vec3f, world: vec3f, normal: vec3f) -> vec3f {
  return lit_by(albedo, normal, sunlight(world, normal));
}

// The key light's glint off a surface of that gloss, and the sky's light along its edge as the eye sees it.
fn shine(world: vec3f, normal: vec3f, gloss: f32, sun: f32) -> vec3f {
  let view = normalize(globals.eye.xyz - world);
  let half_way = normalize(view + globals.toward_light.xyz);
  let glint = pow(max(dot(normal, half_way), 0.0), mix(12.0, 70.0, gloss)) * gloss * sun * 1.4;
  let edge = pow(1.0 - max(dot(normal, view), 0.0), 3.0) * (0.35 + 0.65 * max(normal.y, 0.0));
  return globals.light_colour.rgb * glint + globals.sky.rgb * edge * 0.55;
}
