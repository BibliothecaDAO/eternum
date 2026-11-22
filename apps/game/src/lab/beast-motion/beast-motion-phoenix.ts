import type Node from "three/src/nodes/core/Node.js";
import {
  AdditiveBlending,
  Box3,
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  InstancedMesh,
  MeshStandardMaterial,
} from "three";
import { MeshBasicNodeMaterial } from "three/webgpu";
import {
  abs,
  color,
  cos,
  float,
  instanceIndex,
  mix,
  mx_noise_float,
  normalView,
  positionGeometry,
  positionLocal,
  positionViewDirection,
  select,
  sin,
  smoothstep,
  uniform,
  uv,
  vec3,
  attribute,
} from "three/tsl";
import brandPalette from "@/brand/palette.json";
import { FrostedStandardNodeMaterial } from "@/three/effects/game-map-material-library";
import { DEEP_PALETTE } from "@/three/terrain/deep-floor-material";
import {
  BEAST_MOTION_CYCLE_SECONDS,
  BEAST_MOTION_HEX_STRIDE,
  type BeastMotionLayer,
} from "./beast-motion-model";

type LayerRamp = {
  readonly low: string;
  readonly mid: string;
  readonly hot: string;
  readonly rim: number;
  readonly embers: number;
};

const MIST_MATERIAL = brandPalette.games.frontier.materials[1];

const BEAST_PHOENIX_LAYER_RAMPS = {
  0: { low: "#7a4c28", mid: "#d9924c", hot: "#fff1d0", rim: 0.22, embers: 0.18 },
  1: { low: "#1a5c72", mid: "#5fd2e6", hot: "#e8fdff", rim: 0.9, embers: 0.55 },
  2: { low: MIST_MATERIAL.shade.hex, mid: MIST_MATERIAL.light.hex, hot: "#f5ebff", rim: 1.05, embers: 0.72 },
  3: { low: "#8f5414", mid: DEEP_PALETTE.gold, hot: "#fff6d6", rim: 1.15, embers: 0.82 },
} as const satisfies Record<BeastMotionLayer, LayerRamp>;

const EMBER_QUADS_PER_BEAST = 10;
const TAU = Math.PI * 2;

export function createBeastShaderUniforms() {
  return {
    time: uniform(0),
    actionIndex: uniform(0),
    layer: uniform(2),
    phoenixEnabled: uniform(1),
    phaseSpread: uniform(0),
  };
}

export type BeastShaderUniforms = ReturnType<typeof createBeastShaderUniforms>;

function selectLayerNumber(layerNode: Node<"float">, values: Record<BeastMotionLayer, number>) {
  return select(
    layerNode.greaterThan(2.5),
    float(values[3]),
    select(
      layerNode.greaterThan(1.5),
      float(values[2]),
      select(layerNode.greaterThan(0.5), float(values[1]), float(values[0])),
    ),
  );
}

function layerColour(layerNode: Node<"float">, stop: "low" | "mid" | "hot") {
  return select(
    layerNode.greaterThan(2.5),
    color(new Color(BEAST_PHOENIX_LAYER_RAMPS[3][stop])),
    select(
      layerNode.greaterThan(1.5),
      color(new Color(BEAST_PHOENIX_LAYER_RAMPS[2][stop])),
      select(
        layerNode.greaterThan(0.5),
        color(new Color(BEAST_PHOENIX_LAYER_RAMPS[1][stop])),
        color(new Color(BEAST_PHOENIX_LAYER_RAMPS[0][stop])),
      ),
    ),
  );
}

