import type Node from "three/src/nodes/core/Node.js";
import { Box3, InstancedMesh, MeshStandardMaterial } from "three";
import {
  abs,
  color,
  cos,
  float,
  instanceIndex,
  mx_noise_float,
  positionGeometry,
  positionLocal,
  select,
  sin,
  smoothstep,
  texture,
  uniform,
  vec3,
} from "three/tsl";
import { FrostedStandardNodeMaterial } from "@/three/effects/game-map-material-library";
import { createTripoModelMaterial } from "@/three/materials/tripo-model-material";
import {
  createBeastEmberGeometry,
  createBeastEmberMaterial,
  createBeastPhoenixGlow,
} from "@/three/structures/frontier-model";
import { BEAST_MOTION_CYCLE_SECONDS, BEAST_MOTION_HEX_STRIDE } from "./beast-motion-model";

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

function buildBaseBeastMaterial(
  source: MeshStandardMaterial,
  uniforms: BeastShaderUniforms,
  phaseOffset: Node<"float">,
): FrostedStandardNodeMaterial {
  const material = createTripoModelMaterial(source);
  const phoenix = createBeastPhoenixGlow(float(uniforms.layer), phaseOffset, float(uniforms.time)).mul(
    float(uniforms.phoenixEnabled),
  );
  const authoredGlow = material.emissiveMap
    ? texture(material.emissiveMap).rgb.mul(color(material.emissive)).mul(material.emissiveIntensity)
    : color(material.emissive).mul(material.emissiveIntensity);
  material.emissiveNode = material.emissiveIntensity > 0 ? phoenix.add(authoredGlow) : phoenix;
  return material;
}

export function createPureMathsBeastMaterial(
  source: MeshStandardMaterial,
  uniforms: BeastShaderUniforms,
): FrostedStandardNodeMaterial {
  const phaseOffset = float(instanceIndex).mul(2.399963).mul(float(uniforms.phaseSpread));
  const material = buildBaseBeastMaterial(source, uniforms, phaseOffset);

  const cycle = float(uniforms.time).add(phaseOffset).div(BEAST_MOTION_CYCLE_SECONDS).fract();
  const phase = cycle.mul(TAU);

  const gx = positionGeometry.x;
  const gy = positionGeometry.y;
  const gz = positionGeometry.z;
  const absX = abs(gx);

  const planted = smoothstep(0.06, 0.28, gy);
  const wingMask = smoothstep(0.14, 0.28, absX)
    .mul(smoothstep(0.22, 0.42, gy))
    .mul(smoothstep(0.2, 0.02, gz));
  const wingSpan = absX.sub(0.12).max(0);
  const wingSide = select(gx.lessThan(0), float(-1), float(1));
  const neckHeadMask = smoothstep(0.42, 0.78, gy)
    .mul(smoothstep(0.22, 0.1, absX))
    .mul(wingMask.oneMinus());
  const tailMask = smoothstep(-0.14, -0.26, gz)
    .mul(smoothstep(0.44, 0.22, gy))
    .mul(wingMask.oneMinus());
  const legZone = smoothstep(0.34, 0.14, gy)
    .mul(smoothstep(-0.18, -0.04, gz))
    .mul(wingMask.oneMinus());
  const leftLegMask = legZone.mul(smoothstep(-0.04, -0.14, gx));
  const rightLegMask = legZone.mul(smoothstep(0.04, 0.14, gx));
  const torsoMask = smoothstep(0.22, 0.54, gy)
    .mul(smoothstep(0.72, 0.48, gy))
    .mul(wingMask.oneMinus());

  const breath = sin(phase.mul(2)).mul(0.5).add(0.5);
  const weightShift = sin(phase);
  const headSwayX = sin(phase.add(0.6))
    .mul(0.07)
    .add(sin(phase.mul(2).add(1.1)).mul(0.035));
  const headNodY = sin(phase.mul(2).sub(0.5)).mul(0.03);
  const tailWhipX = sin(phase.mul(2).sub(1.2))
    .mul(0.12)
    .add(sin(phase.mul(3).add(0.4)).mul(0.04));
  const wingBeat = sin(phase.mul(2).add(0.3));
  const livingNoise = mx_noise_float(
    vec3(gx.mul(3.5), gy.mul(3.5), float(uniforms.time).mul(1.4).add(phaseOffset)),
  ).mul(0.012);

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
    .add(wingBeat.mul(0.36).mul(wingSpan).mul(wingMask));
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
  const walkDz = idleDz.add(walkStride).add(leftStepZ.mul(leftLegMask)).add(rightStepZ.mul(rightLegMask));

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
  const attackDx = idleDx.mul(0.35).add(
    wingSide
      .mul(coilUp.mul(0.24).sub(lunge.mul(0.2)))
      .mul(wingSpan)
      .mul(wingMask),
  );
  const attackDy = aRotY.sub(gy).add(coilUp.mul(0.35).sub(lunge.mul(0.25)).mul(wingSpan).mul(wingMask));
  const attackDz = aRotZ.sub(gz).add(lunge.mul(0.38)).sub(coilUp.mul(0.16)).sub(lunge.mul(0.22).mul(wingMask));

  const flinch = smoothstep(0.0, 0.14, cycle).mul(smoothstep(0.55, 0.14, cycle));
  const tremor = sin(cycle.mul(TAU * 9))
    .mul(0.025)
    .mul(flinch);
  const hitDx = tremor.mul(planted).add(wingSide.mul(flinch.mul(0.28)).mul(wingSpan).mul(wingMask));
  const hitDy = flinch
    .mul(0.12)
    .mul(neckHeadMask)
    .sub(flinch.mul(0.06).mul(torsoMask))
    .add(flinch.mul(0.32).mul(wingSpan).mul(wingMask));
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
  return material;
}

