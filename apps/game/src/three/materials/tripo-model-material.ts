import {
  Color,
  DoubleSide,
  type Material,
  type Mesh,
  type MeshStandardMaterial,
  NoColorSpace,
  SRGBColorSpace,
  type Texture,
} from "three";
import type NodeBuilder from "three/src/nodes/core/NodeBuilder.js";
import { instanceColor } from "three/src/nodes/accessors/Instance.js";
import {
  bumpMap,
  clamp,
  color,
  diffuseColor,
  dot,
  float,
  materialAO,
  materialColor,
  max,
  min,
  mix,
  normalView,
  positionGeometry,
  positionViewDirection,
  pow,
  smoothstep,
  texture,
  vec3,
  vec4,
} from "three/tsl";
import { applyEndgameFrost } from "../effects/endgame/field";
import { FrostedStandardNodeMaterial } from "../effects/game-map-material-library";
import spec from "./tripo-model-material.json";
import { resolveTripoPbr } from "./tripo-pbr-rules.mjs";

const LUMA_WEIGHTS = vec3(0.2126, 0.7152, 0.0722);
const RIM_COLOR = color(new Color(spec.rim.color));

class TripoStandardNodeMaterial extends FrostedStandardNodeMaterial {
  constructor(private readonly ownershipCloth: boolean) {
    super();
  }

  override setupDiffuseColor(builder: NodeBuilder): void {
    if (!this.ownershipCloth) {
      super.setupDiffuseColor(builder);
      return;
    }
    const baseRgb = this.map ? texture(this.map).rgb.mul(materialColor.rgb) : materialColor.rgb;
    const calibrated = buildCalibratedColorNode(baseRgb, true);
    const hasInstanceColor = Boolean((builder.object as Mesh & { instanceColor?: unknown }).instanceColor);
    const painted = applyTroopOwnershipCloth(baseRgb, calibrated, hasInstanceColor);
    diffuseColor.assign(vec4(painted, float(this.opacity)));
    if (!this.transparent || this.alphaTest > 0) {
      diffuseColor.rgb.assign(applyEndgameFrost(diffuseColor.rgb));
    }
  }
}

export function isTripoModelMaterial(material: Material | null | undefined): boolean {
  return Boolean(material?.userData?.tripoMaterial);
}

export function isTripoTroopMaterial(material: Material | null | undefined): boolean {
  return Boolean(material?.userData?.ownershipCloth);
}

export function isTripoModelMesh(mesh: Mesh): boolean {
  if (typeof mesh.userData?.assetKind === "string") return true;
  const material = mesh.material;
  return Array.isArray(material) ? material.some(isTripoModelMaterial) : isTripoModelMaterial(material);
}

export function createTripoModelMaterial(source: MeshStandardMaterial): FrostedStandardNodeMaterial {
  const ownershipCloth = isTripoTroopMaterial(source);
  const material = new TripoStandardNodeMaterial(ownershipCloth);
  copySurfaceProperties(source, material);
  enforceTextureColorSpaces(material);
  applyPbrRanges(source, material);
  applyBloomSafeEmissive(source, material);
  attachShadingNodes(source, material, ownershipCloth);
  material.userData = { ...source.userData, tripoMaterial: true, ...(ownershipCloth ? { ownershipCloth: true } : {}) };
  return material;
}

function copySurfaceProperties(source: MeshStandardMaterial, target: FrostedStandardNodeMaterial): void {
  target.name = source.name;
  target.color.copy(source.color);
  target.map = source.map;
  target.normalMap = source.normalMap;
  target.normalScale.copy(source.normalScale);
  target.aoMap = source.aoMap;
  target.roughnessMap = source.roughnessMap;
  target.metalnessMap = source.metalnessMap;
  target.emissiveMap = source.emissiveMap;
  target.emissive.copy(source.emissive);
  target.alphaMap = source.alphaMap;
  target.alphaTest = source.alphaTest;
  target.transparent = source.transparent;
  target.opacity = source.opacity;
  target.depthTest = source.depthTest;
  target.depthWrite = source.depthWrite;
  target.vertexColors = source.vertexColors;
  target.fog = source.fog;
  target.envMap = source.envMap;
  target.envMapIntensity = Math.min(Math.max(source.envMapIntensity, 0.5), 1.0);
  if (spec.doubleSided) {
    target.side = DoubleSide;
  }
}

function enforceTextureColorSpaces(material: FrostedStandardNodeMaterial): void {
  setColorSpace(material.map, SRGBColorSpace);
  setColorSpace(material.emissiveMap, SRGBColorSpace);
  setColorSpace(material.normalMap, NoColorSpace);
  setColorSpace(material.aoMap, NoColorSpace);
  setColorSpace(material.roughnessMap, NoColorSpace);
  setColorSpace(material.metalnessMap, NoColorSpace);
}

