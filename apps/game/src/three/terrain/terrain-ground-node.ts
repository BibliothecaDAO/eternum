import { BiomeType, BiomeTypeToId } from "@bibliothecadao/types/terrain";
import type { Texture } from "three";
import type Node from "three/src/nodes/core/Node.js";
import {
  Fn,
  If,
  abs,
  dot,
  float,
  fwidth,
  int,
  ivec2,
  max,
  mix,
  mx_fractal_noise_float_2d,
  mx_noise_float,
  mx_worley_noise_vec2,
  smoothstep,
  step,
  struct,
  textureLoad,
  uniformArray,
  vec2,
  vec3,
} from "three/tsl";

import { BIOMES_BY_ID, BIOME_MAP_SIZE, LAYER_BIOME_OFFSET, groundNumber } from "./terrain-biome-map";
import { cellHash } from "./terrain-cell-hash";
import { TERRAIN_WATER_LEVEL } from "./terrain-water";
import { TERRAIN_HEX_HORIZONTAL_SPACING, TERRAIN_HEX_VERTICAL_SPACING } from "./terrain-coordinates";
import { nearestHexLocalPosition } from "./terrain-hex-node";
import { terrainBiomeTones, type TerrainGround } from "./terrain-palette";

const GroundSurface = struct({ albedo: "vec3", slope: "vec2", gloss: "float", glow: "vec3" });

export interface GroundSurfaceInput {
  biomeMap: Texture;
  detail: Texture;
  at: Node<"vec2">;
  world: Node<"vec3">;
  meshColour: Node<"vec3">;
  meshTint: Node<"vec3">;
  top: Node<"float">;
  climate: Node<"vec3">;
  time: Node<"float">;
}

const INNER_DISC = 0.3;
const LUMA = vec3(0.2126, 0.7152, 0.0722);
const WIND = vec2(0.8, 0.6);
const DUNE_ACROSS = vec2(0.55, 0.83);
const SNOW = vec3(0.86, 0.92, 1);
const LITTER = vec3(0.62, 0.3, 0.08);
const DRY = vec3(1.18, 1.04, 0.7);
const EMBER = vec3(2.8, 0.75, 0.12);
const RELIEF_STEP = 0.012;
const B = (biome: BiomeType) => float(BiomeTypeToId[biome]);
const G = (ground: TerrainGround) => float(groundNumber(ground));

const BIOME_TONES = BIOMES_BY_ID.map(terrainBiomeTones);
const PAINT = uniformArray(
  BIOME_TONES.map((tones) => tones.body),
  "color",
);
const SHADOW_PAINT = uniformArray(
  BIOME_TONES.map((tones) => tones.shadow),
  "color",
);
const LIGHT_PAINT = uniformArray(
  BIOME_TONES.map((tones) => tones.light),
  "color",
);

export const hexReach = (fromMiddle: Node<"vec2">): Node<"float"> => {
  const local = abs(fromMiddle);
  return max(local.x, dot(local, vec2(0.5, Math.sqrt(3) / 2)));
};

export const biomeTexelAt = (biomeMap: Texture, point: Node<"vec2">) => {
  const middle = point.sub(nearestHexLocalPosition(point));
  const row = middle.y.div(TERRAIN_HEX_VERTICAL_SPACING).round();
  const odd = abs(row).mod(2);
  const col = middle.x
    .add(odd.mul(TERRAIN_HEX_HORIZONTAL_SPACING / 2))
    .div(TERRAIN_HEX_HORIZONTAL_SPACING)
    .round();
  const wrap = (value: Node<"float">) => value.sub(value.div(BIOME_MAP_SIZE).floor().mul(BIOME_MAP_SIZE));
  return textureLoad(biomeMap, ivec2(int(wrap(col)), int(wrap(row))));
};

/**
 * The ground has a shape, and its colour follows the shape: hollows take the biome's shadow, tops its light, and the
 * sun shades the slope between them. Four shapes cover every biome: tufts, dunes, broken plates and snow drifts.
 */