function createPhoenixGlowNode(uniforms: BeastShaderUniforms, phaseOffset: Node<"float">) {
  const layerNode = float(uniforms.layer);
  const rim = normalView.dot(positionViewDirection).abs().clamp(0, 1).oneMinus().pow(2.4);
  const flameSample = vec3(
    positionGeometry.x.mul(5.2),
    positionGeometry.y.mul(4.2).sub(uniforms.time.mul(1.75)).add(phaseOffset),
    positionGeometry.z.mul(5.2),
  );
  const scrollNoise = mx_noise_float(flameSample).mul(0.5).add(0.5);
  const upper = smoothstep(0.05, 0.55, positionGeometry.y);
  const heat = rim.mul(scrollNoise.mul(0.55).add(0.55)).add(scrollNoise.mul(upper).mul(0.22)).clamp(0, 1);
  const lowToMid = mix(layerColour(layerNode, "low"), layerColour(layerNode, "mid"), smoothstep(0.08, 0.65, heat));
  const ramped = mix(lowToMid, layerColour(layerNode, "hot"), smoothstep(0.65, 0.98, heat));
  const strength = selectLayerNumber(layerNode, {
    0: BEAST_PHOENIX_LAYER_RAMPS[0].rim,
    1: BEAST_PHOENIX_LAYER_RAMPS[1].rim,
    2: BEAST_PHOENIX_LAYER_RAMPS[2].rim,
    3: BEAST_PHOENIX_LAYER_RAMPS[3].rim,
  });
  return ramped.mul(heat).mul(strength).mul(uniforms.phoenixEnabled);
}

function copyStandardProps(target: FrostedStandardNodeMaterial, source: MeshStandardMaterial) {
  target.color.copy(source.color);
  target.map = source.map;
  target.normalMap = source.normalMap;
  target.normalScale.copy(source.normalScale);
  target.roughness = source.roughness;
  target.metalness = source.metalness;
  target.side = source.side;
}

