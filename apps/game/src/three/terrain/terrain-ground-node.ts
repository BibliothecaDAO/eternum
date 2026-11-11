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
export const PAINT = uniformArray(
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
 * The ground, by its biome (ported from the map client's ground shader, approved by the owner on Picks in rounds 6 to
 * 9): a beach's fine wet sand, a desert's dunes, a dry pan's cracked plates, grass with flowers the wind runs over,
 * heath with bare earth, the wet floor of a rain forest, red earth, moss, fallen leaves, needles with snow in the
 * hollows, tundra, a snowfield, slabs of rock with lichen, a crust over lava. A biome's edge wanders off the hexes'
 * edges and breaks into patches, and each ground carries something of itself over the frontier: snow dusts what lies
 * beside it, sand blows over grass, grass creeps into sand, stones roll off the rock, ash lies round the lava.
 */
export function groundSurface(input: GroundSurfaceInput) {
  const { at, biomeMap, detail, time } = input;
  return Fn(() => {
    const near = texture(detail, at.mul(0.95));
    const middle = texture(detail, at.yx.mul(0.31).add(vec2(0.13, 0.57)));
    const far = texture(detail, at.yx.mul(0.11).add(vec2(0.37, 0.11)));
    const other = texture(detail, at.yx.mul(0.71).add(vec2(0.31, 0.77)));
    const grain = near.g.mul(0.55).add(far.g.mul(0.45));
    // The biome is read a little way off: by a slow noise, so its edge is not a hex's, and by a fine one, so the edge
    // breaks into patches of either ground.
    const wander = vec2(middle.g.sub(0.5), far.g.sub(0.5)).mul(1.1);
    const patches = vec2(near.g.sub(0.5), other.g.sub(0.5)).mul(0.7);
    const liesAt = at.add(wander).add(patches);
    const here = biomeTexelAt(biomeMap, liesAt);
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
        // A dry pan: plates of baked earth with cracks between them, gravel, the stain of old scrub.
        const crack = smoothstep(0.02, 0.2, middle.r).oneMinus();
        albedo.assign(
          base
            .mul(vec3(0.96, 0.9, 0.84))
            .mul(middle.g.mul(0.3).add(0.8))
            .mul(crack.mul(0.62).oneMinus()),
        );
        albedo.assign(mix(albedo, base.mul(vec3(0.66, 0.7, 0.52)), smoothstep(0.6, 0.78, far.g).mul(0.5)));
        const gravel = strewn(at, 8, smoothstep(0.45, 0.7, other.g).mul(0.2), near.g.mul(0.16).add(0.12));
        albedo.assign(mix(albedo, vec3(0.5, 0.45, 0.4).mul(gravel.y.mul(0.6).add(0.7)), gravel.x.mul(close).mul(0.8)));
        slope.assign(middle.ba.sub(0.5).mul(crack).mul(1.2).add(near.ba.sub(0.5).mul(0.2)));
      })
      .ElseIf(kind.equal(G("snow")).or(kind.equal(G("tundra"))), () => {
        // Tundra keeps its snow in patches; a snowfield is all drift, blue in its hollows.
        const isTundra = kind.equal(G("tundra"));
        const lies = isTundra.select(smoothstep(0.42, 0.56, middle.g.mul(0.6).add(far.g.mul(0.4))), float(1));
        const bare = base.mul(vec3(0.94, 0.8, 0.7)).mul(near.r.mul(0.42).add(0.7));
        const drift = mix(vec3(0.74, 0.82, 0.98), vec3(1), smoothstep(0.3, 0.7, middle.g));
        const snow = mix(base, vec3(0.86, 0.9, 0.96), 0.55)
          .mul(grain.mul(0.1).add(0.93))
          .mul(drift);
        albedo.assign(mix(bare, snow, lies));
        const combed = dot(at, WIND).mul(6).add(far.g.mul(9)).add(middle.g.mul(4));
        const smoothSnow = isTundra.select(0, 1);
        slope.assign(
          mix(
            near.ba.sub(0.5).mul(0.7),
            mix(middle.ba.sub(0.5).mul(0.45), WIND.mul(combed.cos()).mul(0.12), smoothSnow),
            lies,
          ),
        );
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
        slope.assign(middle.ba.sub(0.5).mul(1.3).add(near.ba.sub(0.5).mul(0.5)));
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
        slope.assign(near.ba.sub(0.5).mul(0.15));
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
        slope.assign(near.ba.sub(0.5).mul(0.25));
      })
      .ElseIf(biome.equal(B(BiomeType.TropicalRainForest)), () => {
        // A wet floor, dark and rich, with standing water that takes the sky.
        albedo.assign(base.mul(vec3(0.72, 0.98, 0.74)).mul(grain.mul(0.46).add(0.56)));
        albedo.assign(mix(albedo, base.mul(vec3(0.95, 1.3, 0.6)), smoothstep(0.62, 0.72, near.g).mul(0.35)));
        gloss.assign(smoothstep(0.6, 0.76, middle.g).mul(0.7));
        albedo.mulAssign(gloss.mul(0.35).oneMinus());
        slope.assign(near.ba.sub(0.5).mul(0.3).mul(gloss.oneMinus()));
      })
      .ElseIf(biome.equal(B(BiomeType.TropicalSeasonalForest)), () => {
        // Dry season: yellowed growth over red earth.
        albedo.assign(
          base.mul(grain.mul(0.4).add(0.7)).mul(mix(vec3(1), vec3(1.16, 1, 0.6), smoothstep(0.4, 0.7, far.g))),
        );
        albedo.assign(
          mix(albedo, vec3(0.5, 0.21, 0.11).mul(near.g.mul(0.4).add(0.8)), smoothstep(0.58, 0.72, middle.g).mul(0.65)),
        );
        slope.assign(near.ba.sub(0.5).mul(0.3));
      })
      .ElseIf(biome.equal(B(BiomeType.TemperateRainForest)), () => {
        // Moss in cushions over a damp floor.
        albedo.assign(base.mul(vec3(0.78, 0.98, 0.88)).mul(grain.mul(0.4).add(0.58)));
        albedo.assign(mix(albedo, base.mul(vec3(0.9, 1.4, 0.66)), smoothstep(0.52, 0.7, middle.g).mul(0.55)));
        gloss.assign(smoothstep(0.55, 0.85, far.g).mul(0.25));
        slope.assign(middle.ba.sub(0.5).mul(0.5));
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
        slope.assign(near.ba.sub(0.5).mul(0.35));
      })
      .ElseIf(biome.equal(B(BiomeType.Taiga)), () => {
        // Needles under the firs, and snow that has stayed in the hollows.
        albedo.assign(base.mul(vec3(0.92, 0.86, 0.76)).mul(grain.mul(0.4).add(0.55)));
        albedo.assign(
          mix(albedo, vec3(0.3, 0.2, 0.12).mul(near.g.mul(0.4).add(0.8)), smoothstep(0.5, 0.7, middle.g).mul(0.45)),
        );
        const lies = smoothstep(0.5, 0.6, far.g.mul(0.5).add(other.g.mul(0.5)));
        albedo.assign(mix(albedo, vec3(0.8, 0.86, 0.95), lies.mul(0.9)));
        slope.assign(near.ba.sub(0.5).mul(0.3).mul(lies.oneMinus()));
        gloss.assign(lies.mul(sparkle).mul(0.7));
      })
      .ElseIf(kind.equal(G("forest")), () => {
        albedo.assign(
          base.mul(grain.mul(0.4).add(0.62)).mul(mix(vec3(1), vec3(0.8, 0.95, 0.7), smoothstep(0.4, 0.7, middle.g))),
        );
        slope.assign(near.ba.sub(0.5).mul(0.3));
      });

    carryAcrossFrontiers({ biomeMap, at, liesAt, kind, near, middle, far, sparkle, albedo, gloss, glow, time });

    // The side of a raised hex: darker earth in bands. The shore: a dark wet band.
    const strata = input.world.y.mul(38).add(grain.mul(5)).sin().mul(0.25).add(0.55);
    albedo.assign(mix(base.mul(vec3(0.5, 0.42, 0.36)).mul(strata), albedo, input.top));
    albedo.mulAssign(mix(1, 0.72, smoothstep(0.55, 1, input.shore.add(grain.sub(0.5).mul(0.2)))));
    return GroundSurface(albedo, slope.mul(input.top), gloss, glow.mul(input.top));
  })();
}

