import type Node from "three/src/nodes/core/Node.js";
import {
  Fn,
  If,
  attribute,
  color,
  float,
  fwidth,
  mix,
  mx_cell_noise_float,
  mx_fractal_noise_float_2d,
  mx_noise_float,
  mx_worley_noise_vec2,
  normalViewGeometry,
  normalWorldGeometry,
  positionView,
  positionWorld,
  smoothstep,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import { MeshStandardNodeMaterial } from "three/webgpu";

import { nearestHexLocalPosition, terrainHexEdgeDistance } from "@/three/terrain/terrain-hex-node";
import { mapAnimationTime as time } from "@/three/effects/endgame/state";

import { WATER_LEVEL } from "./world-field";

/**
 * The ground shaders of the biome study. Every pattern is a function of world position plus the game's seed offset, so
 * the same seed and coordinates always paint the same ground, across any page or chunk seam.
 *
 * - `splat`: one tinted colour per surface family, rock on steep slopes and snow on high ground. Shows what the relief
 *   alone does.
 * - `painted`: each family draws its own surface (ripples, cracked hardpan, grass clumps, forest floor under canopy
 *   shade, frost polygons, rock slabs, wind-cut snow, basalt with lava seams) and bends the light with its own relief.
 */
export type GroundStyle = "splat" | "painted";

interface Surface {
  color: Node<"vec3">;
  height: Node<"float">;
}

interface PatternInput {
  p: Node<"vec2">;
  base: Node<"vec3">;
  moisture: Node<"float">;
  /** How large one screen pixel is on the ground: fine detail fades out before it shimmers. */
  pixel: Node<"float">;
  /** 0 in the glade at a tile's centre, where its army or building stands; 1 beyond it. */
  glade: Node<"float">;
}

export function createGroundMaterial(
  style: GroundStyle,
  seedOffset: readonly [number, number],
): MeshStandardNodeMaterial {
  const material = new MeshStandardNodeMaterial({ metalness: 0, roughness: 0.92 });
  material.name = `biome-study-ground-${style}`;
  const familiesA = attribute<"vec4">("familiesA", "vec4");
  const familiesB = attribute<"vec4">("familiesB", "vec4");
  const familiesC = attribute<"vec4">("familiesC", "vec4");
  const base = attribute<"vec3">("tint", "vec3");
  const moisture = familiesC.y;
  const p = positionWorld.xz.add(vec2(seedOffset[0], seedOffset[1]));
  const pixel = fwidth(positionWorld.xz).length().max(0.0005);
  const weights = [
    familiesA.x,
    familiesA.y,
    familiesA.z,
    familiesA.w,
    familiesB.x,
    familiesB.y,
    familiesB.z,
    familiesB.w,
    familiesC.x,
    familiesC.z,
  ];
  // The glade's edge wanders with the ground's noise, so no two clearings are the same circle.
  const gladeEdge = nearestHexLocalPosition(positionWorld.xz).length().add(fbm01(p, 2.4).sub(0.5).mul(0.3));
  const glade = smoothstep(0.16, 0.34, gladeEdge);
  const input: PatternInput = { p, base, moisture, pixel, glade };
  const patterns = style === "painted" ? PAINTED_PATTERNS : SPLAT_PATTERNS;

  const surface = weights.reduce<Node<"vec4">>((sum, weight, index) => {
    const result = patterns[index](input);
    return sum.add(vec4(result.color, result.height).mul(weight));
  }, vec4(0));

  const lava = Fn(() => {
    const glow = vec3(0).toVar("groundLava");
    If(familiesC.x.greaterThan(0.004), () => glow.assign(lavaGlow(input).mul(familiesC.x)));
    return glow;
  })();

  const slope = normalWorldGeometry.y.oneMinus();
  const height = positionWorld.y;
  // Steep faces bare their rock: the relief paints itself.
  const cliff = smoothstep(0.22, 0.42, slope);
  const rockFace = rockColor(input).mul(
    mix(
      0.85,
      1.1,
      mx_noise_float(p.mul(vec2(0.6, 3.2)))
        .mul(0.5)
        .add(0.5),
    ),
  );
  const lit = mix(surface.rgb, rockFace, cliff);
  const shore = smoothstep(WATER_LEVEL + 0.05, WATER_LEVEL - 0.01, height);
  const wet = mix(lit, lit.mul(0.62), shore);
  material.colorNode = withHexEdges(wet);
  if (style === "painted") material.emissiveNode = lava;
  material.roughnessNode = mix(float(0.94), float(0.7), shore);
  if (style === "painted") material.normalNode = bumpedNormal(surface.a, 0.05);
  return material;
}

export function createWaterMaterial(): MeshStandardNodeMaterial {
  const material = new MeshStandardNodeMaterial({ metalness: 0, roughness: 0.18, transparent: false });
  material.name = "biome-study-water";
  const depth = attribute<"float">("waterDepth", "float");
  const p = positionWorld.xz;
  const ripple = mx_noise_float(vec3(p.mul(1.4), time.mul(0.25)))
    .mul(0.5)
    .add(0.5);
  const shelf = mix(color("#6fb4a8"), color("#2f7f92"), smoothstep(0.0, 0.14, depth));
  const deep = mix(shelf, color("#1d3f63"), smoothstep(0.14, 0.38, depth));
  const foamBand = smoothstep(0.035, 0.0, depth).mul(ripple.mul(0.6).add(0.4));
  material.colorNode = withHexEdges(mix(deep.mul(ripple.mul(0.12).add(0.94)), color("#e8f1ec"), foamBand.mul(0.75)));
  material.normalNode = bumpedNormal(ripple, 0.02);
  return material;
}

const SPLAT_PATTERNS: ReadonlyArray<(input: PatternInput) => Surface> = Array.from({ length: 10 }, () => (input) => ({
  color: input.base.mul(mx_fractal_noise_float_2d(input.p.mul(0.35), 3).mul(0.12).add(0.95)),
  height: float(0),
}));

const PAINTED_PATTERNS: ReadonlyArray<(input: PatternInput) => Surface> = [
  sand,
  badlands,
  grass,
  forestFloor,
  taiga,
  tundra,
  rock,
  snow,
  ash,
  scrub,
];

function detailFade(pixel: Node<"float">, frequency: number): Node<"float"> {
  return smoothstep(0.45, 0.12, pixel.mul(frequency));
}

/** Distances to the nearest and second-nearest feature points; MaterialX's vec2 Worley returns them squared. */
function worley(p: Node<"vec2">, jitter: number): Node<"vec2"> {
  return mx_worley_noise_vec2(p, jitter).sqrt();
}

function noise01(p: Node<"vec2">, frequency: number): Node<"float"> {
  return mx_noise_float(p.mul(frequency)).mul(0.5).add(0.5);
}

function fbm01(p: Node<"vec2">, frequency: number, octaves = 3): Node<"float"> {
  return mx_fractal_noise_float_2d(p.mul(frequency), octaves).mul(0.5).add(0.5);
}

function sand({ p, base, pixel }: PatternInput): Surface {
  const warp = fbm01(p, 0.22).mul(4);
  const along = p.dot(vec2(0.88, 0.47));
  // Two scales of wind ripple: long swells that read from the play zoom, fine ripples that read up close.
  const swell = along.mul(2.1).add(warp.mul(1.6)).sin().mul(0.5).add(0.5);
  const ripple = along.mul(8.5).add(warp.mul(3)).sin().mul(0.5).add(0.5).mul(detailFade(pixel, 8.5));
  const drift = fbm01(p, 0.45);
  const grain = noise01(p, 38).mul(detailFade(pixel, 38));
  const lit = swell.mul(0.32).add(ripple.mul(0.1)).add(0.78);
  return {
    color: base.mul(drift.mul(0.16).add(0.9)).mul(lit).add(grain.mul(0.025)),
    height: swell.mul(2).add(ripple.mul(0.5)).add(drift.mul(0.3)),
  };
}

function badlands({ p, base, pixel }: PatternInput): Surface {
  const cells = worley(p.mul(1.7), 0.9);
  const plate = smoothstep(0.015, 0.075, cells.y.sub(cells.x))
    .mul(detailFade(pixel, 1.7))
    .add(detailFade(pixel, 1.7).oneMinus());
  const bands = positionWorld.y.mul(36).add(fbm01(p, 0.6).mul(3)).sin().mul(0.5).add(0.5);
  const tone = fbm01(p, 0.7);
  const ochre = mix(base.mul(0.78), base.mul(1.18).add(vec3(0.04, 0.03, 0.01)), bands.mul(0.55).add(tone.mul(0.45)));
  return { color: mix(base.mul(0.42), ochre, plate), height: plate.mul(0.6).add(tone.mul(0.4)) };
}

function grass({ p, base, moisture, pixel }: PatternInput): Surface {
  const clumps = smoothstep(0.28, 0.72, fbm01(p, 3.2));
  const blades = noise01(p.mul(vec2(1, 3.4)), 15).mul(detailFade(pixel, 15));
  const dryPatch = smoothstep(0.52, 0.72, fbm01(p.add(17.3), 0.5)).mul(moisture.oneMinus().mul(1.2).clamp(0, 1));
  const soil = smoothstep(0.18, 0.04, clumps);
  const flowers = smoothstep(0.965, 0.985, mx_cell_noise_float(p.mul(11)))
    .mul(clumps)
    .mul(detailFade(pixel, 11));
  const green = mix(base.mul(0.55), base.mul(1.25), clumps.mul(0.75).add(blades.mul(0.25)));
  const straw = mix(green, color("#c9b262").mul(clumps.mul(0.3).add(0.8)), dryPatch.mul(0.65));
  const ground = mix(mix(straw, color("#6b5636"), soil.mul(0.6)), color("#efe4a0"), flowers.mul(0.7));
  return { color: ground, height: clumps.mul(1.4).add(blades.mul(0.4)) };
}

/**
 * Woodland as the ground itself: a carpet of crowns seen from above, each a lit dome with its own shade, the gaps
 * between them dark. The forest reads at every zoom and armies stand on it, never behind it.
 */
function canopy(
  { p, base, pixel, glade }: PatternInput,
  crownsPerUnit: number,
  shape: "round" | "conical",
  cover: number,
): Surface {
  const cells = worley(p.mul(crownsPerUnit), 0.8);
  const fade = detailFade(pixel, crownsPerUnit);
  // Clearings break the carpet, and every tile keeps a glade at its centre for what stands there.
  const stand = smoothstep(cover - 0.08, cover + 0.08, fbm01(p.add(31.7), 0.7))
    .oneMinus()
    .mul(glade);
  const radial = cells.x.div(stand.mul(0.5).max(0.001)).clamp(0, 1);
  const crown = shape === "round" ? radial.mul(radial).oneMinus().sqrt() : radial.oneMinus();
  const dome = crown.mul(smoothstep(0.05, 0.3, stand));
  const tone = noise01(p, crownsPerUnit * 0.4);
  const leaf = mix(base.mul(0.8), base.mul(vec3(1.3, 1.1, 0.75)), tone.mul(0.6));
  const forestFloor = mix(base.mul(0.5), color("#6b5a3a"), 0.35);
  // The glade's floor is lighter trodden ground, so a dark army reads against it.
  const understory = mix(color("#8f7d52"), forestFloor, glade).mul(fbm01(p, 2.2).mul(0.3).add(0.85));
  const shaded = mix(understory, leaf.mul(mix(0.7, 1.15, dome)), smoothstep(0.0, 0.12, dome));
  const far = mix(understory, base.mul(fbm01(p, 0.9).mul(0.2).add(0.85)), stand);
  return { color: mix(far, shaded, fade), height: dome.mul(2.6).mul(fade) };
}

function forestFloor(input: PatternInput): Surface {
  return canopy(input, 3, "round", 0.74);
}

function taiga(input: PatternInput): Surface {
  const crowns = canopy(input, 3.8, "conical", 0.72);
  const dust = smoothstep(0.62, 0.8, fbm01(input.p.add(5.1), 0.9)).mul(crowns.height.mul(0.3).clamp(0, 1));
  return { color: mix(crowns.color, color("#e8eef1"), dust.mul(0.6)), height: crowns.height };
}

function tundra({ p, base, pixel }: PatternInput): Surface {
  // Tussock tundra: low hummocks of sedge, rust-red patches of dwarf shrub, pale lichen and frost-heaved stones.
  const tussock = smoothstep(0.35, 0.7, fbm01(p, 4.2));
  const blades = noise01(p.mul(vec2(1, 2.6)), 14).mul(detailFade(pixel, 14));
  const rust = smoothstep(0.55, 0.75, fbm01(p.add(3.3), 1.1));
  const stones = worley(p.mul(2.6), 0.9);
  const stone = smoothstep(0.17, 0.1, stones.x)
    .mul(smoothstep(0.5, 0.62, fbm01(p.add(8.8), 1.3)))
    .mul(detailFade(pixel, 2.6));
  const lichen = smoothstep(0.8, 0.88, noise01(p.add(9.1), 5)).mul(detailFade(pixel, 5));
  const sedge = mix(base.mul(0.72), base.mul(1.18), tussock.mul(0.7).add(blades.mul(0.3)));
  const shrubbed = mix(sedge, color("#94573a").mul(tussock.mul(0.3).add(0.8)), rust.mul(0.55));
  const lichened = mix(shrubbed, color("#d3d8b0"), lichen.mul(0.45));
  return {
    color: mix(lichened, color("#8e9294"), stone),
    height: tussock.mul(1.2).add(blades.mul(0.3)).add(stone.mul(1.6)),
  };
}

function rock({ p, base, pixel }: PatternInput): Surface {
  const slabs = worley(p.mul(0.95), 0.95);
  const shade = mx_cell_noise_float(p.mul(0.95));
  const crack = smoothstep(0.02, 0.07, slabs.y.sub(slabs.x))
    .mul(detailFade(pixel, 0.95))
    .add(detailFade(pixel, 0.95).oneMinus());
  const grit = noise01(p, 9).mul(detailFade(pixel, 9));
  const face = base.mul(shade.mul(0.3).add(0.78)).mul(grit.mul(0.16).add(0.92));
  return { color: mix(base.mul(0.38), face, crack), height: crack.mul(0.5).add(slabs.x.mul(0.3)).add(grit.mul(0.2)) };
}

function snow({ p, base, pixel }: PatternInput): Surface {
  // Sastrugi: wind cuts long ridges; their lee sides hold the sky's blue.
  const along = p.dot(vec2(0.86, 0.51));
  const across = p.dot(vec2(-0.51, 0.86));
  const ridges = mx_noise_float(vec2(along.mul(0.9), across.mul(5.2)))
    .mul(0.5)
    .add(0.5)
    .mul(detailFade(pixel, 5.2));
  const drift = fbm01(p, 0.5);
  const lee = smoothstep(0.55, 0.25, ridges);
  return {
    color: mix(base.mul(drift.mul(0.06).add(0.96)), color("#b3c8dc"), lee.mul(0.35)),
    height: ridges.mul(0.6).add(drift.mul(0.4)),
  };
}

function ash({ p, base, pixel }: PatternInput): Surface {
  const plates = worley(p.mul(1.25), 0.9);
  const seam = smoothstep(0.08, 0.02, plates.y.sub(plates.x)).mul(detailFade(pixel, 1.25));
  const crust = fbm01(p, 2.4);
  const basalt = base.mul(crust.mul(0.5).add(0.7));
  return { color: mix(basalt, color("#5a2117"), seam), height: seam.oneMinus().mul(0.6).add(crust.mul(0.4)) };
}

/** Dry ground with low shrubs scattered on it: the shrubland's own surface, not a desert's cracks. */
function scrub({ p, base, pixel, glade }: PatternInput): Surface {
  const shrubs = worley(p.mul(3.4), 0.9);
  const present = smoothstep(0.45, 0.6, fbm01(p.add(13.3), 1.6)).mul(glade);
  const radial = shrubs.x.div(present.mul(0.34).max(0.001)).clamp(0, 1);
  const bush = radial.mul(radial).oneMinus().sqrt().mul(detailFade(pixel, 3.4));
  const soil = mix(color("#a48a5c"), base, fbm01(p, 1.8).mul(0.6).add(0.2));
  const straw = mix(soil, color("#c8b273"), smoothstep(0.4, 0.7, noise01(p, 6)).mul(0.5));
  const shrub = color("#5d6a3a").mul(mix(0.7, 1.15, bush));
  return { color: mix(straw, shrub, smoothstep(0.0, 0.15, bush)), height: bush.mul(2) };
}

function lavaGlow({ p, pixel }: PatternInput): Node<"vec3"> {
  const plates = worley(p.mul(1.25), 0.9);
  const seam = smoothstep(0.045, 0.012, plates.y.sub(plates.x)).mul(detailFade(pixel, 1.25));
  const cooled = smoothstep(0.35, 0.65, fbm01(p, 0.6));
  const pulse = time.mul(0.6).add(p.x.mul(0.4)).sin().mul(0.15).add(0.85);
  return color("#ff6a1a").mul(seam).mul(cooled).mul(pulse).mul(2.2);
}

function rockColor({ p }: PatternInput): Node<"vec3"> {
  const strata = positionWorld.y.mul(28).add(fbm01(p, 0.5).mul(2)).sin().mul(0.5).add(0.5);
  return mix(color("#6f6a63"), color("#9b948a"), strata);
}

/** The hex grid stays on the ground itself, faint, so tiles read as places without boxing the art. */
function withHexEdges(surface: Node<"vec3">): Node<"vec3"> {
  const edge = terrainHexEdgeDistance(positionWorld.xz);
  const width = fwidth(edge).max(0.001);
  const line = smoothstep(width.mul(1.2).add(0.012), 0.012, edge);
  return mix(surface, surface.mul(0.5), line.mul(0.5));
}

/**
 * Bends the geometry's normal by a procedural height, from screen-space derivatives (Mikkelsen 2010, "Bump Mapping
 * Unparametrized Surfaces on the GPU"): no tangents, no textures, one height evaluation per pixel.
 */
function bumpedNormal(height: Node<"float">, scale: number): Node<"vec3"> {
  const h = height.mul(scale);
  const dpdx = positionView.dFdx();
  const dpdy = positionView.dFdy();
  const n = normalViewGeometry;
  const r1 = dpdy.cross(n);
  const r2 = n.cross(dpdx);
  const det = dpdx.dot(r1);
  const gradient = det.sign().mul(r1.mul(h.dFdx()).add(r2.mul(h.dFdy())));
  return det.abs().mul(n).sub(gradient).normalize();
}