export function createRigBeastMaterial(
  source: MeshStandardMaterial,
  uniforms: BeastShaderUniforms,
): FrostedStandardNodeMaterial {
  return buildBaseBeastMaterial(source, uniforms, float(0));
}

export function createHybridBeastMaterial(
  source: MeshStandardMaterial,
  uniforms: BeastShaderUniforms,
): FrostedStandardNodeMaterial {
  const material = buildBaseBeastMaterial(source, uniforms, float(0));

  const phase = float(uniforms.time).div(BEAST_MOTION_CYCLE_SECONDS).fract().mul(TAU);
  const gx = positionGeometry.x;
  const gy = positionGeometry.y;
  const gz = positionGeometry.z;
  const absX = abs(gx);

  const planted = smoothstep(0.08, 0.3, gy);
  const wingTip = smoothstep(0.2, 0.34, absX)
    .mul(smoothstep(0.24, 0.44, gy))
    .mul(smoothstep(0.18, 0.0, gz));
  const tailMask = smoothstep(-0.14, -0.26, gz).mul(smoothstep(0.42, 0.22, gy));
  const chestMask = smoothstep(0.24, 0.52, gy)
    .mul(smoothstep(0.7, 0.48, gy))
    .mul(smoothstep(0.24, 0.1, absX));

  const alive = select(
    float(uniforms.actionIndex).greaterThan(3.5),
    smoothstep(0.5, 0.08, float(uniforms.time).div(BEAST_MOTION_CYCLE_SECONDS).fract()),
    float(1),
  );
  const breath = sin(phase.mul(2)).mul(0.5).add(0.5);
  const wingFlutter = sin(phase.mul(2).add(0.3).add(absX.mul(4.5)));
  const tailWave = sin(phase.mul(2).sub(1.2).add(gz.mul(6))).mul(0.11);
  const noise = mx_noise_float(vec3(gx.mul(4), gy.mul(4), float(uniforms.time).mul(1.6))).mul(0.01);

  const secDx = gx.mul(breath.mul(0.075)).mul(chestMask).add(tailWave.mul(tailMask)).add(noise.mul(planted)).mul(alive);
  const secDy = breath.mul(0.032).mul(planted).add(wingFlutter.mul(0.16).mul(wingTip)).mul(alive);
  const secDz = breath.mul(0.025).mul(chestMask).add(wingFlutter.mul(0.08).mul(wingTip)).mul(alive);

  material.positionNode = positionLocal.add(vec3(secDx, secDy, secDz));
  return material;
}

export function createSharedEmberPool(bounds: Box3, capacity: number, uniforms: BeastShaderUniforms): InstancedMesh {
  const geometry = createBeastEmberGeometry(bounds);
  const material = createBeastEmberMaterial(
    float(uniforms.layer),
    float(uniforms.time),
    float(uniforms.phoenixEnabled),
  );
  const mesh = new InstancedMesh(geometry, material, Math.max(1, capacity));
  mesh.name = "Beast motion phoenix embers";
  mesh.frustumCulled = false;
  mesh.castShadow = false;
  mesh.raycast = () => {};
  mesh.renderOrder = 11;
  return mesh;
}