export function groundSurface(input: GroundSurfaceInput) {
  const { at, biomeMap, time } = input;
  return Fn(() => {
    const drift = mx_fractal_noise_float_2d(at.mul(0.45), 3).toVar();
    const wobble = mx_fractal_noise_float_2d(at.mul(1.6).add(4.1), 4).mul(0.45);
    const dry = smoothstep(TERRAIN_WATER_LEVEL - 0.004, TERRAIN_WATER_LEVEL + 0.012, input.world.y);
    const facet = facetAt(at);
    const groundAt = LOOK === "facet" ? facet.middle : at;
    const ground = chooseGround({ biomeMap, at: groundAt, wobble, dry });
    const biome = ground.get("biome") as Node<"float">;
    const kind = ground.get("kind") as Node<"float">;
    const brush: Brush = {
      at,
      time,
      drift,
      seen: smoothstep(0.16, 0.07, fwidth(at.x).add(fwidth(at.y))).toVar(),
      tones: biomeTones(int(biome), input.meshTint),
      albedo: vec3(0).toVar(),
      slope: vec2(0).toVar(),
      gloss: float(0).toVar(),
      glow: vec3(0).toVar(),
    };
    const { albedo, slope, gloss, glow } = brush;

    If(kind.equal(G("water")), () => {
      albedo.assign(input.meshColour);
    })
      .ElseIf(float(LOOK === "flat" ? 1 : 0).greaterThan(0.5), () => paintFlat(brush))
      .ElseIf(float(LOOK === "tile" ? 1 : 0).greaterThan(0.5), () => paintTile(brush))
      .ElseIf(float(LOOK === "facet" ? 1 : 0).greaterThan(0.5), () =>
        paintFacets(
          brush,
          facet,
          kind
            .equal(G("rock"))
            .or(kind.equal(G("ash")))
            .select(1.7, kind.equal(G("snow")).select(0.6, 1)),
        ),
      )
      .ElseIf(biome.equal(B(BiomeType.Beach)).or(biome.equal(B(BiomeType.SubtropicalDesert))), () =>
        paintDunes(brush, biome.equal(B(BiomeType.Beach)).select(0.3, 1)),
      )
      .ElseIf(
        kind
          .equal(G("sand"))
          .or(kind.equal(G("rock")))
          .or(kind.equal(G("ash"))),
        () => paintPlates(brush, kind.equal(G("ash")).select(1, 0)),
      )
      .ElseIf(kind.equal(G("snow")), () => paintSnow(brush))
      .Else(() => paintTufts(brush, biome, kind));

    const contest = (ground.get("contest") as Node<"float">).mul(0.5);
    albedo.assign(mix(albedo, ground.get("other") as Node<"vec3">, contest));
    glow.mulAssign(contest.oneMinus());
    const highland = smoothstep(0.25, 0.8, input.climate.z);
    albedo.assign(mix(vec3(dot(albedo, LUMA)), albedo, mix(1.1, 0.95, highland)));

    const wet = smoothstep(TERRAIN_WATER_LEVEL + 0.05, TERRAIN_WATER_LEVEL, input.world.y);
    albedo.mulAssign(mix(1, 0.74, wet));
    return GroundSurface(albedo, slope.mul(input.top), gloss, glow.mul(input.top));
  })();
}

// TEMPORARY, for choosing a look in the lab: ?ground=flat|tile|facet picks one, anything else the relief look.
const LOOK = typeof window === "undefined" ? "" : (new URLSearchParams(window.location.search).get("ground") ?? "");

function paintFlat(brush: Brush): void {
  brush.albedo.assign(brush.tones.body);
}

/** Each tile lit like a game piece: its light in the middle, its shadow at the rim. */
function paintTile(brush: Brush): void {
  const { at, drift, tones } = brush;
  const reach = hexReach(nearestHexLocalPosition(at)).div(TERRAIN_HEX_HORIZONTAL_SPACING / 2);
  const lit = mix(tones.light, tones.body, smoothstep(0, 0.75, reach));
  brush.albedo.assign(mix(lit, tones.shadow, smoothstep(0.7, 1, reach).mul(0.55)).mul(drift.mul(0.06).add(1)));
}

