import type { Texture } from "three";
import type Node from "three/src/nodes/core/Node.js";
import {
  Fn,
  If,
  cameraPosition,
  float,
  fwidth,
  max,
  mix,
  positionWorld,
  smoothstep,
  texture,
  vec2,
  vec3,
} from "three/tsl";

import { TERRAIN_HEX_HORIZONTAL_SPACING } from "./terrain-coordinates";
import { terrainDetailTile } from "./terrain-detail-tile";
import { biomeTexelAt, hexReach, PAINT } from "./terrain-ground-node";
import { nearestHexLocalPosition } from "./terrain-hex-node";

/**
 * The mist's colours (the map client's, approved on Picks): near black in its depths, a dusky violet where light grazes
 * its tops, a purple light of its own moving inside it, and a pale rim where it meets known land.
 */
const MIST_DEEP = vec3(0.016, 0.014, 0.03);
const MIST_TOP = vec3(0.09, 0.07, 0.17);
const MIST_INNER_LIGHT = vec3(0.55, 0.2, 1.0);
const MIST_RIM = vec3(0.62, 0.5, 0.85);
/** The light the next hex to explore is seen under: the mist's dusk. */
const DUSK = vec3(0.42, 0.4, 0.46);
/** How high over the ground the mist's two layers lie: each is seen where the eye's ray crosses it. */
const LOW_LAYER = 0.45;
const HIGH_LAYER = 1.1;

export interface MistInput {
  /** How far a point lies under the unknown: 0 on known land, 1 deep in it (the exploration mask). */
  covered: Node<"float">;
  /** The biome of every hex, and which unexplored hexes are next to explore (`TerrainBiomeMap`). */
  biomeMap: Texture;
  time: Node<"float">;
}

/** A thin band round a hex at `at` of its reach, `width` wide, its width kept on the screen. */
const band = (reach: Node<"float">, at: number, width: Node<"float">) =>
  smoothstep(width, float(0), reach.sub(at).abs());

/**
 * The mist over unexplored ground, as one sheet: two drifting layers seen at their own heights along the eye's ray, so
 * it has depth as the camera moves; veins of purple light wandering in its depths; a pale rim lit where it meets known
 * land. A hex next to known land is drawn still and clear inside it: the colour of the land beside it under dusk,
 * lighter toward its middle, a lit rim, and a small hex at its middle, so it asks to be tapped without moving.
 */
export function mistColour({ covered, biomeMap, time }: MistInput): Node<"vec3"> {
  return Fn(() => {
    const colour = vec3(0).toVar();
    // Known land is drawn over the sheet: nothing of the mist needs working out there.
    If(covered.greaterThan(0.01), () => {
      const ground = positionWorld.xz;
      const ray = positionWorld.sub(cameraPosition).normalize();
      const seenAt = (height: number) => ground.sub(ray.xz.mul(float(height).div(ray.y.negate().max(0.05))));
      const low = seenAt(LOW_LAYER);
      const high = seenAt(HIGH_LAYER);
      const deep = smoothstep(0.9, 0.985, covered);
      // The detail tile's grain is smooth noise: read, it costs far less than noise worked out a pixel at a time.
      const cloud = (at: Node<"vec2">, scale: number, drift: Node<"vec2">) =>
        texture(terrainDetailTile(), at.mul(scale).add(drift)).g;
      const billowLow = cloud(low, 0.05, vec2(time.mul(0.015), time.mul(-0.01)));
      const billowHigh = cloud(high, 0.14, vec2(time.mul(-0.02), time.mul(0.009)));
      const vein = cloud(low.yx, 0.03, vec2(time.mul(-0.006), time.mul(0.005)));
      const lowBody = mix(MIST_DEEP, MIST_TOP, smoothstep(0.3, 0.9, billowLow).mul(deep.oneMinus().mul(0.4).add(0.35)));
      const highVeil = smoothstep(0.5, 0.9, billowHigh).mul(0.5);
      const body = mix(lowBody, MIST_TOP, highVeil.mul(0.5));
      const inner = MIST_INNER_LIGHT.mul(smoothstep(0.52, 0.9, vein).pow(2))
        .mul(deep.mul(0.65).add(0.35))
        .mul(0.45);
      const edge = smoothstep(0.08, 0.45, covered).mul(smoothstep(0.85, 0.5, covered));
      const fromMiddle = nearestHexLocalPosition(ground);
      const reach = hexReach(fromMiddle).div(TERRAIN_HEX_HORIZONTAL_SPACING / 2);
      const fine = fwidth(reach).mul(1.6).max(0.02);
      colour.assign(
        body
          .add(inner)
          .add(MIST_RIM.mul(edge).mul(0.5))
          .add(MIST_TOP.mul(band(reach, 1, fine)).mul(0.5)),
      );
      If(biomeTexelAt(biomeMap, ground).b.greaterThan(0.5), () => {
        colour.assign(nextToExplore(biomeMap, ground.sub(fromMiddle), reach, fine));
      });
    });
    return colour;
  })();
}

/** A hex next to known land, still: the land beside it under dusk, lighter to its middle, a lit rim, a mark. */
function nextToExplore(biomeMap: Texture, middle: Node<"vec2">, reach: Node<"float">, fine: Node<"float">) {
  const beside = besideColour(biomeMap, middle);
  const seen = mix(beside, MIST_TOP.mul(2), 0.25).mul(DUSK).mul(reach.oneMinus().mul(0.55).add(0.62));
  const rim = band(reach, 0.94, fine);
  const halo = smoothstep(0.5, 1, reach);
  const mark = band(reach, 0.17, fine.mul(0.9));
  return seen.add(MIST_RIM.mul(rim.mul(1.7).add(halo.mul(halo).mul(0.3)))).add(vec3(0.85, 0.75, 1).mul(mark.mul(0.7)));
}

/** The colour of the known land round a hex: its explored neighbours' own colours, averaged. */
function besideColour(biomeMap: Texture, middle: Node<"vec2">): Node<"vec3"> {
  let sum: Node<"vec3"> = vec3(0);
  let count: Node<"float"> = float(0);
  for (let side = 0; side < 6; side += 1) {
    const angle = side * (Math.PI / 3);
    const offset = vec2(Math.cos(angle), Math.sin(angle)).mul(TERRAIN_HEX_HORIZONTAL_SPACING);
    const texel = biomeTexelAt(biomeMap, middle.add(offset));
    const known = texel.a.greaterThan(0.5).select(1, 0);
    const colour = PAINT.element(texel.r.mul(255).round().toInt()) as unknown as Node<"vec3">;
    sum = sum.add(colour.mul(known));
    count = count.add(known);
  }
  return sum.div(max(count, 1));
}
