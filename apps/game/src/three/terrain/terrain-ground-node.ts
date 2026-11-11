import { BiomeType } from "@bibliothecadao/types/terrain";
import { Color, type Texture } from "three";
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

import { BIOME_MAP_SIZE, biomeNumber, groundNumber } from "./terrain-biome-map";
import { TERRAIN_HEX_HORIZONTAL_SPACING, TERRAIN_HEX_VERTICAL_SPACING } from "./terrain-coordinates";
import { nearestHexLocalPosition } from "./terrain-hex-node";
import { TERRAIN_BIOME_DESCRIPTORS, type TerrainGround } from "./terrain-palette";

/** What the ground is at a point: its colour, its relief as a slope east and south, its gloss and its own light. */
const GroundSurface = struct({ albedo: "vec3", slope: "vec2", gloss: "float", glow: "vec3" });

export interface GroundSurfaceInput {
  /** The biome of every hex (`TerrainBiomeMap`). */
  biomeMap: Texture;
  /** The detail tile (`terrainDetailTile`). */
  detail: Texture;
  /** The ground's place, as the terrain is drawn. */
  at: Node<"vec2">;
  world: Node<"vec3">;
  /** The palette's colour as the terrain's mesh blends it across hexes. */
  meshColour: Node<"vec3">;
  /** 1 where the surface faces up, 0 on the side of a raised hex. */
  top: Node<"float">;
  /** 1 at the shore, falling inland. */
  shore: Node<"float">;
  time: Node<"float">;
}

const WIND = vec2(0.8, 0.6);
const B = (biome: BiomeType) => float(biomeNumber(biome));
const G = (ground: TerrainGround) => float(groundNumber(ground));

/** Each biome's own colour, in the catalog's order: the colour a frontier wandering into a hex paints. */
const PAINT = uniformArray(
  Object.values(BiomeType).map((biome) => new Color(TERRAIN_BIOME_DESCRIPTORS[biome].primary)),
  "color",
);

const hash3 = (p: Node<"vec3">): Node<"float"> => {
  const q = fract(p.mul(vec3(0.1031, 0.103, 0.0973))).toVar();
  q.addAssign(dot(q, q.yxz.add(33.33)));
  return fract(q.x.add(q.y).mul(q.z));
};

/** How far a point is from a hex's middle as a hex measures it. */
export const hexReach = (fromMiddle: Node<"vec2">): Node<"float"> => {
  const local = abs(fromMiddle);
  return max(local.x, dot(local, vec2(0.5, Math.sqrt(3) / 2)));
};

/**
 * Small things strewn on the ground, each a hex of `size` in one cell of a grid `fine` cells to a unit, a `share` of
 * the cells holding one. x: 1 inside one. y: a number of its own.
 */
const strewn = (at: Node<"vec2">, fine: number, share: Node<"float"> | number, size: Node<"float"> | number) => {
  const cell = at.mul(fine).floor();
  const lot = vec3(cell.x, 3.7, cell.y);
  const middle = cell
    .add(0.25)
    .add(vec2(hash3(lot.mul(1.3)), hash3(lot.mul(2.9))).mul(0.5))
    .div(fine);
  const inside = step(hexReach(at.sub(middle)).mul(fine), size).mul(step(hash3(lot.mul(5.1)), share));
  return vec2(inside, hash3(lot.mul(7.7)));
};

