import type Node from "three/src/nodes/core/Node.js";
import { Vector3 } from "three";
import {
  Fn,
  If,
  cameraPosition,
  float,
  fwidth,
  hash,
  mix,
  positionWorld,
  smoothstep,
  step,
  texture,
  uniform,
  vec2,
  vec3,
} from "three/tsl";
import { mapAnimationTime as time } from "../effects/endgame/state";

import { TERRAIN_HEX_HORIZONTAL_SPACING } from "./terrain-coordinates";
import { terrainDetailTile } from "./terrain-detail-tile";
import { hexReach } from "./terrain-ground-node";
import { nearestHexLocalPosition } from "./terrain-hex-node";

export const MIST_COLOURS = {
  deep: [0.016, 0.014, 0.03],
  top: [0.09, 0.07, 0.17],
  innerLight: [0.55, 0.2, 1.0],
  rim: [0.62, 0.5, 0.85],
} as const;
const MIST_DEEP = vec3(...MIST_COLOURS.deep);
const MIST_TOP = vec3(...MIST_COLOURS.top);
const MIST_INNER_LIGHT = vec3(...MIST_COLOURS.innerLight);
const MIST_RIM = vec3(...MIST_COLOURS.rim);

const MIST_DEPTH_RAMP = {
  surface: { density: 0, farStart: 40, drift: 1, scale: 1, flash: 0 },
  deep: { density: 0.35, farStart: 9, drift: 0.4, scale: 0.6, flash: 0.2 },
} as const;
const MIST_FAR_SPAN = 12;
const MIST_FLASH_SECONDS = 11;

export type MistAtDepth = { -readonly [Key in keyof (typeof MIST_DEPTH_RAMP)["surface"]]: number };

export function mistAtDepth(depth: number): MistAtDepth {
  const down = 1 - Math.min(Math.max(depth, 0), 1);
  const { surface, deep } = MIST_DEPTH_RAMP;
  const at = (key: keyof MistAtDepth, steepness = 2) =>
    surface[key] + (deep[key] - surface[key]) * (1 - down ** steepness);
  return {
    density: at("density"),
    farStart: at("farStart", 3),
    drift: at("drift"),
    scale: at("scale"),
    flash: at("flash"),
  };
}

export const MIST_FOCUS = uniform(new Vector3());
const LOW_LAYER = 0.45;
const HIGH_LAYER = 1.1;

export interface MistInput {
  covered: Node<"float">;
  time: Node<"float">;
  scale: Node<"float">;
}

const band = (reach: Node<"float">, at: number, width: Node<"float">) =>
  smoothstep(width, float(0), reach.sub(at).abs());

export function mistColour({ covered, time, scale }: MistInput): Node<"vec3"> {
  return Fn(() => {
    const colour = vec3(0).toVar();
    const ground = positionWorld.xz;
    const reach = hexReach(nearestHexLocalPosition(ground)).div(TERRAIN_HEX_HORIZONTAL_SPACING / 2);
    const fine = fwidth(reach).mul(1.6).max(0.02).toVar();
    If(covered.greaterThan(0.01), () => {
      const ray = positionWorld.sub(cameraPosition).normalize();
      const seenAt = (height: number) => ground.sub(ray.xz.mul(float(height).div(ray.y.negate().max(0.05))));
      const low = seenAt(LOW_LAYER);
      const high = seenAt(HIGH_LAYER);
      const deep = smoothstep(0.9, 0.985, covered);
      const cloud = (at: Node<"vec2">, size: number, drift: Node<"vec2">) =>
        texture(terrainDetailTile(), at.mul(scale.mul(size)).add(drift)).level(float(0)).g;
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

export function layerFloorAir(
  at: Node<"vec2">,
  depth: number,
): { colour: Node<"vec3">; sheets: Node<"float">; haze: Node<"float">; flash: Node<"vec3"> } {
  const mist = mistAtDepth(depth);
  const flowing = time.mul(mist.drift);
  const slow = softMist(at.mul(0.18 * mist.scale).add(vec2(flowing.mul(0.05), flowing.mul(0.02))));
  const drifting = softMist(
    at
      .mul(0.33 * mist.scale)
      .add(vec2(flowing.mul(-0.03), flowing.mul(0.04)))
      .add(vec2(5.1, 2.7)),
  );
  const sheets = smoothstep(0.35, 0.9, slow.mul(0.6).add(drifting.mul(0.4))).mul(mist.density);
  const from = at.sub(MIST_FOCUS.xz);
  const away = from.y.negate().max(0).mul(1.25).add(from.y.max(0).mul(0.55));
  const haze = smoothstep(mist.farStart, mist.farStart + MIST_FAR_SPAN, vec2(from.x.mul(0.8), away).length());
  return { colour: MIST_TOP, sheets, haze, flash: MIST_INNER_LIGHT.mul(mistFlash(at).mul(mist.flash)) };
}

function softMist(at: Node<"vec2">): Node<"float"> {
  const a = at.x.add(at.y.mul(0.6).sin().mul(1.4)).sin();
  const b = at.y.mul(1.3).add(at.x.mul(0.8).cos().mul(1.1)).sin();
  return a.mul(b).mul(0.5).add(0.5);
}

function mistFlash(at: Node<"vec2">): Node<"float"> {
  const cycle = time.div(MIST_FLASH_SECONDS).floor();
  const phase = time.sub(cycle.mul(MIST_FLASH_SECONDS));
  const lot = (salt: number) => hash(cycle.add(salt));
  const rise = smoothstep(0, 0.7, phase).mul(float(1).sub(smoothstep(0.7, 2.4, phase)));
  const centre = MIST_FOCUS.xz.add(vec2(lot(0).sub(0.5), lot(7.3).sub(0.5)).mul(24));
  return rise.mul(step(0.45, lot(3.1))).mul(smoothstep(14, 0, at.sub(centre).length()));
}
