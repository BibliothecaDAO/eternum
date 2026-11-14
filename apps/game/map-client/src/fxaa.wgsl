// The last pass where edges are smoothed: the graded frame, read along its edges and blended across them (FXAA).
@group(1) @binding(0) var graded: texture_2d<f32>;
@group(1) @binding(1) var graded_sampler: sampler;

@vertex
fn vs(@builtin(vertex_index) index: u32) -> @builtin(position) vec4f {
  return vec4f(f32((index << 1u) & 2u) * 2.0 - 1.0, f32(index & 2u) * 2.0 - 1.0, 0.0, 1.0);
}

fn luma(colour: vec3f) -> f32 {
  return dot(colour, vec3f(0.299, 0.587, 0.114));
}

fn at(uv: vec2f) -> vec3f {
  return textureSampleLevel(graded, graded_sampler, uv, 0.0).rgb;
}

@fragment
fn fs(@builtin(position) position: vec4f) -> @location(0) vec4f {
  let texel = 1.0 / globals.hex_and_screen.zw;
  let uv = position.xy * texel;
  let middle = at(uv);
  let north_west = luma(at(uv + vec2f(-1.0, -1.0) * texel));
  let north_east = luma(at(uv + vec2f(1.0, -1.0) * texel));
  let south_west = luma(at(uv + vec2f(-1.0, 1.0) * texel));
  let south_east = luma(at(uv + vec2f(1.0, 1.0) * texel));
  let here = luma(middle);
  let darkest = min(here, min(min(north_west, north_east), min(south_west, south_east)));
  let brightest = max(here, max(max(north_west, north_east), max(south_west, south_east)));
  var along = vec2f(-((north_west + north_east) - (south_west + south_east)), (north_west + south_west) - (north_east + south_east));
  let shrink = max((north_west + north_east + south_west + south_east) * 0.03125, 0.0078125);
  along = clamp(along / (min(abs(along.x), abs(along.y)) + shrink), vec2f(-8.0), vec2f(8.0)) * texel;
  let narrow = 0.5 * (at(uv + along * (1.0 / 3.0 - 0.5)) + at(uv + along * (2.0 / 3.0 - 0.5)));
  let wide = narrow * 0.5 + 0.25 * (at(uv - along * 0.5) + at(uv + along * 0.5));
  let wide_luma = luma(wide);
  let smoothed = select(wide, narrow, wide_luma < darkest || wide_luma > brightest);
  // A surface that encodes for the screen itself takes the colour decoded.
  return vec4f(mix(smoothed, pow(smoothed, vec3f(2.2)), globals.toward_light.w), 1.0);
}
