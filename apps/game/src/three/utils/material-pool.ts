import { Material, MeshBasicMaterial, MeshStandardMaterial, Texture } from "three";
import { verboseLog } from "@/utils/dev-mode";

const TEXTURE_SLOTS = [
  "alphaMap",
  "aoMap",
  "bumpMap",
  "clearcoatMap",
  "clearcoatNormalMap",
  "clearcoatRoughnessMap",
  "displacementMap",
  "emissiveMap",
  "envMap",
  "iridescenceMap",
  "iridescenceThicknessMap",
  "lightMap",
  "map",
  "metalnessMap",
  "normalMap",
  "roughnessMap",
  "sheenColorMap",
  "sheenRoughnessMap",
  "specularColorMap",
  "specularIntensityMap",
  "specularMap",
  "thicknessMap",
  "transmissionMap",
] as const;

interface MaterialStats {
  uniqueMaterials: number;
  totalReferences: number;
  memoryEstimateMB: number;
  materialTypes: Record<string, number>;
  shaderFeatureShapes: number;
}

interface MaterialOverrides {
  opacity?: number;
  color?: number;
  transparent?: boolean;
  metalness?: number;
  roughness?: number;
}

const resolveTextureContentId = (texture: Texture): string => {
  const contentHash = texture.userData?.eternumContentHash;
  if (typeof contentHash === "string" && contentHash.length > 0) return `sha256:${contentHash}`;

  const image = texture.image as { src?: unknown } | undefined;
  const source = texture.source?.data as { src?: unknown } | undefined;
  const sourceUrl = image?.src ?? source?.src;
  if (typeof sourceUrl === "string" && sourceUrl.length > 0) return `url:${sourceUrl}`;
  return `runtime:${texture.uuid}`;
};

const textureFingerprint = (texture: Texture | null): unknown => {
  if (!texture) return null;
  return {
    content: resolveTextureContentId(texture),
    anisotropy: texture.anisotropy,
    center: texture.center.toArray(),
    channel: texture.channel,
    colorSpace: texture.colorSpace,
    compareFunction: (texture as unknown as { compareFunction?: unknown }).compareFunction,
    flipY: texture.flipY,
    format: texture.format,
    generateMipmaps: texture.generateMipmaps,
    internalFormat: texture.internalFormat,
    magFilter: texture.magFilter,
    mapping: texture.mapping,
    matrix: texture.matrix.toArray(),
    matrixAutoUpdate: texture.matrixAutoUpdate,
    minFilter: texture.minFilter,
    offset: texture.offset.toArray(),
    premultiplyAlpha: texture.premultiplyAlpha,
    repeat: texture.repeat.toArray(),
    rotation: texture.rotation,
    type: texture.type,
    unpackAlignment: texture.unpackAlignment,
    wrapS: texture.wrapS,
    wrapT: texture.wrapT,
  };
};

const materialFeatureShape = (material: Material): string =>
  JSON.stringify({
    alphaTest: material.alphaTest > 0,
    flatShading: (material as MeshStandardMaterial).flatShading === true,
    fog: "fog" in material ? material.fog : false,
    maps: Object.fromEntries(
      TEXTURE_SLOTS.map((slot) => [slot, Boolean((material as unknown as Record<string, Texture | null>)[slot])]),
    ),
    side: material.side,
    transparent: material.transparent,
    type: material.type,
    vertexColors: material.vertexColors,
  });

const normalizeShaderFeatureFlags = (material: Material): void => {
  material.alphaTest = Math.max(0, material.alphaTest || 0);
  material.transparent = material.transparent === true;
  material.vertexColors = material.vertexColors === true;
  if (material instanceof MeshStandardMaterial) {
    material.flatShading = material.flatShading === true;
  }
};

const NON_RENDERING_MATERIAL_FIELDS = new Set(["name", "userData", "uuid", "version"]);

const renderValueFingerprint = (value: unknown): unknown => {
  if (value instanceof Texture) return textureFingerprint(value);
  if (Array.isArray(value)) return value.map(renderValueFingerprint);
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    if (typeof object.toArray === "function") {
      return {
        type: value.constructor.name,
        value: renderValueFingerprint((object.toArray as () => unknown[])()),
      };
    }
    return Object.fromEntries(
      Object.keys(object)
        .filter((key) => key !== "_listeners" && typeof object[key] !== "function")
        .sort()
        .map((key) => [key, renderValueFingerprint(object[key])]),
    );
  }
  return typeof value === "function" ? undefined : value;
};

const generateMaterialKey = (material: Material, kind: "basic" | "standard"): string => {
  normalizeShaderFeatureFlags(material);
  return JSON.stringify({
    customProgramCacheKey: material.customProgramCacheKey(),
    kind,
    parameters: Object.fromEntries(
      Object.keys(material)
        .filter((key) => !NON_RENDERING_MATERIAL_FIELDS.has(key))
        .sort()
        .map((key) => [key, renderValueFingerprint((material as unknown as Record<string, unknown>)[key])]),
    ),
  });
};

/** Configure every source render property before acquire; pooled materials stay immutable until release. */
export class MaterialPool {
  private static instance: MaterialPool;
  private readonly materials = new Map<string, Material>();
  private readonly referenceCount = new Map<string, number>();
  private readonly materialKeys = new Map<Material, string>();