/** What the grounds round a point carry over the frontier into it. */
function carryAcrossFrontiers(input: {
  biomeMap: Texture;
  at: Node<"vec2">;
  liesAt: Node<"vec2">;
  kind: Node<"float">;
  near: Node<"vec4">;
  middle: Node<"vec4">;
  far: Node<"vec4">;
  sparkle: Node<"float">;
  albedo: Node<"vec3">;
  gloss: Node<"float">;
  glow: Node<"vec3">;
  time: Node<"float">;
}): void {
  const { at, kind, near, middle, far, albedo, gloss, glow } = input;
  const beside = around(input.biomeMap, input.liesAt, 0.8);
  const ragged = near.g.mul(0.6).add(middle.g.mul(0.4));
  If(kind.notEqual(G("snow")).and(kind.notEqual(G("lava"))), () => {
    // Snow dusts what lies beside it, thicker toward the snow.
    const dusted = smoothstep(0.62, 0.78, beside.snow.mul(0.9).add(ragged.mul(0.5))).mul(
      kind.equal(G("tundra")).select(0, 1),
    );
    albedo.assign(mix(albedo, vec3(0.84, 0.89, 0.96), dusted.mul(0.85)));
    gloss.assign(max(gloss, dusted.mul(input.sparkle).mul(0.7)));
    glow.mulAssign(dusted.oneMinus());
  });
  If(kind.notEqual(G("lava")), () => {
    // Ash round the lava, and the last of its heat in the cracks of the ground beside it.
    const scorched = smoothstep(0.1, 0.7, beside.lava.add(ragged.sub(0.5).mul(0.4)));
    albedo.assign(mix(albedo, albedo.mul(vec3(0.3, 0.26, 0.26)), scorched.mul(0.8)));
    const ember = smoothstep(0.02, 0.1, middle.r).oneMinus().mul(scorched).mul(scorched);
    glow.addAssign(
      vec3(2.4, 0.5, 0.06)
        .mul(ember)
        .mul(input.time.mul(1.3).add(far.g.mul(9)).sin().mul(0.5).add(0.5)),
    );
  });
  If(kind.equal(G("grass")).or(kind.equal(G("forest"))), () => {
    // Sand blown in from a desert lies in streaks down the wind.
    const streak = smoothstep(
      0.45,
      0.75,
      dot(at, vec2(WIND.y.negate(), WIND.x)).mul(9).add(far.g.mul(12)).sin().mul(0.5).add(0.5),
    );
    const blown = smoothstep(0.25, 0.8, beside.sand.add(ragged.sub(0.5).mul(0.5))).mul(streak);
    albedo.assign(mix(albedo, vec3(0.78, 0.62, 0.36).mul(near.g.mul(0.3).add(0.85)), blown.mul(0.6)));
  });
  If(kind.equal(G("sand")), () => {
    // Grass creeps into the sand in patches, the earth under it darker.
    const crept = smoothstep(0.5, 0.72, beside.green.mul(0.8).add(ragged.mul(0.55)));
    albedo.assign(mix(albedo, vec3(0.3, 0.38, 0.14).mul(near.g.mul(0.5).add(0.75)), crept.mul(0.75)));
  });
  If(kind.notEqual(G("rock")).and(kind.notEqual(G("lava"))), () => {
    // Stones have rolled off the rock.
    const stone = strewn(at, 7, beside.rock.mul(0.8), 0.3);
    albedo.assign(mix(albedo, vec3(0.44, 0.42, 0.4).mul(stone.y.mul(0.6).add(0.6)), stone.x.mul(0.9)));
  });
}