export function createPureMathsBeastMaterial(
  source: MeshStandardMaterial,
  uniforms: BeastShaderUniforms,
): FrostedStandardNodeMaterial {
  const material = new FrostedStandardNodeMaterial();
  copyStandardProps(material, source);

  const phaseOffset = float(instanceIndex).mul(2.399963).mul(float(uniforms.phaseSpread));
  const cycle = uniforms.time.add(phaseOffset).div(BEAST_MOTION_CYCLE_SECONDS).fract();
  const phase = cycle.mul(TAU);

  const gx = positionGeometry.x;
  const gy = positionGeometry.y;
  const gz = positionGeometry.z;
  const absX = abs(gx);

  const planted = smoothstep(0.06, 0.28, gy);
  const wingMask = smoothstep(0.16, 0.32, absX).mul(smoothstep(0.22, 0.42, gy)).mul(smoothstep(0.18, 0.02, gz));
  const wingSpan = absX.sub(0.14).max(0);
  const wingSide = select(gx.lessThan(0), float(-1), float(1));
  const neckHeadMask = smoothstep(0.46, 0.84, gy).mul(smoothstep(0.24, 0.1, absX)).mul(wingMask.oneMinus());
  const tailMask = smoothstep(-0.14, -0.26, gz).mul(smoothstep(0.44, 0.22, gy)).mul(wingMask.oneMinus());
  const legZone = smoothstep(0.36, 0.16, gy).mul(smoothstep(-0.18, -0.05, gz)).mul(wingMask.oneMinus());
  const leftLegMask = legZone.mul(smoothstep(-0.04, -0.14, gx));
  const rightLegMask = legZone.mul(smoothstep(0.04, 0.14, gx));
  const torsoMask = smoothstep(0.24, 0.56, gy).mul(smoothstep(0.74, 0.52, gy)).mul(wingMask.oneMinus());

  const breath = sin(phase.mul(2)).mul(0.5).add(0.5);
  const weightShift = sin(phase);
  const headSwayX = sin(phase.add(0.6)).mul(0.07).add(sin(phase.mul(2).add(1.1)).mul(0.035));
  const headNodY = sin(phase.mul(2).sub(0.5)).mul(0.03);
  const tailWhipX = sin(phase.mul(2).sub(1.2)).mul(0.11).add(sin(phase.mul(3).add(0.4)).mul(0.035));
  const wingBeat = sin(phase.mul(2).add(0.3));
  const livingNoise = mx_noise_float(vec3(gx.mul(3.5), gy.mul(3.5), uniforms.time.mul(1.4).add(phaseOffset))).mul(0.012);

  const idleDx = weightShift
    .mul(0.045)
    .mul(planted)
    .add(headSwayX.mul(neckHeadMask))
    .add(tailWhipX.mul(tailMask))
    .add(gx.mul(breath.mul(0.08)).mul(torsoMask))
    .add(wingSide.mul(wingBeat.mul(-0.06)).mul(wingSpan).mul(wingMask))
    .add(livingNoise.mul(planted));
  const idleDy = breath
    .mul(0.045)
    .mul(planted)
    .add(headNodY.mul(neckHeadMask))
    .add(wingBeat.mul(0.34).mul(wingSpan).mul(wingMask));
  const idleDz = breath
    .mul(0.03)
    .mul(torsoMask)
    .add(wingBeat.mul(0.14).mul(wingSpan).mul(wingMask))
    .add(sin(phase).mul(0.035).mul(neckHeadMask));

  const walkPhase = phase.mul(2);
  const walkStride = sin(phase).mul(BEAST_MOTION_HEX_STRIDE * 0.5);
  const walkBob = abs(sin(walkPhase)).mul(0.055);
  const leftStepZ = sin(walkPhase).mul(0.14);
  const leftStepY = cos(walkPhase).max(0).mul(0.09);
  const rightStepZ = sin(walkPhase).mul(-0.14);
  const rightStepY = cos(walkPhase).negate().max(0).mul(0.09);
  const walkDx = idleDx.add(sin(walkPhase).mul(0.045).mul(planted));
  const walkDy = idleDy
    .add(walkBob.mul(planted))
    .add(leftStepY.mul(leftLegMask))
    .add(rightStepY.mul(rightLegMask))
    .add(sin(walkPhase).mul(0.24).mul(wingSpan).mul(wingMask));
  const walkDz = idleDz
    .add(walkStride)
    .add(leftStepZ.mul(leftLegMask))
    .add(rightStepZ.mul(rightLegMask));

  const coilUp = smoothstep(0.0, 0.26, cycle).mul(smoothstep(0.44, 0.26, cycle));
  const lungeIn = smoothstep(0.26, 0.44, cycle);
  const lungeOut = smoothstep(0.92, 0.56, cycle);
  const lunge = lungeIn.mul(lungeOut);
  const attackPitch = lunge.mul(0.58).sub(coilUp.mul(0.32)).mul(planted);
  const cosA = cos(attackPitch);
  const sinA = sin(attackPitch);
  const aRelY = gy.sub(0.32);
  const aRelZ = gz;
  const aRotY = aRelY.mul(cosA).sub(aRelZ.mul(sinA)).add(0.32);
  const aRotZ = aRelY.mul(sinA).add(aRelZ.mul(cosA));
  const attackDx = idleDx
    .mul(0.35)
    .add(wingSide.mul(coilUp.mul(0.24).sub(lunge.mul(0.2))).mul(wingSpan).mul(wingMask));
  const attackDy = aRotY
    .sub(gy)
    .add(coilUp.mul(0.35).sub(lunge.mul(0.25)).mul(wingSpan).mul(wingMask));
  const attackDz = aRotZ
    .sub(gz)
    .add(lunge.mul(0.38))
    .sub(coilUp.mul(0.16))
    .sub(lunge.mul(0.22).mul(wingMask));

  const flinch = smoothstep(0.0, 0.14, cycle).mul(smoothstep(0.55, 0.14, cycle));
  const tremor = sin(cycle.mul(TAU * 9)).mul(0.025).mul(flinch);
  const hitDx = tremor.mul(planted).add(wingSide.mul(flinch.mul(0.28)).mul(wingSpan).mul(wingMask));
  const hitDy = flinch.mul(0.12).mul(neckHeadMask).sub(flinch.mul(0.06).mul(torsoMask)).add(flinch.mul(0.32).mul(wingSpan).mul(wingMask));
  const hitDz = flinch.mul(-0.26).mul(planted).sub(flinch.mul(0.16).mul(neckHeadMask));

  const death = smoothstep(0.08, 0.56, cycle);
  const fallAngle = death.mul(1.48);
  const cosF = cos(fallAngle);
  const sinF = sin(fallAngle);
  const pivotY = float(0.18);
  const relY = gy.sub(pivotY);
  const rotX = gx.mul(cosF).sub(relY.mul(sinF));
  const rotY = gx.mul(sinF).add(relY.mul(cosF)).add(pivotY).sub(death.mul(0.12)).max(0.02);
  const deathDx = rotX.sub(gx);
  const deathDy = rotY.sub(gy);
  const deathDz = death.mul(0.08).mul(planted);

  const action = float(uniforms.actionIndex);
  const offset = select(
    action.greaterThan(3.5),
    vec3(deathDx, deathDy, deathDz),
    select(
      action.greaterThan(2.5),
      vec3(hitDx, hitDy, hitDz),
      select(
        action.greaterThan(1.5),
        vec3(attackDx, attackDy, attackDz),
        select(action.greaterThan(0.5), vec3(walkDx, walkDy, walkDz), vec3(idleDx, idleDy, idleDz)),
      ),
    ),
  );

  material.positionNode = positionLocal.add(offset);
  material.emissiveNode = createPhoenixGlowNode(uniforms, phaseOffset);
  return material;
}

