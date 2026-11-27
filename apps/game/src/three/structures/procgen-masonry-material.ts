import type { Material } from "three";
import type Node from "three/src/nodes/core/Node.js";
import type NodeBuilder from "three/src/nodes/core/NodeBuilder.js";
import MeshStandardNodeMaterial from "three/src/materials/nodes/MeshStandardNodeMaterial.js";
import {
  bumpMap,
  clamp,
  diffuseColor,
  dot,
  float,
  materialMetalness,
  materialRoughness,
  max,
  min,
  mix,
  mx_noise_float,
  normalView,
  normalWorld,
  positionGeometry,
  positionViewDirection,
  positionWorld,
  pow,
  property,
  smoothstep,
  vec3,
} from "three/tsl";
import { applyEndgameFrost } from "../effects/endgame/field";
import { FrostedStandardNodeMaterial } from "../effects/game-map-material-library";

const PROCGEN_MASONRY_KEY = "eternum-procgen-masonry-v1";
const PROCGEN_MASONRY_FLAG = "procgenMasonryMaterial";
const STONE_ROUGHNESS = 0.84;
const STONE_METALNESS = 0.05;
const METAL_ROUGHNESS = 0.32;
const METAL_METALNESS = 0.72;
const LUMA_WEIGHTS = vec3(0.2126, 0.7152, 0.0722);
const RIM_TINT = vec3(0.95, 0.91, 0.84);
const masonryMetalMask = property("float", "procgenMetalMask", float(0));

interface SharedMasonryNodes {
  macroGrain: Node<"float">;
  microGrain: Node<"float">;
  topMask: Node<"float">;
}

class ProcgenMasonryNodeMaterial extends FrostedStandardNodeMaterial {
  private readonly sharedNodes: SharedMasonryNodes;

  constructor() {
    super();
    this.name = "Procgen masonry";
    this.vertexColors = true;
    this.roughness = STONE_ROUGHNESS;
    this.metalness = STONE_METALNESS;
    this.flatShading = false;
    this.userData[PROCGEN_MASONRY_FLAG] = true;
    this.sharedNodes = createSharedMasonryNodes();
    this.normalNode = bumpMap(this.sharedNodes.microGrain, float(0.011));
    this.roughnessNode = buildMasonryRoughness(this.sharedNodes, masonryMetalMask);
    this.metalnessNode = buildMasonryMetalness(masonryMetalMask);
  }

  override customProgramCacheKey(): string {
    return PROCGEN_MASONRY_KEY;
  }

  override setupDiffuseColor(builder: NodeBuilder): void {
    MeshStandardNodeMaterial.prototype.setupDiffuseColor.call(this, builder);
    masonryMetalMask.assign(computeMetalMask(diffuseColor.rgb));
    const weathered = applyMasonryWeathering(diffuseColor.rgb, this.sharedNodes, masonryMetalMask);
    diffuseColor.rgb.assign(applyEndgameFrost(weathered));
  }
}

export function isProcgenMasonryMaterial(material: Material | null | undefined): boolean {
  return Boolean(material?.userData?.[PROCGEN_MASONRY_FLAG]);
}

export function createProcgenMasonryMaterial(): FrostedStandardNodeMaterial {
  return new ProcgenMasonryNodeMaterial();
}

function createSharedMasonryNodes(): SharedMasonryNodes {
  const sheared = vec3(
    positionWorld.x.add(positionWorld.y.mul(0.24)),
    positionWorld.y.mul(1.35),
    positionWorld.z.sub(positionWorld.y.mul(0.19)),
  );
  return {
    macroGrain: mx_noise_float(sheared.mul(2.1)),
    microGrain: mx_noise_float(sheared.mul(10.5)),
    topMask: smoothstep(0.55, 0.95, normalWorld.y),
  };
}

function computeMetalMask(baseRgb: Node<"vec3">): Node<"float"> {
  const luma = dot(baseRgb, LUMA_WEIGHTS);
  const hi = max(baseRgb.r, max(baseRgb.g, baseRgb.b));
  const lo = min(baseRgb.r, min(baseRgb.g, baseRgb.b));
  const sat = hi.sub(lo).div(max(hi, float(0.0001)));
  const warmMetal = smoothstep(0.16, 0.34, luma)
    .mul(smoothstep(0.24, 0.42, sat))
    .mul(smoothstep(0.12, 0.26, baseRgb.r.sub(baseRgb.b)))
    .mul(smoothstep(0.05, 0.16, baseRgb.g.sub(baseRgb.b)));
  const coolMetal = smoothstep(0.34, 0.52, luma)
    .mul(smoothstep(0.1, 0.2, sat).oneMinus())
    .mul(smoothstep(0.008, 0.035, baseRgb.b.sub(baseRgb.r)));
  return clamp(max(warmMetal, coolMetal), float(0), float(1));
}

function applyMasonryWeathering(
  baseRgb: Node<"vec3">,
  shared: SharedMasonryNodes,
  metalMask: Node<"float">,
): Node<"vec3"> {
  const grainDelta = shared.macroGrain.mul(0.09).add(shared.microGrain.mul(0.045));
  const stoneMod = float(1).add(grainDelta.mul(metalMask.oneMinus()));
  const baseContact = mix(float(0.81), float(1), smoothstep(0.0, 0.34, positionGeometry.y));
  const topLight = float(1).add(shared.topMask.mul(0.05));
  const grounded = baseRgb.mul(stoneMod).mul(baseContact).mul(topLight);
  const fresnel = pow(normalView.dot(positionViewDirection).abs().clamp(0, 1).oneMinus(), float(3.2));
  const rimStrength = mix(float(0.045), float(0.13), metalMask);
  return grounded.add(RIM_TINT.mul(fresnel).mul(rimStrength));
}

function buildMasonryRoughness(shared: SharedMasonryNodes, metalMask: Node<"float">): Node<"float"> {
  const stoneRoughness = clamp(
    materialRoughness.add(shared.macroGrain.mul(0.08)).add(shared.microGrain.mul(0.05)).sub(shared.topMask.mul(0.05)),
    float(0.04),
    float(0.98),
  );
  const metalRoughness = clamp(float(METAL_ROUGHNESS).add(shared.microGrain.mul(0.06)), float(0.24), float(0.42));
  return mix(stoneRoughness, metalRoughness, metalMask);
}

function buildMasonryMetalness(metalMask: Node<"float">): Node<"float"> {
  return mix(materialMetalness, float(METAL_METALNESS), metalMask);
}