function setColorSpace(map: Texture | null, space: typeof SRGBColorSpace | typeof NoColorSpace): void {
  if (!map || map.colorSpace === space) return;
  map.colorSpace = space;
  map.needsUpdate = true;
}

function applyPbrRanges(source: MeshStandardMaterial, target: FrostedStandardNodeMaterial): void {
  const resolved = resolveSourcePbr(source);
  target.roughness = resolved.roughness;
  target.metalness = resolved.metalness;
  if (resolved.normalScaleX !== null && resolved.normalScaleY !== null) {
    target.normalScale.set(resolved.normalScaleX, resolved.normalScaleY);
  }
  target.aoMapIntensity = resolved.aoMapIntensity;
}

function applyBloomSafeEmissive(source: MeshStandardMaterial, target: FrostedStandardNodeMaterial): void {
  const resolved = resolveSourcePbr(source);
  if (!resolved.hasEmissiveAccent) {
    target.emissive.setHex(0x000000);
    target.emissiveIntensity = 0;
    return;
  }
  target.emissiveIntensity = resolved.emissiveIntensity;
}

function resolveSourcePbr(source: MeshStandardMaterial) {
  return resolveTripoPbr(
    {
      roughness: source.roughness,
      metalness: source.metalness,
      hasRoughnessMap: Boolean(source.roughnessMap),
      hasMetalnessMap: Boolean(source.metalnessMap),
      hasNormalMap: Boolean(source.normalMap),
      normalScaleX: source.normalScale.x,
      normalScaleY: source.normalScale.y,
      hasEmissiveMap: Boolean(source.emissiveMap),
      emissivePeak: Math.max(source.emissive.r, source.emissive.g, source.emissive.b) * source.emissiveIntensity,
      emissiveIntensity: source.emissiveIntensity,
    },
    spec,
  );
}

function attachShadingNodes(
  source: MeshStandardMaterial,
  target: FrostedStandardNodeMaterial,
  ownershipCloth: boolean,
): void {
  const sampled = sampleBaseRgb(source);
  if (!ownershipCloth) {
    target.colorNode = buildCalibratedColorNode(sampled, false);
  }
  target.aoNode = buildGroundContactAoNode(Boolean(source.aoMap));
  if (!source.roughnessMap) {
    target.roughnessNode = buildDerivedRoughnessNode(sampled);
  }
  if (!source.metalnessMap) {
    target.metalnessNode = buildDerivedMetalnessNode(sampled);
  }
  if (!source.normalMap && source.map) {
    const height = dot(texture(source.map).rgb, LUMA_WEIGHTS);
    target.normalNode = bumpMap(height, float(spec.normal.bumpScale));
  }
}

function sampleBaseRgb(source: MeshStandardMaterial) {
  return source.map ? texture(source.map).rgb.mul(materialColor.rgb) : materialColor.rgb;
}

function buildCalibratedColorNode(baseRgb: ReturnType<typeof sampleBaseRgb>, troopLift: boolean) {
  const { foliage, sat: rawSat, luma: rawLuma } = classifyMaterialMasks(baseRgb);
  const shadowLift = troopLift ? spec.troop.shadowLift : spec.albedo.shadowLift;
  const shadowRange = troopLift ? spec.troop.shadowRange : spec.albedo.shadowRange;
  const lift = float(shadowLift).mul(smoothstep(0, shadowRange, rawLuma).oneMinus());
  const lifted = baseRgb.add(vec3(lift, lift, lift));
  const pivot = float(spec.albedo.pivot);
  const contrasted = pow(max(lifted.div(pivot), float(0.0001)), float(spec.albedo.contrast)).mul(pivot);
  const luma = dot(contrasted, LUMA_WEIGHTS);
  const hi = max(contrasted.r, max(contrasted.g, contrasted.b));
  const lo = min(contrasted.r, min(contrasted.g, contrasted.b));
  const sat = hi.sub(lo).div(max(hi, float(0.0001)));
  const boost = float(1).add(float(spec.albedo.vibrance).mul(float(1).sub(sat.mul(0.75))));
  const vibrant = mix(vec3(luma, luma, luma), contrasted, boost);
  const neutralStone = float(1)
    .sub(foliage)
    .mul(smoothstep(0.16, 0.34, rawSat).oneMinus());
  const darkBasalt = float(1)
    .sub(foliage)
    .mul(smoothstep(0.02, 0.11, rawLuma).oneMinus())
    .mul(smoothstep(0.32, 0.55, rawSat).oneMinus());
  const warmMask = clamp(max(neutralStone.mul(0.78), darkBasalt), float(0), float(1));
  const warmed = vibrant.mul(
    vec3(
      float(1).add(warmMask.mul(spec.albedo.warmStone.red)),
      float(1).add(warmMask.mul(spec.albedo.warmStone.green)),
      float(1).add(warmMask.mul(spec.albedo.warmStone.blue)),
    ),
  );
  const graded = mix(warmed, baseRgb, foliage);
  const fresnel = pow(normalView.dot(positionViewDirection).abs().clamp(0, 1).oneMinus(), float(spec.rim.power));
  return graded.add(RIM_COLOR.mul(fresnel).mul(spec.rim.strength));
}