export function createRigBeastMaterial(
  source: MeshStandardMaterial,
  uniforms: BeastShaderUniforms,
): FrostedStandardNodeMaterial {
  const material = new FrostedStandardNodeMaterial();
  copyStandardProps(material, source);
  material.emissiveNode = createPhoenixGlowNode(uniforms, float(0));
  return material;
}

export function createHybridBeastMaterial(
  source: MeshStandardMaterial,
  uniforms: BeastShaderUniforms,
): FrostedStandardNodeMaterial {
  const material = new FrostedStandardNodeMaterial();
  copyStandardProps(material, source);

  const phase = uniforms.time.div(BEAST_MOTION_CYCLE_SECONDS).fract().mul(TAU);
  const gx = positionGeometry.x;
  const gy = positionGeometry.y;
  const gz = positionGeometry.z;
  const absX = abs(gx);

  const planted = smoothstep(0.08, 0.3, gy);
  const wingTip = smoothstep(0.24, 0.44, absX).mul(smoothstep(0.26, 0.46, gy)).mul(smoothstep(0.16, 0.0, gz));
  const tailMask = smoothstep(-0.14, -0.26, gz).mul(smoothstep(0.42, 0.22, gy));
  const chestMask = smoothstep(0.26, 0.54, gy).mul(smoothstep(0.72, 0.5, gy)).mul(smoothstep(0.26, 0.12, absX));

  const alive = select(float(uniforms.actionIndex).greaterThan(3.5), smoothstep(0.5, 0.08, uniforms.time.div(BEAST_MOTION_CYCLE_SECONDS).fract()), float(1));
  const breath = sin(phase.mul(2)).mul(0.5).add(0.5);
  const wingFlutter = sin(phase.mul(2).add(0.3).add(absX.mul(4.5)));
  const tailWave = sin(phase.mul(2).sub(1.2).add(gz.mul(6))).mul(0.11);
  const noise = mx_noise_float(vec3(gx.mul(4), gy.mul(4), uniforms.time.mul(1.6))).mul(0.01);

  const secDx = gx.mul(breath.mul(0.075)).mul(chestMask).add(tailWave.mul(tailMask)).add(noise.mul(planted)).mul(alive);
  const secDy = breath.mul(0.032).mul(planted).add(wingFlutter.mul(0.16).mul(wingTip)).mul(alive);
  const secDz = breath.mul(0.025).mul(chestMask).add(wingFlutter.mul(0.08).mul(wingTip)).mul(alive);

  material.positionNode = positionLocal.add(vec3(secDx, secDy, secDz));
  material.emissiveNode = createPhoenixGlowNode(uniforms, float(0));
  return material;
}

