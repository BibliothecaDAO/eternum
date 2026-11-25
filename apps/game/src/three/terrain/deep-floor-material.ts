import type Node from "three/src/nodes/core/Node.js";
import { Vector2, Vector4 } from "three";
import {
  atan,
  color,
  float,
  fwidth,
  max,
  min,
  mix,
  normalWorld,
  positionWorld,
  smoothstep,
  uniform,
  vec2,
} from "three/tsl";
import { MeshStandardNodeMaterial } from "three/webgpu";
import { applyEndgameFrost } from "../effects/endgame/field";
import palette from "./deep-palette.json";
import { LAYER_DEPTHS } from "./layer-biomes";
import { cellHash } from "./terrain-cell-hash";
import { layerFloorAir } from "./terrain-mist-node";

const SQRT3 = Math.sqrt(3);

export const DEEP_PALETTE: Readonly<Record<keyof typeof palette, string>> = palette;

export const DEEP_FLOOR = {
  center: uniform(new Vector2()),
  plazaBelow: uniform(4),
  ringRadii: uniform(new Vector4(-1, -1, -1, -1)),
  rimBeyond: uniform(12),
  edges: uniform(new Vector4(-43, 43, -37, 37)),
  edgeFade: uniform(8),
};

export function writeDeepFloorZones(bounds: { plazaBelow: number; ringRadii: number[]; rimBeyond: number }): void {
  const [first, second, third, fourth, ...beyond] = bounds.ringRadii;
  if (beyond.length) throw new Error(`The floor draws four ring radii, not ${bounds.ringRadii.length}`);
  DEEP_FLOOR.plazaBelow.value = bounds.plazaBelow;
  DEEP_FLOOR.ringRadii.value.set(first ?? -1, second ?? -1, third ?? -1, fourth ?? -1);
  DEEP_FLOOR.rimBeyond.value = bounds.rimBeyond;
}

const ringRadii = () => [
  DEEP_FLOOR.ringRadii.x,
  DEEP_FLOOR.ringRadii.y,
  DEEP_FLOOR.ringRadii.z,
  DEEP_FLOOR.ringRadii.w,
];

const anyRing = (each: (radius: Node<"float">) => Node<"float">): Node<"float"> =>
  ringRadii()
    .map(each)
    .reduce((found, next) => found.max(next));

export function createDeepFloorMaterial(): MeshStandardNodeMaterial {
  const material = new MeshStandardNodeMaterial({ roughness: 0.78, metalness: 0 });
  material.name = "terrain-deep-floor";
  const hex = arenaHex(positionWorld.xz.sub(DEEP_FLOOR.center));
  const stone = dressedStone(hex);
  const inlay = ringInlays(hex);
  const top = smoothstep(0.5, 0.9, normalWorld.y);
  const inlaid = mix(stone, color(DEEP_PALETTE.ivory), inlay.mul(0.85));
  const ground = mix(stone.mul(0.55), inlaid, top);
  const air = layerFloorAir(positionWorld.xz, LAYER_DEPTHS.deep);
  const fade = air.sheets.add(air.haze.mul(0.85)).min(0.9).max(edgeFade(hex)).mul(top);
  material.colorNode = applyEndgameFrost(mix(ground, air.colour, fade).add(air.flash.mul(top)));
  const glow = ringGlow(hex);
  material.emissiveNode = color(DEEP_PALETTE.gold)
    .mul(inlay.mul(glow).mul(0.8).add(glow.mul(0.05)))
    .mul(top);
  return material;
}

type ArenaHex = {
  distance: Node<"float">;
  norm: Node<"float">;
  local: Node<"vec2">;
  offset: Node<"vec2">;
  q: Node<"float">;
  r: Node<"float">;
};