  private constructor() {}

  public static getInstance(): MaterialPool {
    MaterialPool.instance ??= new MaterialPool();
    return MaterialPool.instance;
  }

  public getBasicMaterial(source: Material, overrides: MaterialOverrides = {}): MeshBasicMaterial {
    const candidate = this.createBasicCandidate(source, overrides);
    return this.acquire(candidate, "basic", candidate !== source ? source : undefined) as MeshBasicMaterial;
  }

  public getStandardMaterial(source: Material, overrides: MaterialOverrides = {}): MeshStandardMaterial {
    if (!(source instanceof MeshStandardMaterial)) {
      throw new Error(`Cannot pool ${source.type} as an exact standard material`);
    }
    const hasOverrides = Object.keys(overrides).length > 0;
    const candidate = hasOverrides ? source.clone() : source;
    this.applyOverrides(candidate, overrides);
    return this.acquire(candidate, "standard", candidate !== source ? source : undefined) as MeshStandardMaterial;
  }

  public releaseMaterial(material: Material): void {
    const key = this.materialKeys.get(material);
    if (!key) return;

    const count = this.referenceCount.get(key) ?? 0;
    if (count > 1) {
      this.referenceCount.set(key, count - 1);
      return;
    }
    material.dispose();
    this.materials.delete(key);
    this.referenceCount.delete(key);
    this.materialKeys.delete(material);
  }

  public isManagedMaterial(material: Material): boolean {
    return this.materialKeys.has(material);
  }

  public getStats(): MaterialStats {
    const totalReferences = [...this.referenceCount.values()].reduce((sum, count) => sum + count, 0);
    const materialTypes: Record<string, number> = {};
    const featureShapes = new Set<string>();
    this.materials.forEach((material) => {
      materialTypes[material.type] = (materialTypes[material.type] ?? 0) + 1;
      featureShapes.add(materialFeatureShape(material));
    });
    return {
      uniqueMaterials: this.materials.size,
      totalReferences,
      memoryEstimateMB: Math.round(this.materials.size * 0.005 * 100) / 100,
      materialTypes,
      shaderFeatureShapes: featureShapes.size,
    };
  }

  public dispose(): void {
    this.materials.forEach((material) => material.dispose());
    this.materials.clear();
    this.referenceCount.clear();
    this.materialKeys.clear();
  }

  public logSharingStats(): void {
    const stats = this.getStats();
    const sharingRatio = stats.totalReferences / Math.max(stats.uniqueMaterials, 1);
    verboseLog(
      `[MaterialPool] exact=${stats.uniqueMaterials} refs=${stats.totalReferences} sharing=${sharingRatio.toFixed(1)}:1 shaderShapes=${stats.shaderFeatureShapes}`,
    );
  }

  private createBasicCandidate(source: Material, overrides: MaterialOverrides): MeshBasicMaterial {
    if (source instanceof MeshBasicMaterial) {
      if (Object.keys(overrides).length === 0) return source;
      const candidate = source.clone();
      if (overrides.opacity !== undefined) candidate.opacity = overrides.opacity;
      if (overrides.color !== undefined) candidate.color.setHex(overrides.color);
      if (overrides.transparent !== undefined) candidate.transparent = overrides.transparent;
      return candidate;
    }

    const standard = source as MeshStandardMaterial;
    return new MeshBasicMaterial({
      alphaMap: standard.alphaMap,
      alphaTest: source.alphaTest,
      aoMap: standard.aoMap,
      aoMapIntensity: standard.aoMapIntensity,
      color: overrides.color ?? standard.color,
      depthTest: source.depthTest,
      depthWrite: source.depthWrite,
      envMap: standard.envMap,
      fog: standard.fog,
      lightMap: standard.lightMap,
      lightMapIntensity: standard.lightMapIntensity,
      map: standard.map,
      opacity: overrides.opacity ?? source.opacity,
      side: source.side,
      toneMapped: source.toneMapped,
      transparent: overrides.transparent ?? source.transparent,
      vertexColors: source.vertexColors,
      wireframe: standard.wireframe,
    });
  }

  private applyOverrides(material: MeshStandardMaterial, overrides: MaterialOverrides): void {
    if (overrides.opacity !== undefined) material.opacity = overrides.opacity;
    if (overrides.color !== undefined) material.color.setHex(overrides.color);
    if (overrides.transparent !== undefined) material.transparent = overrides.transparent;
    if (overrides.metalness !== undefined) material.metalness = overrides.metalness;
    if (overrides.roughness !== undefined) material.roughness = overrides.roughness;
  }

  private acquire(candidate: Material, kind: "basic" | "standard", disposableSource?: Material): Material {
    const key = generateMaterialKey(candidate, kind);
    const existing = this.materials.get(key);
    if (existing) {
      this.referenceCount.set(key, (this.referenceCount.get(key) ?? 0) + 1);
      if (candidate !== existing) candidate.dispose();
      this.disposeUnmanagedSource(disposableSource);
      return existing;
    }

    this.materials.set(key, candidate);
    this.referenceCount.set(key, 1);
    this.materialKeys.set(candidate, key);
    this.disposeUnmanagedSource(disposableSource);
    return candidate;
  }

  private disposeUnmanagedSource(source: Material | undefined): void {
    if (source && !this.isManagedMaterial(source)) source.dispose();
  }
}