interface Facet {
  /** The middle of the triangle a point lies in, in the ground's own coordinates. */
  middle: Node<"vec2">;
  /** The triangle's height from 0 to 1 and the way its one flat face leans. */
  height: Node<"float">;
  slope: Node<"vec2">;
  name: Node<"float">;
}

const FACET_SIZE = 0.52;
const SKEW = 0.57735;
const STRETCH = 1.1547;

const cornerHeight = (corner: Node<"vec2">): Node<"float"> =>
  mx_noise_float(corner.mul(0.31)).mul(0.5).add(0.5).mul(0.7).add(cellHash(corner, 7).mul(0.3));

/**
 * Low-poly ground: an uneven net of triangles laid over a soft relief. A triangle takes one height from its three
 * corners and one flat face from them, so neighbours shade together the way a modelled hill does.
 */
function facetAt(at: Node<"vec2">): Facet {
  const bent = at
    .add(vec2(mx_noise_float(at.mul(0.9)), mx_noise_float(at.mul(0.9).add(5.3))).mul(0.16))
    .div(FACET_SIZE);
  const skewed = vec2(bent.x.sub(bent.y.mul(SKEW)), bent.y.mul(STRETCH));
  const cell = skewed.floor();
  const within = skewed.sub(cell);
  const upper = step(1, within.x.add(within.y));
  const apex = cell.add(upper);
  const east = cell.add(vec2(1, 0));
  const north = cell.add(vec2(0, 1));
  const apexHeight = cornerHeight(apex);
  const eastHeight = cornerHeight(east);
  const northHeight = cornerHeight(north);
  const turn = upper.mul(-2).add(1);
  const lean = vec2(eastHeight.sub(apexHeight), northHeight.sub(apexHeight)).mul(turn);
  const toMiddle = apex.add(east).add(north).div(3).sub(skewed);
  const aside = toMiddle.y.div(STRETCH);
  return {
    middle: at.add(vec2(toMiddle.x.add(aside.mul(SKEW)), aside).mul(FACET_SIZE)),
    height: apexHeight.add(eastHeight).add(northHeight).div(3),
    slope: vec2(lean.x, lean.y.mul(STRETCH).sub(lean.x.mul(SKEW))).div(FACET_SIZE),
    name: mix(cellHash(cell, 1), cellHash(cell, 2), upper),
  };
}

function paintFacets(brush: Brush, facet: Facet, rugged: Node<"float">): void {
  const tone = facet.height.mul(0.55).add(facet.name.mul(0.14)).add(brush.drift.mul(0.1)).add(0.16);
  brush.albedo.assign(ramp(brush.tones, tone));
  brush.slope.assign(facet.slope.mul(0.55).mul(rugged));
}

interface Tones {
  shadow: Node<"vec3">;
  body: Node<"vec3">;
  light: Node<"vec3">;
}

interface Brush {
  at: Node<"vec2">;
  time: Node<"float">;
  /** Slow change across several tiles, from -1 to 1. */
  drift: Node<"float">;
  /** How much of the fine shape a pixel can still show: 0 from far away. */
  seen: Node<"float">;
  tones: Tones;
  albedo: Node<"vec3">;
  slope: Node<"vec2">;
  gloss: Node<"float">;
  glow: Node<"vec3">;
}

interface Relief {
  height: Node<"float">;
  slope: Node<"vec2">;
}

function biomeTones(biome: Node<"int">, tint: Node<"vec3">): Tones {
  return {
    shadow: (SHADOW_PAINT.element(biome) as unknown as Node<"vec3">).mul(tint).toVar(),
    body: (PAINT.element(biome) as unknown as Node<"vec3">).mul(tint).toVar(),
    light: (LIGHT_PAINT.element(biome) as unknown as Node<"vec3">).mul(tint).toVar(),
  };
}

const ramp = (tones: Tones, height: Node<"float">): Node<"vec3"> =>
  mix(mix(tones.shadow, tones.body, smoothstep(0, 0.5, height)), tones.light, smoothstep(0.5, 1, height));

/** A shape's height from 0 to 1 and the way it leans, read from the height a step away each way. */
function relief(at: Node<"vec2">, heightAt: (point: Node<"vec2">) => Node<"float">): Relief {
  const height = heightAt(at).toVar();
  const east = heightAt(at.add(vec2(RELIEF_STEP, 0)));
  const north = heightAt(at.add(vec2(0, RELIEF_STEP)));
  return { height, slope: vec2(east.sub(height), north.sub(height)).div(RELIEF_STEP) };
}