function arenaHex(offset: Node<"vec2">): ArenaHex {
  const q = offset.x.mul(SQRT3 / 3).sub(offset.y.mul(1 / 3));
  const r = offset.y.mul(2 / 3);
  const s = q.negate().sub(r);
  const roundQ = q.round();
  const roundR = r.round();
  const roundS = s.round();
  const missQ = roundQ.sub(q).abs();
  const missR = roundR.sub(r).abs();
  const missS = roundS.sub(s).abs();
  const fixQ = missQ.greaterThan(missR).and(missQ.greaterThan(missS));
  const fixR = fixQ.not().and(missR.greaterThan(missS));
  const cellQ = fixQ.select(roundR.negate().sub(roundS), roundQ);
  const cellR = fixR.select(roundQ.negate().sub(roundS), roundR);
  const center = vec2(cellQ.add(cellR.mul(0.5)).mul(SQRT3), cellR.mul(1.5));
  return {
    distance: max(cellQ.abs(), cellR.abs(), cellQ.add(cellR).abs()),
    norm: max(q.abs(), r.abs(), s.abs()),
    local: offset.sub(center),
    offset,
    q: cellQ,
    r: cellR,
  };
}

function dressedStone(hex: ArenaHex): Node<"vec3"> {
  const { local } = hex;
  const edge = max(local.x.abs(), local.dot(vec2(0.5, SQRT3 / 2)).abs(), local.dot(vec2(-0.5, SQRT3 / 2)).abs());
  const joint = smoothstep(0.035, 0.065, float(SQRT3 / 2).sub(edge));
  const face = atan(local.y, local.x)
    .add(Math.PI / 2)
    .div((2 * Math.PI) / 3)
    .floor();
  const seam = min(
    seamTo(local, vec2(0, 1)),
    min(seamTo(local, vec2(-SQRT3 / 2, -0.5)), seamTo(local, vec2(SQRT3 / 2, -0.5))),
  );
  const cut = smoothstep(0.012, 0.03, seam);
  const tone = cellHash(vec2(hex.q.add(face.mul(17)), hex.r.add(face.mul(5))), 0x9e3779b9);
  const grain = hex.offset.x
    .mul(9.7)
    .add(hex.offset.y.mul(3.1).sin().mul(1.3))
    .sin()
    .mul(hex.offset.y.mul(8.3).sin())
    .mul(0.04);
  const plaza = hex.distance.lessThan(DEEP_FLOOR.plazaBelow).select(float(1), float(0));
  const rim = smoothstep(DEEP_FLOOR.rimBeyond, DEEP_FLOOR.rimBeyond.add(3), hex.distance);
  const onRing = anyRing((radius) => hex.distance.equal(radius).select(float(1), float(0)));
  const field = mix(color(DEEP_PALETTE.slate), color(DEEP_PALETTE.cobalt), plaza.add(rim.mul(0.3)));
  const slab = mix(field, color(DEEP_PALETTE.ivory), onRing.mul(0.14));
  const lit = slab.mul(tone.mul(0.22).add(0.86).add(grain));
  return lit.mul(joint.mul(0.55).add(0.45)).mul(cut.mul(0.25).add(0.75));
}

function seamTo(local: Node<"vec2">, ray: Node<"vec2">): Node<"float"> {
  const along = local.dot(ray);
  const across = local.x.mul(ray.y).sub(local.y.mul(ray.x)).abs();
  return along.greaterThan(0).select(across, float(1));
}

function inlayLine(distance: Node<"float">, width: number): Node<"float"> {
  const pixel = fwidth(distance);
  const half = max(float(width / 2), pixel.mul(0.75));
  return smoothstep(half.add(pixel), half, distance.abs());
}

function ringInlays(hex: ArenaHex): Node<"float"> {
  const line = (radius: Node<"float">) => inlayLine(hex.norm.sub(radius), 0.03);
  return anyRing(line);
}

function ringGlow(hex: ArenaHex): Node<"float"> {
  const near = (radius: Node<"float">) => smoothstep(0.5, 0, hex.norm.sub(radius).abs());
  const rings = anyRing(near);
  const plaza = smoothstep(DEEP_FLOOR.plazaBelow.add(0.5), DEEP_FLOOR.plazaBelow.sub(0.5), hex.norm);
  return max(rings, plaza.mul(0.8));
}

function edgeFade(hex: ArenaHex): Node<"float"> {
  const { edges } = DEEP_FLOOR;
  const inside = hex.offset.x
    .sub(edges.x)
    .min(edges.y.sub(hex.offset.x))
    .min(hex.offset.y.sub(edges.z))
    .min(edges.w.sub(hex.offset.y));
  return smoothstep(DEEP_FLOOR.edgeFade.max(0.05), 0, inside);
}
