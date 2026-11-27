import {
  Color,
  DataTexture,
  DoubleSide,
  RGBAFormat,
  SRGBColorSpace,
  UnsignedByteType,
  type MeshBasicMaterial,
  type MeshStandardMaterial,
  type Texture,
} from "three";
import MeshBasicNodeMaterial from "three/src/materials/nodes/MeshBasicNodeMaterial.js";
import type Node from "three/src/nodes/core/Node.js";
import { instanceColor } from "three/src/nodes/accessors/Instance.js";
import {
  attribute,
  color,
  float,
  max,
  min,
  mix,
  positionGeometry,
  sin,
  step,
  texture,
  uniform,
  uv,
  vec3,
  vec4,
} from "three/tsl";
import { applyEndgameFrost } from "../../effects/endgame/field";
import { mapAnimationTime } from "../../effects/endgame/state";
import { FrostedStandardNodeMaterial } from "../../effects/game-map-material-library";
import { SAIL_STRIPE_U } from "./ship-sail-print";

export const SHIP_WORLD_SCALE = 0.3;

export const SHIP_CLOTH_PARAMS = {
  cycleSeconds: 6,
  sailIdlePressure: 0.17,
  sailSailingPressure: 0.32,
  sailWorldSailing: 0.5,
  sailGustBase: 0.6,
  sailGustAmp: 0.4,
  sailGustPhaseMul: 2,
  sailGustZFreq: 1.7,
  sailRipplePhaseMul: 4,
  sailRippleVFreq: 7,
  sailRippleXFreq: 4,
  sailRippleWeight: 0.35,
  pennantWaveAPhaseMul: 4,
  pennantWaveAFreq: 9,
  pennantWaveAAmp: 0.2,
  pennantWaveBPhaseMul: 7,
  pennantWaveBFreq: 14,
  pennantWaveBAmp: 0.055,
} as const;

let cachedIvoryFallback: DataTexture | null = null;

function getIvoryFallbackTexture(): DataTexture {
  if (!cachedIvoryFallback) {
    const data = new Uint8Array([229, 215, 184, 255]);
    const fallback = new DataTexture(data, 1, 1, RGBAFormat, UnsignedByteType);
    fallback.colorSpace = SRGBColorSpace;
    fallback.needsUpdate = true;
    cachedIvoryFallback = fallback;
  }
  return cachedIvoryFallback;
}

function createScalarUniform(initial: number) {
  return uniform(initial);
}

function createColorUniform(hex: string) {
  return uniform(new Color(hex));
}

function createPrintTextureNode(tex: Texture) {
  return texture(tex);
}

export interface ShipClothUniforms {
  readonly phase: ReturnType<typeof createScalarUniform>;
  readonly wind: ReturnType<typeof createScalarUniform>;
  readonly sailing: ReturnType<typeof createScalarUniform>;
}

export function createShipClothUniforms(): ShipClothUniforms {
  return {
    phase: createScalarUniform(0),
    wind: createScalarUniform(1),
    sailing: createScalarUniform(0),
  };
}

interface SailBillowOptions {
  readonly phaseNode: Node<"float">;
  readonly windNode: Node<"float">;
  readonly sailingNode: Node<"float">;
  readonly directionSign: 1 | -1;
  readonly scale: number;
}

interface PennantFlutterOptions {
  readonly phaseNode: Node<"float">;
  readonly windNode: Node<"float">;
  readonly scale: number;
}

function buildSailBillowPositionNode(options: SailBillowOptions) {
  const { phaseNode, windNode, sailingNode, directionSign, scale } = options;
  const down = uv().y;
  const across = uv().x.mul(2).sub(1).abs();
  const edgeMask = float(1).sub(across.mul(across));
  const belly = sin(down.mul(Math.PI)).mul(edgeMask);
  const gust = float(SHIP_CLOTH_PARAMS.sailGustBase).add(
    sin(
      phaseNode
        .mul(SHIP_CLOTH_PARAMS.sailGustPhaseMul)
        .add(positionGeometry.z.mul(SHIP_CLOTH_PARAMS.sailGustZFreq / scale)),
    ).mul(SHIP_CLOTH_PARAMS.sailGustAmp),
  );
  const ripple = sin(
    phaseNode
      .mul(SHIP_CLOTH_PARAMS.sailRipplePhaseMul)
      .sub(down.mul(SHIP_CLOTH_PARAMS.sailRippleVFreq))
      .add(positionGeometry.x.mul(SHIP_CLOTH_PARAMS.sailRippleXFreq / scale)),
  )
    .mul(0.5)
    .add(0.5)
    .mul(down)
    .mul(down)
    .mul(edgeMask);
  const pressure = mix(
    float(SHIP_CLOTH_PARAMS.sailIdlePressure),
    float(SHIP_CLOTH_PARAMS.sailSailingPressure),
    sailingNode,
  )
    .mul(windNode)
    .mul(scale);
  const offset = pressure.mul(belly.mul(gust).add(ripple.mul(SHIP_CLOTH_PARAMS.sailRippleWeight))).mul(directionSign);
  const displacedZ = positionGeometry.z.add(offset);
  const limitZ = attribute("aMastClearanceZ", "float");
  const clampedZ = directionSign < 0 ? min(displacedZ, limitZ) : max(displacedZ, limitZ.negate().mul(scale));
  return vec3(positionGeometry.x, positionGeometry.y, clampedZ);
}