/** What lies round a point of ground: the share of six points about it on each ground a frontier carries across. */
function around(biomeMap: Texture, at: Node<"vec2">, reach: number) {
  const shares: Record<"snow" | "lava" | "sand" | "green" | "rock", Node<"float">> = {
    snow: float(0),
    lava: float(0),
    sand: float(0),
    green: float(0),
    rock: float(0),
  };
  for (let tap = 0; tap < 6; tap += 1) {
    const angle = tap * (Math.PI / 3) + 0.5;
    const ground = biomeTexelAt(biomeMap, at.add(vec2(Math.cos(angle) * reach, Math.sin(angle) * reach)))
      .g.mul(255)
      .round();
    const is = (name: TerrainGround) => ground.equal(G(name)).select(1, 0);
    shares.snow = shares.snow.add(is("snow").add(is("tundra")));
    shares.lava = shares.lava.add(is("lava"));
    shares.sand = shares.sand.add(is("sand"));
    shares.green = shares.green.add(is("grass").add(is("forest")));
    shares.rock = shares.rock.add(is("rock"));
  }
  return {
    snow: shares.snow.div(6),
    lava: shares.lava.div(6),
    sand: shares.sand.div(6),
    green: shares.green.div(6),
    rock: shares.rock.div(6),
  };
}
