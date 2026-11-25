import { BiomeType, BiomeTypeToId } from "@bibliothecadao/types/terrain";
import type { Texture } from "three";
import type Node from "three/src/nodes/core/Node.js";
import {
  Fn,
  If,
  abs,
  cameraPosition,
  dot,
  float,
  fract,
  int,
  ivec2,
  max,
  mix,
  smoothstep,
  step,
  struct,
  texture,
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
import { terrainBiomePaint, type TerrainGround } from "./terrain-palette";

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

const WIND = vec2(0.8, 0.6);
const INNER_DISC = 0.3;
const STRATA = vec2(0.35, 0.94);
const SNOW_LIT = vec3(0.7, 0.88, 1);
const SNOW_SHADE = vec3(0.5, 0.66, 0.95);
const LOWLAND = vec3(0.86, 0.8, 0.72);
const HIGHLAND = vec3(1.08, 1.1, 1.14);
const LUMA = vec3(0.2126, 0.7152, 0.0722);
const B = (biome: BiomeType) => float(BiomeTypeToId[biome]);
const G = (ground: TerrainGround) => float(groundNumber(ground));

const PAINT = uniformArray(
  BIOMES_BY_ID.map((biome) => terrainBiomePaint(biome, "primary")),
  "color",
);

export const hexReach = (fromMiddle: Node<"vec2">): Node<"float"> => {
  const local = abs(fromMiddle);
  return max(local.x, dot(local, vec2(0.5, Math.sqrt(3) / 2)));
};

const strewn = (at: Node<"vec2">, fine: number, share: Node<"float"> | number, size: Node<"float"> | number) => {
  const cell = at.mul(fine).floor();
  const middle = cell
    .add(0.25)
    .add(vec2(cellHash(cell, 1), cellHash(cell, 2)).mul(0.5))
    .div(fine);
  const inside = step(hexReach(at.sub(middle)).mul(fine), size).mul(step(cellHash(cell, 3), share));
  return vec2(inside, cellHash(cell, 4).mul(inside));
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

export function groundSurface(input: GroundSurfaceInput) {
  const { at, biomeMap, detail, time } = input;
  return Fn(() => {
    const near = texture(detail, at.mul(0.95)).toVar();
    const middle = texture(detail, at.yx.mul(0.31).add(vec2(0.13, 0.57))).toVar();
    const far = texture(detail, at.yx.mul(0.11).add(vec2(0.37, 0.11))).toVar();
    const other = texture(detail, at.yx.mul(0.71).add(vec2(0.31, 0.77))).toVar();
    const grain = near.g.mul(0.55).add(far.g.mul(0.45));
    const bump = vec2(near.g.sub(other.g), middle.g.sub(far.g));
    const wobble = far.g
      .sub(0.5)
      .mul(0.6)
      .add(middle.g.sub(0.5).mul(0.3))
      .add(other.g.sub(0.5).mul(0.14))
      .add(near.g.sub(0.5).mul(0.06));
    const dry = smoothstep(TERRAIN_WATER_LEVEL - 0.004, TERRAIN_WATER_LEVEL + 0.012, input.world.y);
    const ground = chooseGround({ biomeMap, at, climate: input.climate.xy, wobble, dry });
    const biome = ground.get("biome") as Node<"float">;
    const kind = ground.get("kind") as Node<"float">;
    const close = smoothstep(18, 8, cameraPosition.distance(input.world));
    const painted = PAINT.element(int(biome)) as unknown as Node<"vec3">;
    const base = kind.equal(G("water")).select(input.meshColour, painted.mul(input.meshTint)).toVar();

    const sparkle = float(0).toVar();
    If(close.greaterThan(0.001), () => {
      const glint = strewn(at, 34, 0.1, 0.22);
      sparkle.assign(glint.x.mul(close).mul(time.mul(2.6).add(glint.y.mul(40)).sin().mul(0.45).add(0.55)));
    });

    const albedo = base.mul(grain.mul(0.3).add(0.84)).mul(far.r.mul(0.16).add(0.9)).toVar();
    const slope = vec2(0).toVar();
    const gloss = float(0).toVar();
    const glow = vec3(0).toVar();

    If(biome.equal(B(BiomeType.Beach)), () => {
      const phase = dot(at, WIND).mul(26).add(far.g.mul(8)).add(middle.g.mul(3));
      albedo.assign(
        base
          .mul(vec3(1.08, 1.04, 0.95))
          .mul(phase.sin().mul(0.06).add(0.94))
          .mul(far.r.mul(0.1).add(0.94)),
      );
      slope.assign(WIND.mul(phase.cos()).mul(0.1));
      gloss.assign(sparkle.mul(0.6));
    })
      .ElseIf(biome.equal(B(BiomeType.SubtropicalDesert)), () => {
        const across = vec2(0.55, 0.83);
        const rise = dot(at, across).mul(2.3).add(far.g.mul(6)).add(middle.g.mul(1.5));
        const phase = dot(at, WIND).mul(17).add(far.g.mul(10));
        albedo.assign(
          base
            .mul(mix(vec3(0.84, 0.76, 0.7), vec3(1.14, 1.06, 0.9), rise.sin().mul(0.5).add(0.5)))
            .mul(phase.sin().mul(0.07).add(0.93)),
        );
        slope.assign(across.mul(rise.cos()).mul(0.55).add(WIND.mul(phase.cos()).mul(0.14)));
        gloss.assign(sparkle.mul(0.5));
      })
      .ElseIf(biome.equal(B(BiomeType.TemperateDesert)), () => {
        albedo.assign(
          base
            .mul(vec3(0.96, 0.9, 0.84))
            .mul(middle.g.mul(0.3).add(0.8))
            .mul(near.g.mul(0.16).add(0.92)),
        );
        albedo.assign(mix(albedo, base.mul(vec3(0.66, 0.7, 0.52)), smoothstep(0.6, 0.78, far.g).mul(0.5)));
        If(close.greaterThan(0.001), () => {
          const gravel = strewn(at, 8, smoothstep(0.45, 0.7, other.g).mul(0.2), near.g.mul(0.16).add(0.12));
          albedo.assign(
            mix(albedo, vec3(0.5, 0.45, 0.4).mul(gravel.y.mul(0.6).add(0.7)), gravel.x.mul(close).mul(0.8)),
          );
        });
        slope.assign(bump.mul(0.2));
      })
      .ElseIf(kind.equal(G("snow")).or(kind.equal(G("tundra"))), () => {
        const isTundra = kind.equal(G("tundra"));
        const combed = dot(at, WIND).mul(3).add(far.g.mul(6)).add(middle.g.mul(2));
        const lee = smoothstep(0.2, 0.9, combed.cos().negate());
        const drift = far.g.mul(0.7).add(middle.g.mul(0.3)).add(input.climate.x.sub(0.6).mul(2)).add(lee.mul(0.06));
        const lies = isTundra.select(smoothstep(0.58, 0.68, drift), float(1));
        const heather = smoothstep(0.55, 0.7, middle.r.mul(0.5).add(far.r.mul(0.5)));
        const bare = mix(base.mul(vec3(0.9, 0.88, 0.84)), base.mul(vec3(0.82, 0.7, 0.78)), heather.mul(0.5)).mul(
          near.g.mul(0.3).add(0.78),
        );
        const snow = mix(SNOW_LIT, SNOW_SHADE, lee.mul(0.6).add(smoothstep(0.45, 0.75, far.r).mul(0.15))).mul(
          grain.mul(0.06).add(0.95),
        );
        albedo.assign(mix(bare, snow, lies));
        const smoothSnow = isTundra.select(0, 1);
        slope.assign(mix(bump.mul(0.3), mix(bump.mul(0.2), WIND.mul(combed.sin()).mul(0.22), smoothSnow), lies));
        gloss.assign(lies.mul(sparkle).mul(0.9));
      })
      .ElseIf(kind.equal(G("rock")), () => {
        const bands = input.climate.x.mul(70).add(dot(at, STRATA).mul(0.7)).add(far.g.mul(2.5)).add(middle.g.mul(0.6));
        const layer = fract(bands);
        const lip = smoothstep(0.8, 0.88, layer).mul(smoothstep(0.93, 0.89, layer));
        const underside = smoothstep(0.9, 0.97, layer);
        const tone = fract(bands.floor().mul(0.618)).mul(0.22).add(0.86).mul(layer.mul(0.14).add(0.9));
        albedo.assign(
          base.mul(tone).mul(near.g.mul(0.18).add(0.9)).mul(lip.mul(0.35).add(1)).mul(underside.mul(0.55).oneMinus()),
        );
        const scree = strewn(at, 9, smoothstep(0.5, 0.7, other.g).mul(0.35), near.g.mul(0.14).add(0.14));
        albedo.assign(mix(albedo, base.mul(scree.y.mul(0.4).add(0.75)), scree.x.mul(0.7)));
        albedo.assign(
          mix(
            albedo,
            vec3(0.36, 0.42, 0.2).mul(near.g.mul(0.5).add(0.7)),
            smoothstep(0.62, 0.76, far.g.mul(0.55).add(near.g.mul(0.45))).mul(0.35),
          ),
        );
        slope.assign(STRATA.mul(lip.sub(underside).mul(0.8)).add(bump.mul(0.25)));
      })
      .ElseIf(kind.equal(G("ash")), () => {
        const rim = (ground.get("frontier") as Node<"float">).max(smoothstep(0.62, 0.8, far.r));
        const drift = smoothstep(0.55, 0.85, dot(at, WIND).mul(1.1).add(far.g.mul(5)).add(middle.g.mul(1.5)).sin());
        const rift = smoothstep(0.07, 0.02, middle.r).mul(smoothstep(0.45, 0.6, far.r.mul(0.6).add(other.g.mul(0.4))));
        const fine = smoothstep(0.03, 0.14, near.r).oneMinus().mul(close);
        const core = base.mul(vec3(0.5, 0.48, 0.48)).mul(grain.mul(0.2).add(0.88));
        const scorched = base.mul(vec3(1.3, 1.05, 0.82)).mul(grain.mul(0.25).add(0.82));
        albedo.assign(mix(core, scorched, rim.mul(0.85)));
        albedo.assign(mix(albedo, vec3(0.4, 0.4, 0.41).mul(near.g.mul(0.15).add(0.92)), drift.mul(0.5)));
        albedo.mulAssign(rift.mul(0.6).oneMinus().mul(fine.mul(0.4).oneMinus()));
        slope.assign(middle.ba.sub(0.5).mul(0.2).add(bump.mul(0.25)));
        const ember = strewn(at, 6, rim.oneMinus().mul(0.08), 0.12);
        const flicker = time.mul(1.7).add(ember.y.mul(30)).sin().mul(0.4).add(0.6);
        glow.assign(vec3(2.6, 0.7, 0.12).mul(ember.x).mul(flicker));
      })
      .ElseIf(biome.equal(B(BiomeType.Grassland)), () => {
        const tufts = near.g.mul(0.5).add(middle.g.mul(0.5));
        const gust = smoothstep(0.55, 1, dot(at, WIND).mul(0.85).sub(time.mul(1.3)).add(far.g.mul(7)).sin());
        albedo.assign(base.mul(tufts.mul(0.4).add(0.8)).mul(gust.mul(0.12).add(1)));
        If(close.greaterThan(0.001), () => {
          const bloom = strewn(at, 13, 0.22, 0.2);
          const flower = mix(
            mix(vec3(0.95, 0.92, 0.82), vec3(0.98, 0.78, 0.12), step(0.4, bloom.y)),
            vec3(0.62, 0.36, 0.85),
            step(0.75, bloom.y),
          );
          albedo.assign(mix(albedo, flower, bloom.x.mul(close).mul(smoothstep(0.42, 0.6, far.g))));
        });
        slope.assign(bump.mul(0.1));
      })
      .ElseIf(biome.equal(B(BiomeType.Shrubland)), () => {
        const tufts = near.g.mul(0.5).add(middle.g.mul(0.5));
        const gust = smoothstep(0.6, 1, dot(at, WIND).mul(0.85).sub(time.mul(1.3)).add(far.g.mul(7)).sin());
        albedo.assign(
          base
            .mul(vec3(1.08, 1, 0.78))
            .mul(tufts.mul(0.42).add(0.76))
            .mul(gust.mul(0.08).add(1)),
        );
        albedo.assign(
          mix(
            albedo,
            vec3(0.4, 0.29, 0.19).mul(near.g.mul(0.4).add(0.8)),
            smoothstep(0.5, 0.66, middle.g.mul(0.6).add(far.g.mul(0.4))).mul(0.75),
          ),
        );
        albedo.assign(mix(albedo, albedo.mul(vec3(1.25, 0.8, 1.3)), smoothstep(0.66, 0.82, far.r).mul(0.45)));
        slope.assign(bump.mul(0.15));
      })
      .ElseIf(biome.equal(B(BiomeType.TropicalRainForest)), () => {
        albedo.assign(base.mul(vec3(0.72, 0.98, 0.74)).mul(grain.mul(0.46).add(0.56)));
        albedo.assign(mix(albedo, base.mul(vec3(0.95, 1.3, 0.6)), smoothstep(0.62, 0.72, near.g).mul(0.35)));
        gloss.assign(smoothstep(0.6, 0.76, middle.g).mul(0.7));
        albedo.mulAssign(gloss.mul(0.35).oneMinus());
        slope.assign(bump.mul(0.2).mul(gloss.oneMinus()));
      })
      .ElseIf(biome.equal(B(BiomeType.TropicalSeasonalForest)), () => {
        albedo.assign(
          base.mul(grain.mul(0.4).add(0.7)).mul(mix(vec3(1), vec3(1.16, 1, 0.6), smoothstep(0.4, 0.7, far.g))),
        );
        albedo.assign(
          mix(albedo, vec3(0.5, 0.21, 0.11).mul(near.g.mul(0.4).add(0.8)), smoothstep(0.58, 0.72, middle.g).mul(0.65)),
        );
        slope.assign(bump.mul(0.2));
      })
      .ElseIf(biome.equal(B(BiomeType.TemperateRainForest)), () => {
        albedo.assign(base.mul(vec3(0.78, 0.98, 0.88)).mul(grain.mul(0.4).add(0.58)));
        albedo.assign(mix(albedo, base.mul(vec3(0.9, 1.4, 0.66)), smoothstep(0.52, 0.7, middle.g).mul(0.55)));
        gloss.assign(smoothstep(0.55, 0.85, far.g).mul(0.25));
        slope.assign(bump.mul(0.25));
      })
      .ElseIf(biome.equal(B(BiomeType.TemperateDeciduousForest)), () => {
        albedo.assign(base.mul(grain.mul(0.4).add(0.62)));
        const fallen = strewn(at, 10, 0.3, near.g.mul(0.14).add(0.2));
        const leaf = mix(vec3(0.7, 0.3, 0.07), vec3(0.84, 0.64, 0.14), fallen.y);
        albedo.assign(
          mix(
            albedo,
            leaf.mul(near.g.mul(0.4).add(0.8)),
            max(fallen.x.mul(close), smoothstep(0.5, 0.75, far.g).mul(0.3)).mul(0.85),
          ),
        );
        slope.assign(bump.mul(0.2));
      })
      .ElseIf(biome.equal(B(BiomeType.Taiga)), () => {
        albedo.assign(base.mul(vec3(0.92, 0.86, 0.76)).mul(grain.mul(0.4).add(0.55)));
        albedo.assign(
          mix(albedo, vec3(0.3, 0.2, 0.12).mul(near.g.mul(0.4).add(0.8)), smoothstep(0.5, 0.7, middle.g).mul(0.45)),
        );
        const lies = smoothstep(0.5, 0.85, far.g.mul(0.7).add(middle.g.mul(0.3)));
        albedo.assign(mix(albedo, vec3(0.8, 0.86, 0.95), lies.mul(0.5)));
        slope.assign(bump.mul(0.2).mul(lies.oneMinus()));
        gloss.assign(lies.mul(sparkle).mul(0.7));
      })
      .ElseIf(kind.equal(G("forest")), () => {
        albedo.assign(
          base.mul(grain.mul(0.4).add(0.62)).mul(mix(vec3(1), vec3(0.8, 0.95, 0.7), smoothstep(0.4, 0.7, middle.g))),
        );
        slope.assign(bump.mul(0.2));
      });

    If(close.greaterThan(0.001), () => {
      strewPebbles({ kind, at, close, albedo });
    });
    const contest = (ground.get("contest") as Node<"float">).mul(0.5);
    albedo.assign(mix(albedo, (ground.get("other") as Node<"vec3">).mul(grain.mul(0.3).add(0.84)), contest));
    gloss.mulAssign(contest.oneMinus());
    glow.mulAssign(contest.oneMinus());
    const highland = smoothstep(0.25, 0.8, input.climate.z);
    const grey = vec3(dot(albedo, LUMA));
    albedo.assign(mix(grey, albedo, mix(1.12, 0.95, highland)).mul(mix(LOWLAND, HIGHLAND, highland)));

    const wet = smoothstep(
      TERRAIN_WATER_LEVEL + 0.05,
      TERRAIN_WATER_LEVEL,
      input.world.y.add(grain.sub(0.5).mul(0.02)),
    );
    albedo.mulAssign(mix(1, 0.74, wet));
    return GroundSurface(albedo, slope.mul(input.top), gloss, glow.mul(input.top));
  })();
}

function strewPebbles(input: {
  kind: Node<"float">;
  at: Node<"vec2">;
  close: Node<"float">;
  albedo: Node<"vec3">;
}): void {
  const { kind, at, close, albedo } = input;
  const share = kind.equal(G("sand")).select(0, kind.equal(G("rock")).select(0.08, 0.03));
  const pebble = strewn(at, 9, share, 0.26);
  const contact = strewn(at.sub(vec2(0.012, -0.016)), 9, share, 0.3);
  albedo.mulAssign(mix(1, 0.72, contact.x.mul(pebble.x.oneMinus()).mul(close)));
  albedo.assign(mix(albedo, albedo.mul(vec3(0.66, 0.6, 0.55)).mul(pebble.y.mul(0.3).add(0.8)), pebble.x.mul(close)));
}

const Ground = struct({ biome: "float", kind: "float", other: "vec3", contest: "float", frontier: "float" });

function chooseGround(input: {
  biomeMap: Texture;
  at: Node<"vec2">;
  climate: Node<"vec2">;
  wobble: Node<"float">;
  dry: Node<"float">;
}) {
  const { at, climate, wobble, dry } = input;
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
    const frontier = float(0).toVar();
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
      const span = beside.ba.sub(own.ba);
      const leaning = besideBiome.greaterThan(ownBiome).select(wobble, wobble.negate());
      const across = dot(climate.sub(own.ba), span)
        .div(max(dot(span, span), 1e-4))
        .add(leaning)
        .sub(0.5);
      const band = meets.select(outside.mul(smoothstep(0, 0.4, dot(fromMiddle, toward).div(apothem))), 0);
      const theirs = band.mul(ownWater.select(dry, smoothstep(-0.05, 0.05, across)));
      const besidePaint = PAINT.element(int(besideBiome)) as unknown as Node<"vec3">;
      If(theirs.greaterThan(claim), () => {
        claim.assign(theirs);
        biome.assign(besideBiome);
        kind.assign(besideKind);
      });
      const close = ownWater.select(0, band.mul(smoothstep(0.2, 0, abs(across))));
      frontier.assign(max(frontier, band.mul(smoothstep(0.7, 0, abs(across)))));
      If(close.greaterThan(contest), () => {
        contest.assign(close);
        other.assign(mix(besidePaint, ownPaint, step(0.5, theirs)));
      });
    }
    return Ground(biome, kind, other, contest, frontier);
  })();
}