function buildPennantFlutterPositionNode(options: PennantFlutterOptions) {
  const { phaseNode, windNode, scale } = options;
  const along = uv().x;
  const waveA = sin(
    phaseNode.mul(SHIP_CLOTH_PARAMS.pennantWaveAPhaseMul).sub(along.mul(SHIP_CLOTH_PARAMS.pennantWaveAFreq)),
  ).mul(SHIP_CLOTH_PARAMS.pennantWaveAAmp);
  const waveB = sin(
    phaseNode.mul(SHIP_CLOTH_PARAMS.pennantWaveBPhaseMul).sub(along.mul(SHIP_CLOTH_PARAMS.pennantWaveBFreq)),
  ).mul(SHIP_CLOTH_PARAMS.pennantWaveBAmp);
  const offset = waveA.add(waveB).mul(along).mul(windNode).mul(scale);
  return vec3(positionGeometry.x, positionGeometry.y, positionGeometry.z.add(offset));
}

class ProceduralShipSailMaterial extends FrostedStandardNodeMaterial {
  private readonly printNode: ReturnType<typeof createPrintTextureNode>;

  constructor(uniforms: ShipClothUniforms, initialTexture: Texture | null) {
    super({ roughness: 0.88, metalness: 0, side: DoubleSide });
    this.name = "Procedural ship sail";
    this.flatShading = false;
    this.printNode = createPrintTextureNode(initialTexture ?? getIvoryFallbackTexture());
    this.colorNode = this.printNode.rgb;
    this.positionNode = buildSailBillowPositionNode({
      phaseNode: uniforms.phase,
      windNode: uniforms.wind,
      sailingNode: uniforms.sailing,
      directionSign: -1,
      scale: 1,
    });
  }

  setPrint(next: Texture | null): void {
    this.printNode.value = next ?? getIvoryFallbackTexture();
  }
}

class ProceduralShipPennantMaterial extends FrostedStandardNodeMaterial {
  private readonly tintUniform: ReturnType<typeof createColorUniform>;

  constructor(uniforms: ShipClothUniforms, initialColor: string) {
    super({ roughness: 0.72, metalness: 0.04, side: DoubleSide });
    this.name = "Procedural ship pennant";
    this.flatShading = false;
    this.tintUniform = createColorUniform(initialColor);
    this.colorNode = this.tintUniform;
    this.positionNode = buildPennantFlutterPositionNode({
      phaseNode: uniforms.phase,
      windNode: uniforms.wind,
      scale: 1,
    });
  }

  setTint(hex: string): void {
    this.tintUniform.value.set(hex);
  }
}

export function createProceduralSailMaterial(
  uniforms: ShipClothUniforms,
  initialTexture: Texture | null = null,
): { material: FrostedStandardNodeMaterial; setPrint: (next: Texture | null) => void } {
  const material = new ProceduralShipSailMaterial(uniforms, initialTexture);
  return {
    material,
    setPrint: (next) => material.setPrint(next),
  };
}

export function createProceduralPennantMaterial(
  uniforms: ShipClothUniforms,
  initialColor = "#e5d7b8",
): { material: FrostedStandardNodeMaterial; setTint: (hex: string) => void } {
  const material = new ProceduralShipPennantMaterial(uniforms, initialColor);
  return {
    material,
    setTint: (hex) => material.setTint(hex),
  };
}

export function createOwnershipSailMaterial(source: MeshBasicMaterial | MeshStandardMaterial): MeshBasicNodeMaterial {
  if (!source.map) throw new Error(`Ownership sail ${source.name} has no print texture`);
  const material = new MeshBasicNodeMaterial();
  material.name = source.name;
  material.map = source.map;
  material.side = DoubleSide;
  material.fog = source.fog;
  material.userData.ownershipColor = true;
  const print = createPrintTextureNode(source.map);
  const stripe = step(SAIL_STRIPE_U.start, uv().x).mul(step(SAIL_STRIPE_U.end, uv().x).oneMinus());
  material.fragmentNode = vec4(applyEndgameFrost(print.rgb.mul(mix(vec3(1), instanceColor, stripe))), print.a);
  if (source.userData.shipCloth === "sail") {
    material.positionNode = buildSailBillowPositionNode({
      phaseNode: mapAnimationTime.mul((Math.PI * 2) / SHIP_CLOTH_PARAMS.cycleSeconds),
      windNode: float(1),
      sailingNode: float(SHIP_CLOTH_PARAMS.sailWorldSailing),
      directionSign: 1,
      scale: SHIP_WORLD_SCALE,
    });
  }
  return material;
}

export function createOwnershipPennantMaterial(
  source: MeshBasicMaterial | MeshStandardMaterial,
): MeshBasicNodeMaterial {
  const material = new MeshBasicNodeMaterial();
  material.name = source.name;
  material.side = DoubleSide;
  material.fog = source.fog;
  material.userData.ownershipColor = true;
  material.fragmentNode = vec4(applyEndgameFrost(instanceColor.mul(color("#ffffff"))), float(1));
  material.positionNode = buildPennantFlutterPositionNode({
    phaseNode: mapAnimationTime.mul((Math.PI * 2) / SHIP_CLOTH_PARAMS.cycleSeconds),
    windNode: float(1),
    scale: SHIP_WORLD_SCALE,
  });
  return material;
}
