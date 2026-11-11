import type Node from "three/src/nodes/core/Node.js";
import { Fn, If, cameraPosition, float, fwidth, mix, positionWorld, smoothstep, texture, vec2, vec3 } from "three/tsl";

import { TERRAIN_HEX_HORIZONTAL_SPACING } from "./terrain-coordinates";
import { terrainDetailTile } from "./terrain-detail-tile";
import { hexReach } from "./terrain-ground-node";
import { nearestHexLocalPosition } from "./terrain-hex-node";

/**
 * The mist's colours (the map client's, approved on Picks): near black in its depths, a dusky violet where light grazes
 * its tops, a purple light of its own moving inside it, and a pale rim where it meets known land.
 */
const MIST_DEEP = vec3(0.016, 0.014, 0.03);
const MIST_TOP = vec3(0.09, 0.07, 0.17);
const MIST_INNER_LIGHT = vec3(0.55, 0.2, 1.0);
const MIST_RIM = vec3(0.62, 0.5, 0.85);
/** How high over the ground the mist's two layers lie: each is seen where the eye's ray crosses it. */
const LOW_LAYER = 0.45;
const HIGH_LAYER = 1.1;

export interface MistInput {
  /** How far a point lies under the unknown: 0 on known land, 1 deep in it (the exploration mask). */
  covered: Node<"float">;
  time: Node<"float">;
}

/** A thin band round a hex at `at` of its reach, `width` wide, its width kept on the screen. */
const band = (reach: Node<"float">, at: number, width: Node<"float">) =>
  smoothstep(width, float(0), reach.sub(at).abs());

/**
 * The mist over unexplored ground, as one sheet: two drifting layers seen at their own heights along the eye's ray, so
 * it has depth as the camera moves; veins of purple light wandering in its depths; a pale rim lit where it meets known
 * land. Which hexes an army can explore is shown by the army's own orders once it is selected, never by the mist.
 */
export function mistColour({ covered, time }: MistInput): Node<"vec3"> {
  return Fn(() => {
    const colour = vec3(0).toVar();
    const ground = positionWorld.xz;
    // Worked out for every pixel, before the branch: a screen derivative is only defined where a quad takes one path.
    const reach = hexReach(nearestHexLocalPosition(ground)).div(TERRAIN_HEX_HORIZONTAL_SPACING / 2);
    const fine = fwidth(reach).mul(1.6).max(0.02).toVar();
    // Known land is drawn over the sheet: nothing of the mist needs working out there.
    If(covered.greaterThan(0.01), () => {
      const ray = positionWorld.sub(cameraPosition).normalize();
      const seenAt = (height: number) => ground.sub(ray.xz.mul(float(height).div(ray.y.negate().max(0.05))));
      const low = seenAt(LOW_LAYER);
      const high = seenAt(HIGH_LAYER);
      const deep = smoothstep(0.9, 0.985, covered);
      // The detail tile's grain is smooth noise; read at its full size, as a branch cannot sample by derivatives.
      const cloud = (at: Node<"vec2">, scale: number, drift: Node<"vec2">) =>
        texture(terrainDetailTile(), at.mul(scale).add(drift)).level(float(0)).g;
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
      colour.assign(
        body
          .add(inner)
          .add(MIST_RIM.mul(edge).mul(0.5))
          .add(MIST_TOP.mul(band(reach, 1, fine)).mul(0.5)),
      );
    });
    return colour;
  })();
}