function applyTroopOwnershipCloth(
  rawRgb: ReturnType<typeof sampleBaseRgb>,
  calibratedRgb: ReturnType<typeof buildCalibratedColorNode>,
  hasInstanceColor: boolean,
) {
  if (!hasInstanceColor) return calibratedRgb;
  const hi = max(rawRgb.r, max(rawRgb.g, rawRgb.b));
  const lo = min(rawRgb.r, min(rawRgb.g, rawRgb.b));
  const sat = hi.sub(lo).div(max(hi, float(0.0001)));
  const luma = dot(rawRgb, LUMA_WEIGHTS);
  const clothMask = smoothstep(0.0, 0.018, rawRgb.b.sub(rawRgb.r.mul(1.15)))
    .mul(smoothstep(0.0, 0.012, rawRgb.b.sub(rawRgb.g.mul(1.02))))
    .mul(smoothstep(0.1, 0.28, sat));
  const shade = clamp(luma.mul(spec.troop.clothShadeScale).add(spec.troop.clothShadeFloor), float(0), float(1));
  return mix(calibratedRgb, instanceColor.mul(shade), clothMask);
}

function buildGroundContactAoNode(hasAoMap: boolean) {
  const heightFactor = smoothstep(0, spec.ambientOcclusion.groundHeight, positionGeometry.y);
  const groundAo = mix(float(spec.ambientOcclusion.groundMin), float(1), heightFactor);
  return hasAoMap ? materialAO.mul(groundAo) : groundAo;
}

function classifyMaterialMasks(baseRgb: ReturnType<typeof sampleBaseRgb>) {
  const hi = max(baseRgb.r, max(baseRgb.g, baseRgb.b));
  const lo = min(baseRgb.r, min(baseRgb.g, baseRgb.b));
  const sat = hi.sub(lo).div(max(hi, float(0.0001)));
  const luma = dot(baseRgb, LUMA_WEIGHTS);
  const foliage = smoothstep(0.0, 0.015, baseRgb.g.sub(baseRgb.r.mul(0.96)))
    .mul(smoothstep(0.0, 0.02, baseRgb.g.sub(baseRgb.b.mul(1.15))))
    .mul(smoothstep(0.12, 0.28, sat));
  const gold = smoothstep(0.14, 0.28, luma)
    .mul(smoothstep(0.28, 0.45, sat))
    .mul(smoothstep(0.0, 0.05, baseRgb.r.sub(baseRgb.g.mul(1.04))))
    .mul(smoothstep(0.0, 0.06, baseRgb.g.sub(baseRgb.b.mul(1.4))));
  const wood = float(1)
    .sub(gold)
    .mul(smoothstep(0.0, 0.04, baseRgb.r.sub(baseRgb.g.mul(1.12))))
    .mul(smoothstep(0.0, 0.04, baseRgb.g.sub(baseRgb.b.mul(1.15))))
    .mul(smoothstep(0.18, 0.32, sat));
  const brightTrim = float(1)
    .sub(foliage)
    .mul(float(1).sub(gold))
    .mul(float(1).sub(wood))
    .mul(smoothstep(0.16, 0.32, luma))
    .mul(smoothstep(0.25, 0.1, sat));
  return { luma, sat, foliage, gold, wood, brightTrim };
}

function buildDerivedRoughnessNode(baseRgb: ReturnType<typeof sampleBaseRgb>) {
  const { luma, foliage, gold, wood } = classifyMaterialMasks(baseRgb);
  const stoneRough = float(spec.roughness.stone).add(float(1).sub(luma.clamp(0, 1)).mul(0.12));
  const withWood = mix(stoneRough, float(spec.roughness.wood), wood);
  const withFoliage = mix(withWood, float(spec.roughness.foliage), foliage);
  const withGold = mix(withFoliage, float(spec.roughness.gold), gold);
  return clamp(withGold, float(spec.roughness.min), float(spec.roughness.max));
}

function buildDerivedMetalnessNode(baseRgb: ReturnType<typeof sampleBaseRgb>) {
  const { gold, brightTrim } = classifyMaterialMasks(baseRgb);
  const accent = float(spec.metalness.stoneAccent).mul(brightTrim);
  const combined = mix(accent, float(spec.metalness.gold), gold);
  return clamp(combined, float(spec.metalness.min), float(spec.metalness.max));
}