const tufts = (point: Node<"vec2">): Node<"float"> =>
  mx_noise_float(point.mul(3.2))
    .abs()
    .add(mx_noise_float(point.mul(7.4).add(3.7)).abs().mul(0.45))
    .mul(1.5)
    .oneMinus()
    .clamp(0, 1);

const dunes = (point: Node<"vec2">): Node<"float"> => {
  const sway = mx_noise_float(point.mul(0.7)).mul(2.2);
  const wave = dot(point, DUNE_ACROSS).mul(3.2).add(sway).sin().mul(0.5).add(0.5);
  const ripple = dot(point, WIND).mul(34).add(sway.mul(5)).sin().mul(0.5).add(0.5);
  return smoothstep(0, 1, wave).mul(0.86).add(ripple.mul(0.14));
};

const plates = (point: Node<"vec2">): Node<"float"> => {
  const cell = mx_worley_noise_vec2(point.mul(2.2).add(mx_noise_float(point.mul(1.3)).mul(0.25)), 1);
  const rough = mx_noise_float(point.mul(11)).mul(0.1);
  return smoothstep(0, 0.14, cell.y.sub(cell.x)).mul(0.75).add(cell.x.oneMinus().mul(0.25)).add(rough).clamp(0, 1);
};

const drifts = (point: Node<"vec2">): Node<"float"> =>
  mx_fractal_noise_float_2d(point.mul(0.9).add(dot(point, WIND).mul(0.6).sin().mul(0.2)), 3)
    .mul(0.5)
    .add(0.5);

function paintTufts(brush: Brush, biome: Node<"float">, kind: Node<"float">): void {
  const { at, drift, seen, tones, albedo } = brush;
  const shape = relief(at, tufts);
  const height = mix(0.6, shape.height, seen).mul(0.5).add(drift.mul(0.2)).add(0.22);
  albedo.assign(ramp(tones, height));
  const parched = biome.equal(B(BiomeType.Shrubland)).select(0.4, kind.equal(G("grass")).select(0.2, 0));
  albedo.mulAssign(mix(vec3(1), DRY, smoothstep(0.05, 0.45, drift).mul(parched)));
  const leafy = biome
    .equal(B(BiomeType.TemperateDeciduousForest))
    .or(biome.equal(B(BiomeType.TropicalSeasonalForest)))
    .select(0.45, 0);
  const fallen = smoothstep(0.3, 0.42, mx_noise_float(at.mul(7).add(9.3))).mul(seen);
  albedo.assign(mix(albedo, LITTER.mul(shape.height.mul(0.6).add(0.7)), fallen.mul(leafy)));
  const snowy = kind.equal(G("tundra")).select(0.85, biome.equal(B(BiomeType.Taiga)).select(0.6, 0));
  const lies = smoothstep(
    0.12,
    0.4,
    mx_fractal_noise_float_2d(at.mul(0.8).add(5.5), 3).add(shape.height.mul(0.25)),
  ).mul(snowy);
  albedo.assign(mix(albedo, SNOW.mul(shape.height.mul(0.12).add(0.9)), lies));
  brush.slope.assign(shape.slope.mul(0.022).mul(seen).mul(lies.mul(0.7).oneMinus()));
}

function paintDunes(brush: Brush, strength: Node<"float">): void {
  const { at, drift, seen, tones } = brush;
  const shape = relief(at, dunes);
  const height = mix(0.6, shape.height, strength.mul(seen.mul(0.5).add(0.5)));
  brush.albedo.assign(ramp(tones, height.mul(0.8).add(drift.mul(0.12)).add(0.1)));
  brush.slope.assign(shape.slope.mul(0.07).mul(strength));
}