export function createSharedEmberPool(
  bounds: Box3,
  capacity: number,
  uniforms: BeastShaderUniforms,
): InstancedMesh {
  const top = Math.max(0.45, bounds.isEmpty() ? 0.85 : bounds.max.y);
  const span = Math.max(
    0.24,
    bounds.isEmpty() ? 0.35 : Math.max(bounds.max.x - bounds.min.x, bounds.max.z - bounds.min.z) * 0.48,
  );
  const points: number[] = [];
  const coords: number[] = [];
  const seeds: number[] = [];
  const lifts: number[] = [];
  const indices: number[] = [];

  for (let index = 0; index < EMBER_QUADS_PER_BEAST; index++) {
    const angle = index * 2.399963;
    const radius = span * (0.45 + 0.55 * ((index * 0.754877666) % 1));
    const size = index % 3 === 0 ? 0.048 : 0.032;
    const baseY = 0.1 + (index % 4) * (top * 0.12);
    const start = points.length / 3;
    for (const [x, y, u, v] of [
      [-1, -1, 0, 0],
      [1, -1, 1, 0],
      [-1, 1, 0, 1],
      [1, 1, 1, 1],
    ]) {
      points.push(
        Math.cos(angle) * radius + (index % 2 === 0 ? x * size : 0),
        baseY + y * size * 1.35,
        Math.sin(angle) * radius + (index % 2 === 1 ? x * size : 0),
      );
      coords.push(u, v);
      seeds.push((index * 0.61803398875) % 1);
      lifts.push(top * 0.55 + 0.28);
    }
    indices.push(start, start + 1, start + 2, start + 1, start + 3, start + 2);
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(points, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(coords, 2));
  geometry.setAttribute("emberSeed", new Float32BufferAttribute(seeds, 1));
  geometry.setAttribute("emberLift", new Float32BufferAttribute(lifts, 1));
  geometry.setIndex(indices);

  const material = new MeshBasicNodeMaterial({
    transparent: true,
    depthTest: true,
    depthWrite: false,
    side: DoubleSide,
    forceSinglePass: true,
    blending: AdditiveBlending,
    toneMapped: false,
  });

  const layerNode = float(uniforms.layer);
  const seed = attribute<"float">("emberSeed", "float");
  const lift = attribute<"float">("emberLift", "float");
  const phase = float(instanceIndex).mul(2.399963);
  const age = uniforms.time.mul(0.32).add(seed).add(phase.mul(0.17)).fract();
  const sway = age.mul(TAU).add(seed.mul(12.5)).sin().mul(0.045);
  material.positionNode = positionLocal.add(vec3(sway, age.mul(lift), sway.mul(0.65)));

  const edge = uv().sub(0.5).length().mul(2).oneMinus().clamp(0, 1).pow(2);
  const strength = selectLayerNumber(layerNode, {
    0: BEAST_PHOENIX_LAYER_RAMPS[0].embers,
    1: BEAST_PHOENIX_LAYER_RAMPS[1].embers,
    2: BEAST_PHOENIX_LAYER_RAMPS[2].embers,
    3: BEAST_PHOENIX_LAYER_RAMPS[3].embers,
  });
  material.colorNode = mix(layerColour(layerNode, "mid"), layerColour(layerNode, "hot"), age.oneMinus());
  material.opacityNode = edge.mul(age.mul(Math.PI).sin()).mul(strength).mul(uniforms.phoenixEnabled);

  const mesh = new InstancedMesh(geometry, material, Math.max(1, capacity));
  mesh.name = "Beast motion phoenix embers";
  mesh.frustumCulled = false;
  mesh.castShadow = false;
  mesh.raycast = () => {};
  mesh.renderOrder = 11;
  return mesh;
}