/** The texel of the biome map that holds the hex a point lies in: its render hex, wrapped as the map writes it. */
const biomeTexelAt = (biomeMap: Texture, point: Node<"vec2">) => {
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
 * The ground, by its biome (ported from the map client's ground shader, approved by the owner on Picks in rounds 6 to
 * 9): a beach's fine wet sand, a desert's dunes, dry baked earth, grass with flowers the wind runs over, heath with bare
 * earth, the wet floor of a rain forest, red earth, moss, fallen leaves, needles with snow in the hollows, tundra, a
 * snowfield, slabs of rock with lichen, a crust over lava. Each hex is its own ground; two grounds meet in a soft
 * gradient across their shared edge, which wanders a little, never in islands of one ground in the other. Only rock and
 * lava show the detail tile's stones: on every other ground they would draw cracks.
 */
export function groundSurface(input: GroundSurfaceInput) {
  const { at, biomeMap, detail, time } = input;
  return Fn(() => {
    // Sampled once, before the branches by biome: a texture is sampled where every pixel of a quad takes the same path.
    const near = texture(detail, at.mul(0.95)).toVar();
    const middle = texture(detail, at.yx.mul(0.31).add(vec2(0.13, 0.57))).toVar();
    const far = texture(detail, at.yx.mul(0.11).add(vec2(0.37, 0.11))).toVar();
    const other = texture(detail, at.yx.mul(0.71).add(vec2(0.31, 0.77))).toVar();
    const grain = near.g.mul(0.55).add(far.g.mul(0.45));
    // A soft bump from the grain: relief without the stones' edges.
    const bump = vec2(near.g.sub(other.g), middle.g.sub(far.g));
    const hexMiddle = at.sub(nearestHexLocalPosition(at));
    const here = biomeTexelAt(biomeMap, hexMiddle);
    const biome = here.r.mul(255).round().toVar();
    const kind = here.g.mul(255).round().toVar();
    // Small things are drawn only near the eye: far off they would only glitter.
    const close = smoothstep(18, 8, cameraPosition.distance(input.world));
    const painted = PAINT.element(int(biome)) as unknown as Node<"vec3">;
    const base = mix(input.meshColour, painted, kind.equal(G("water")).select(0, 0.7)).toVar();
    const glint = strewn(at, 34, 0.1, 0.22);
    const sparkle = glint.x.mul(close).mul(time.mul(2.6).add(glint.y.mul(40)).sin().mul(0.45).add(0.55));

    const albedo = base.mul(grain.mul(0.3).add(0.84)).mul(far.r.mul(0.16).add(0.9)).toVar();
    const slope = vec2(0).toVar();
    const gloss = float(0).toVar();
    const glow = vec3(0).toVar();

    If(biome.equal(B(BiomeType.Beach)), () => {
      // Fine ripples, pale and dry above; shells.
      const phase = dot(at, WIND).mul(26).add(far.g.mul(8)).add(middle.g.mul(3));
      albedo.assign(
        base
          .mul(vec3(1.08, 1.04, 0.95))
          .mul(phase.sin().mul(0.06).add(0.94))
          .mul(far.r.mul(0.1).add(0.94)),
      );
      albedo.assign(mix(albedo, vec3(0.95, 0.9, 0.84), strewn(at, 11, 0.12, 0.2).x.mul(close).mul(0.8)));
      slope.assign(WIND.mul(phase.cos()).mul(0.1));
      gloss.assign(sparkle.mul(0.6));
    })
      .ElseIf(biome.equal(B(BiomeType.SubtropicalDesert)), () => {
        // Dunes: long crests lit on one side, the wind's ripples over them.
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
        // Dry baked earth, mottled, gravel, the stain of old scrub.
        albedo.assign(
          base
            .mul(vec3(0.96, 0.9, 0.84))
            .mul(middle.g.mul(0.3).add(0.8))
            .mul(near.g.mul(0.16).add(0.92)),
        );
        albedo.assign(mix(albedo, base.mul(vec3(0.66, 0.7, 0.52)), smoothstep(0.6, 0.78, far.g).mul(0.5)));
        const gravel = strewn(at, 8, smoothstep(0.45, 0.7, other.g).mul(0.2), near.g.mul(0.16).add(0.12));
        albedo.assign(mix(albedo, vec3(0.5, 0.45, 0.4).mul(gravel.y.mul(0.6).add(0.7)), gravel.x.mul(close).mul(0.8)));
        slope.assign(bump.mul(0.2));
      })
      .ElseIf(kind.equal(G("snow")).or(kind.equal(G("tundra"))), () => {
        // Tundra keeps its snow in patches; a snowfield is all drift, blue in its hollows.
        const isTundra = kind.equal(G("tundra"));
        const lies = isTundra.select(smoothstep(0.3, 0.75, middle.g.mul(0.4).add(far.g.mul(0.6))).mul(0.7), float(1));
        const bare = base.mul(vec3(0.94, 0.8, 0.7)).mul(near.g.mul(0.42).add(0.7));
        const drift = mix(vec3(0.74, 0.82, 0.98), vec3(1), smoothstep(0.3, 0.7, middle.g));
        const snow = mix(base, vec3(0.86, 0.9, 0.96), 0.55)
          .mul(grain.mul(0.1).add(0.93))
          .mul(drift);
        albedo.assign(mix(bare, snow, lies));
        const combed = dot(at, WIND).mul(6).add(far.g.mul(9)).add(middle.g.mul(4));
        const smoothSnow = isTundra.select(0, 1);
        slope.assign(mix(bump.mul(0.3), mix(bump.mul(0.2), WIND.mul(combed.cos()).mul(0.12), smoothSnow), lies));
        gloss.assign(lies.mul(sparkle).mul(0.9));
      })
      .ElseIf(kind.equal(G("rock")), () => {
        // Slabs with cracks between them, smaller stones on the slabs, lichen where it is damp.
        albedo.assign(
          base
            .mul(vec3(0.9, 0.86, 0.82))
            .mul(middle.r.mul(0.5).add(0.52))
            .mul(near.r.mul(0.3).add(0.78)),
        );
        albedo.assign(
          mix(
            albedo,
            vec3(0.36, 0.42, 0.2).mul(near.g.mul(0.5).add(0.7)),
            smoothstep(0.58, 0.74, far.g.mul(0.55).add(near.g.mul(0.45))).mul(0.4),
          ),
        );
        slope.assign(middle.ba.sub(0.5).mul(0.7).add(bump.mul(0.2)));
      })
      .ElseIf(kind.equal(G("lava")), () => {
        // A dark crust in plates; the cracks between them glow, and the glow travels along them.
        const crack = smoothstep(0.02, 0.4, middle.r).oneMinus();
        const heat = crack.mul(time.mul(1.1).add(far.g.mul(9)).add(near.g.mul(14)).sin().mul(0.55).add(0.45));
        albedo.assign(base.mul(0.55).mul(middle.r.mul(0.5).add(0.6)).mul(near.r.mul(0.3).add(0.8)));
        slope.assign(middle.ba.sub(0.5).mul(1.5));
        glow.assign(
          vec3(5, 1.3, 0.2)
            .mul(heat.mul(heat))
            .add(vec3(1.4, 0.2, 0.02).mul(crack)),
        );
      })
      .ElseIf(biome.equal(B(BiomeType.Grassland)), () => {
        // Tufts lighter and darker, the wind's gusts running over it as bands of lighter green, and flowers.
        const tufts = near.g.mul(0.5).add(middle.g.mul(0.5));
        const gust = smoothstep(0.55, 1, dot(at, WIND).mul(0.85).sub(time.mul(1.3)).add(far.g.mul(7)).sin());
        albedo.assign(base.mul(tufts.mul(0.4).add(0.8)).mul(gust.mul(0.12).add(1)));
        const bloom = strewn(at, 13, 0.22, 0.2);
        const flower = mix(
          mix(vec3(0.95, 0.92, 0.82), vec3(0.98, 0.78, 0.12), step(0.4, bloom.y)),
          vec3(0.62, 0.36, 0.85),
          step(0.75, bloom.y),
        );
        albedo.assign(mix(albedo, flower, bloom.x.mul(close).mul(smoothstep(0.42, 0.6, far.g))));
        slope.assign(bump.mul(0.1));
      })
      .ElseIf(biome.equal(B(BiomeType.Shrubland)), () => {
        // Heath: dry grass, patches of bare earth, heather.
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
        // A wet floor, dark and rich, with standing water that takes the sky.
        albedo.assign(base.mul(vec3(0.72, 0.98, 0.74)).mul(grain.mul(0.46).add(0.56)));
        albedo.assign(mix(albedo, base.mul(vec3(0.95, 1.3, 0.6)), smoothstep(0.62, 0.72, near.g).mul(0.35)));
        gloss.assign(smoothstep(0.6, 0.76, middle.g).mul(0.7));
        albedo.mulAssign(gloss.mul(0.35).oneMinus());
        slope.assign(bump.mul(0.2).mul(gloss.oneMinus()));
      })
      .ElseIf(biome.equal(B(BiomeType.TropicalSeasonalForest)), () => {
        // Dry season: yellowed growth over red earth.
        albedo.assign(
          base.mul(grain.mul(0.4).add(0.7)).mul(mix(vec3(1), vec3(1.16, 1, 0.6), smoothstep(0.4, 0.7, far.g))),
        );
        albedo.assign(
          mix(albedo, vec3(0.5, 0.21, 0.11).mul(near.g.mul(0.4).add(0.8)), smoothstep(0.58, 0.72, middle.g).mul(0.65)),
        );
        slope.assign(bump.mul(0.2));
      })
      .ElseIf(biome.equal(B(BiomeType.TemperateRainForest)), () => {
        // Moss in cushions over a damp floor.
        albedo.assign(base.mul(vec3(0.78, 0.98, 0.88)).mul(grain.mul(0.4).add(0.58)));
        albedo.assign(mix(albedo, base.mul(vec3(0.9, 1.4, 0.66)), smoothstep(0.52, 0.7, middle.g).mul(0.55)));
        gloss.assign(smoothstep(0.55, 0.85, far.g).mul(0.25));
        slope.assign(bump.mul(0.25));
      })
      .ElseIf(biome.equal(B(BiomeType.TemperateDeciduousForest)), () => {
        // Fallen leaves, orange and yellow, over the litter.
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
        // Needles under the firs, and snow that has stayed in the hollows.
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

    meetTheNeighbours({ biomeMap, at, biome, far, middle, grain, albedo, gloss, glow });

    // The side of a raised hex: darker earth in bands. The shore: a dark wet band.
    const strata = input.world.y.mul(38).add(grain.mul(5)).sin().mul(0.25).add(0.55);
    albedo.assign(mix(base.mul(vec3(0.5, 0.42, 0.36)).mul(strata), albedo, input.top));
    albedo.mulAssign(mix(1, 0.72, smoothstep(0.55, 1, input.shore.add(grain.sub(0.5).mul(0.2)))));
    return GroundSurface(albedo, slope.mul(input.top), gloss, glow.mul(input.top));
  })();
}

/**
 * Grounds meet in a soft gradient across their shared edges: each of the six hexes beside a point weighs in as the point
 * nears their shared edge, as much as the point's own ground at the edge itself and a third each at a corner, so the
 * colour runs on across every edge and corner without a seam. A slow noise moves where the gradient starts, so the
 * meeting wanders well off the hexes' lines. Water is met by the shore's own band instead.
 */
function meetTheNeighbours(input: {
  biomeMap: Texture;
  at: Node<"vec2">;
  biome: Node<"float">;
  far: Node<"vec4">;
  middle: Node<"vec4">;
  grain: Node<"float">;
  albedo: Node<"vec3">;
  gloss: Node<"float">;
  glow: Node<"vec3">;
}): void {
  const { at, far, middle, albedo, gloss, glow } = input;
  const fromMiddle = nearestHexLocalPosition(at);
  const middleAt = at.sub(fromMiddle);
  const apothem = TERRAIN_HEX_HORIZONTAL_SPACING / 2;
  const wobble = far.g.sub(0.5).mul(0.6).add(middle.g.sub(0.5).mul(0.2));
  let weight: Node<"float"> = float(1);
  let colour: Node<"vec3"> = albedo;
  for (let side = 0; side < 6; side += 1) {
    const toward = vec2(Math.cos((side * Math.PI) / 3), Math.sin((side * Math.PI) / 3));
    const beside = biomeTexelAt(input.biomeMap, middleAt.add(toward.mul(TERRAIN_HEX_HORIZONTAL_SPACING)));
    const besideBiome = beside.r.mul(255).round();
    const land = beside.a
      .greaterThan(0.5)
      .and(beside.g.mul(255).round().notEqual(G("water")))
      .select(1, 0);
    const nearness = dot(fromMiddle, toward).div(apothem);
    const share = smoothstep(0.25, 1, nearness.add(wobble)).mul(land);
    const painted = PAINT.element(int(besideBiome)) as unknown as Node<"vec3">;
    const theirs = besideBiome.equal(input.biome).select(albedo, painted.mul(input.grain.mul(0.3).add(0.84)));
    weight = weight.add(share);
    colour = colour.add(theirs.mul(share));
  }
  const ownShare = float(1).div(weight);
  albedo.assign(colour.div(weight));
  gloss.mulAssign(ownShare);
  glow.mulAssign(ownShare);
}