function paintPlates(brush: Brush, molten: Node<"float">): void {
  const { at, time, drift, seen, tones, albedo } = brush;
  const shape = relief(at, plates);
  const split = smoothstep(0.32, 0.08, shape.height).mul(seen);
  albedo.assign(ramp(tones, mix(0.55, shape.height, seen).mul(0.75).add(drift.mul(0.15)).add(0.12)));
  albedo.mulAssign(mix(1, 0.4, split));
  brush.slope.assign(shape.slope.mul(0.035).mul(seen));
  const breathe = time.mul(0.9).add(drift.mul(9)).sin().mul(0.3).add(0.7);
  brush.glow.assign(
    EMBER.mul(split)
      .mul(smoothstep(-0.1, 0.3, drift))
      .mul(breathe)
      .mul(molten),
  );
}

function paintSnow(brush: Brush): void {
  const shape = relief(brush.at, drifts);
  brush.albedo.assign(ramp(brush.tones, shape.height.mul(0.7).add(0.25)));
  brush.slope.assign(shape.slope.mul(0.16));
  brush.gloss.assign(0.25);
}

const Ground = struct({ biome: "float", kind: "float", other: "vec3", contest: "float" });

/** Where two biomes meet: how far the line may sway off the tile's edge, and how wide the two paints mix over it. */
const BORDER = { sway: 0.22, blend: 0.1 };

/**
 * The ground a point shows. A tile keeps its own biome up to its edge; the line between two biomes sways a little
 * about that edge, the same way from both sides, and the two paints mix over a narrow band along it.
 */
function chooseGround(input: { biomeMap: Texture; at: Node<"vec2">; wobble: Node<"float">; dry: Node<"float"> }) {
  const { at, wobble, dry } = input;
  return Fn(() => {
    const fromMiddle = nearestHexLocalPosition(at);
    const middleAt = at.sub(fromMiddle);
    const own = biomeTexelAt(input.biomeMap, middleAt);
    const ownRaw = own.r.mul(255).round();
    const ownBiome = ownRaw.mul(step(ownRaw, LAYER_BIOME_OFFSET - 1));
    const ownKind = own.g.mul(255).round();
    const ownWater = ownKind.equal(G("water"));
    const ownPaint = PAINT.element(int(ownBiome)) as unknown as Node<"vec3">;
    const biome = ownBiome.toVar();
    const kind = ownKind.toVar();
    const claim = float(0.5).toVar();
    const other = ownPaint.toVar();
    const contest = float(0).toVar();
    const apothem = TERRAIN_HEX_HORIZONTAL_SPACING / 2;
    const outside = smoothstep(INNER_DISC, INNER_DISC + 0.3, fromMiddle.length().div(apothem));
    for (let side = 0; side < 6; side += 1) {
      const toward = vec2(Math.cos((side * Math.PI) / 3), Math.sin((side * Math.PI) / 3));
      const beside = biomeTexelAt(input.biomeMap, middleAt.add(toward.mul(TERRAIN_HEX_HORIZONTAL_SPACING)));
      const besideRaw = beside.r.mul(255).round();
      const besideBiome = besideRaw.mul(step(besideRaw, LAYER_BIOME_OFFSET - 1));
      const besideKind = beside.g.mul(255).round();
      const meets = besideBiome
        .greaterThan(0)
        .and(besideKind.notEqual(G("water")))
        .and(besideBiome.notEqual(ownBiome));
      const reach = dot(fromMiddle, toward);
      const leaning = besideBiome.greaterThan(ownBiome).select(wobble, wobble.negate());
      const ours = float(apothem).sub(reach).sub(leaning.mul(BORDER.sway));
      const shore = outside.mul(smoothstep(0, 0.4, reach.div(apothem))).mul(dry);
      const theirs = meets.select(ownWater.select(shore, step(ours, 0)), 0);
      const besidePaint = PAINT.element(int(besideBiome)) as unknown as Node<"vec3">;
      If(theirs.greaterThan(claim), () => {
        claim.assign(theirs);
        biome.assign(besideBiome);
        kind.assign(besideKind);
      });
      const close = meets.and(ownWater.not()).select(smoothstep(BORDER.blend, 0, abs(ours)), 0);
      If(close.greaterThan(contest), () => {
        contest.assign(close);
        other.assign(mix(besidePaint, ownPaint, step(0.5, theirs)));
      });
    }
    return Ground(biome, kind, other, contest);
  })();
}
