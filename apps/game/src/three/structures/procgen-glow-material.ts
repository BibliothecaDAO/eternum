import type { AspectId } from "@bibliothecadao/types";
import { Color } from "three";
import type Node from "three/src/nodes/core/Node.js";
import {
  abs,
  clamp,
  float,
  hash,
  instanceIndex,
  materialReference,
  mix,
  mx_noise_float,
  normalView,
  positionGeometry,
  positionViewDirection,
  positionWorld,
  pow,
  sin,
  smoothstep,
  varying,
  vec3,
} from "three/tsl";
import { applyEndgameFrost } from "../effects/endgame/field";
import { mapAnimationTime } from "../effects/endgame/state";
import { FrostedStandardNodeMaterial } from "../effects/game-map-material-library";

const PROCGEN_GLOW_KEY = "eternum-procgen-glow-v1";
const TAU = 6.2831853;

interface ProcgenGlowStyle {
  readonly pulseSpeed: number;
  readonly pulseDepth: number;
  readonly fissureWeight: number;
  readonly fissureHotColor: string;
  readonly foldLightWeight: number;
}

export interface ProcgenGlowOptions extends ProcgenGlowStyle {
  readonly emissive: string;
  readonly emissiveIntensity: number;
  readonly color?: string;
  readonly roughness?: number;
  readonly metalness?: number;
}

export const PROCGEN_ASPECT_GLOW_STYLES = {
  1: {
    pulseSpeed: 0.9,
    pulseDepth: 0.16,
    fissureWeight: 0.28,
    fissureHotColor: "#ffe2b0",
    foldLightWeight: 0.2,
  },
  2: {
    pulseSpeed: 0.65,
    pulseDepth: 0.14,
    fissureWeight: 0.14,
    fissureHotColor: "#f4ffff",
    foldLightWeight: 0.62,
  },
  3: {
    pulseSpeed: 1.25,
    pulseDepth: 0.24,
    fissureWeight: 0.85,
    fissureHotColor: "#fff0b8",
    foldLightWeight: 0.16,
  },
  4: {
    pulseSpeed: 0.85,
    pulseDepth: 0.18,
    fissureWeight: 0.56,
    fissureHotColor: "#d6f7ff",
    foldLightWeight: 0.46,
  },
} as const satisfies Record<AspectId, ProcgenGlowStyle>;

export const HYPERSTRUCTURE_CHANNEL_GLOW: ProcgenGlowOptions = {
  color: "#71c6bd",
  emissive: "#258d87",
  emissiveIntensity: 1.55,
  pulseSpeed: 0.8,
  pulseDepth: 0.2,
  fissureWeight: 0.36,
  fissureHotColor: "#c8fff8",
  foldLightWeight: 0.52,
  roughness: 0.36,
  metalness: 0.25,
};

let sharedGlowEmissiveNode: Node<"vec3"> | null = null;

function getSharedGlowEmissiveNode(): Node<"vec3"> {
  if (!sharedGlowEmissiveNode) {
    sharedGlowEmissiveNode = applyEndgameFrost(buildGlowEmissiveNode());
  }
  return sharedGlowEmissiveNode;
}

class ProcgenGlowNodeMaterial extends FrostedStandardNodeMaterial {
  glowPulseSpeed: number;
  glowPulseDepth: number;
  glowFissureWeight: number;
  glowFissureHotColor: Color;
  glowFoldLightWeight: number;

  constructor(options: ProcgenGlowOptions) {
    super();
    this.name = "Procgen glow";
    this.vertexColors = true;
    if (options.color) this.color.set(options.color);
    this.emissive.set(options.emissive);
    this.emissiveIntensity = options.emissiveIntensity;
    this.glowPulseSpeed = options.pulseSpeed;
    this.glowPulseDepth = options.pulseDepth;
    this.glowFissureWeight = options.fissureWeight;
    this.glowFissureHotColor = new Color(options.fissureHotColor);
    this.glowFoldLightWeight = options.foldLightWeight;
    this.roughness = options.roughness ?? 0.22;
    this.metalness = options.metalness ?? 0.2;
    this.flatShading = false;
    this.emissiveNode = getSharedGlowEmissiveNode();
  }

  override customProgramCacheKey(): string {
    return PROCGEN_GLOW_KEY;
  }
}

export function createProcgenGlowMaterial(options: ProcgenGlowOptions): FrostedStandardNodeMaterial {
  return new ProcgenGlowNodeMaterial(options);
}

function glowFloatRef(property: string): Node<"float"> {
  return materialReference(property, "float") as unknown as Node<"float">;
}

function glowColorRef(property: string): Node<"vec3"> {
  return materialReference(property, "color") as unknown as Node<"vec3">;
}

function buildGlowEmissiveNode(): Node<"vec3"> {
  const emissiveColor = glowColorRef("emissive");
  const emissiveStrength = glowFloatRef("emissiveIntensity");
  const pulseSpeed = glowFloatRef("glowPulseSpeed");
  const pulseDepth = glowFloatRef("glowPulseDepth");
  const fissureWeight = glowFloatRef("glowFissureWeight");
  const fissureHotColor = glowColorRef("glowFissureHotColor");
  const foldLightWeight = glowFloatRef("glowFoldLightWeight");

  const instancePhase = varying(hash(instanceIndex).mul(TAU), "vProcgenGlowPhase");
  const clock = mapAnimationTime.mul(pulseSpeed).add(instancePhase);

  const waveCoord = positionWorld.y
    .mul(3.4)
    .sub(clock.mul(2.1))
    .add(positionWorld.x.mul(0.85))
    .add(positionWorld.z.mul(0.85));
  const colonyWave = sin(waveCoord).mul(0.5).add(0.5);
  const pulseFactor = float(1).add(colonyWave.sub(0.5).mul(2).mul(pulseDepth));

  const fissureSample = abs(mx_noise_float(positionWorld.mul(4.5).add(vec3(0, clock.mul(0.45), 0))));
  const fissureCrack = smoothstep(0.06, 0.28, fissureSample).oneMinus();
  const fissureHot = smoothstep(0.02, 0.12, fissureSample).oneMinus();
  const heatColor = mix(
    emissiveColor,
    mix(emissiveColor.mul(1.55), fissureHotColor, fissureHot),
    fissureCrack.mul(fissureWeight),
  );

  const ndv = clamp(abs(normalView.dot(positionViewDirection)), float(0), float(1));
  const fresnel = pow(ndv.oneMinus(), float(2.4));
  const foldHarmonic = sin(clock.mul(1.3).add(positionGeometry.y.mul(5.2)))
    .mul(0.42)
    .add(0.58);
  const foldSheen = fissureHotColor.mul(fresnel).mul(foldHarmonic).mul(foldLightWeight).mul(0.65);

  return heatColor.mul(emissiveStrength).mul(pulseFactor).add(foldSheen);
}
