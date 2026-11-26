import {
  InstancedMesh,
  Light,
  Mesh,
  NoBlending,
  SkinnedMesh,
  Sprite,
  SpriteMaterial,
  type Camera,
  type Material,
  type Object3D,
  type RenderTarget,
  type Scene,
  type Texture,
} from "three";
import { vec4 } from "three/tsl";
import { MeshBasicNodeMaterial } from "three/webgpu";
import { beginModelPreparation } from "./model-preparation";
import { incrementWorldmapRenderCounter, recordWorldmapRenderDuration } from "./perf/worldmap-render-diagnostics";

export type PipelineCompiler = (object: Object3D, targetScene: Scene) => Promise<void>;

export interface PipelineCompilingRenderer {
  compileAsync?(object: Object3D, camera: Camera, targetScene?: Scene | null): Promise<unknown>;
  initTexture?(texture: Texture): void;
  getRenderTarget?(): RenderTarget | null;
  setRenderTarget?(target: RenderTarget | null): void;
  getMRT?(): unknown;
  setMRT?(mrt: unknown): void;
  shadowMap?: { enabled: boolean };
}

type CompileObjectAsync = (object: Object3D, camera: Camera, targetScene: Scene) => Promise<void>;
type ReadyShadowLight = Light & { shadow: { map: RenderTarget; camera: Camera } };

const pendingRendererCompiles = new WeakMap<PipelineCompilingRenderer, Promise<void>>();
let sharedShadowPassMaterial: MeshBasicNodeMaterial | null = null;

export function createPipelineCompiler(input: {
  getRenderer: () => PipelineCompilingRenderer | undefined;
  getCamera: () => Camera;
  compileObjectAsync?: CompileObjectAsync;
}): PipelineCompiler {
  let warnedMissingCompile = false;
  return async (object, targetScene) => {
    const renderer = input.getRenderer();
    if (!renderer?.compileAsync && !input.compileObjectAsync) {
      if (!warnedMissingCompile && import.meta.env?.DEV) {
        warnedMissingCompile = true;
        console.warn("[PipelineCompiler] renderer has no compileAsync; pipelines compile on first draw");
      }
      return;
    }
    const startedAt = performance.now();
    const endPreparation = beginModelPreparation();
    try {
      const camera = input.getCamera();
      const targetRenderer = renderer ?? ({} as PipelineCompilingRenderer);
      await serializeRendererCompile(targetRenderer, async () => {
        initializeObjectTextures(renderer, object);
        await withFrustumCullingDisabled(object, async () => {
          await compileMainPass(renderer, input.compileObjectAsync, object, camera, targetScene);
          await compileShadowPasses(renderer, object, targetScene);
        });
      });
      incrementWorldmapRenderCounter("pipelinePrecompiles");
    } finally {
      recordWorldmapRenderDuration("pipelineCompileMs", performance.now() - startedAt);
      endPreparation();
    }
  };
}

async function compileMainPass(
  renderer: PipelineCompilingRenderer | undefined,
  compileObjectAsync: CompileObjectAsync | undefined,
  object: Object3D,
  camera: Camera,
  targetScene: Scene,
): Promise<void> {
  if (compileObjectAsync) {
    await compileObjectAsync(object, camera, targetScene);
    return;
  }
  await renderer?.compileAsync?.(object, camera, targetScene);
}

async function compileShadowPasses(
  renderer: PipelineCompilingRenderer | undefined,
  object: Object3D,
  targetScene: Scene,
): Promise<void> {
  if (
    !renderer?.shadowMap?.enabled ||
    !renderer.compileAsync ||
    !renderer.getRenderTarget ||
    !renderer.setRenderTarget
  ) {
    return;
  }
  const shadowLights = collectReadyShadowLights(targetScene);
  if (shadowLights.length === 0 || !hasShadowCaster(object)) return;

  const hiddenMeshes = hideNonShadowCasters(object);
  const previousTarget = renderer.getRenderTarget();
  const previousMRT = renderer.getMRT?.();
  const previousOverride = targetScene.overrideMaterial;
  try {
    targetScene.overrideMaterial = getShadowPassMaterial();
    renderer.setMRT?.(null);
    for (const light of shadowLights) {
      renderer.setRenderTarget(light.shadow.map);
      await renderer.compileAsync(object, light.shadow.camera, targetScene);
    }
  } finally {
    targetScene.overrideMaterial = previousOverride;
    renderer.setRenderTarget(previousTarget);
    if (renderer.setMRT) renderer.setMRT(previousMRT ?? null);
    for (const [mesh, visible] of hiddenMeshes) mesh.visible = visible;
  }
}

function collectReadyShadowLights(scene: Scene): ReadyShadowLight[] {
  const lights: ReadyShadowLight[] = [];
  scene.traverse((child) => {
    if (isReadyShadowLight(child)) {
      lights.push(child);
    }
  });
  return lights;
}

function isReadyShadowLight(child: Object3D): child is ReadyShadowLight {
  if (!(child instanceof Light) || !child.castShadow) return false;
  const shadow = (child as Light & { shadow?: { map?: RenderTarget | null; camera?: Camera } }).shadow;
  return Boolean(shadow?.map && shadow?.camera);
}

function hasShadowCaster(object: Object3D): boolean {
  let found = false;
  object.traverse((child) => {
    if (child instanceof Mesh && child.castShadow) found = true;
  });
  return found;
}

function hideNonShadowCasters(object: Object3D): Array<[Mesh, boolean]> {
  const hidden: Array<[Mesh, boolean]> = [];
  object.traverse((child) => {
    if (child instanceof Mesh && !child.castShadow && child.visible) {
      hidden.push([child, child.visible]);
      child.visible = false;
    }
  });
  return hidden;
}

function getShadowPassMaterial(): MeshBasicNodeMaterial {
  if (!sharedShadowPassMaterial) {
    const material = new MeshBasicNodeMaterial();
    material.colorNode = vec4(0, 0, 0, 1);
    (material as MeshBasicNodeMaterial & { isShadowPassMaterial: boolean }).isShadowPassMaterial = true;
    material.name = "ShadowMaterial";
    material.blending = NoBlending;
    material.fog = false;
    sharedShadowPassMaterial = material;
  }
  return sharedShadowPassMaterial;
}

export async function warmTexturePipeline(
  compilePipelines: PipelineCompiler | undefined,
  scene: Scene,
  texture: Texture,
): Promise<void> {
  if (!compilePipelines) return;
  const material = new SpriteMaterial({ map: texture, transparent: true });
  const sprite = new Sprite(material);
  try {
    await compilePipelines(sprite, scene);
  } finally {
    material.dispose();
  }
}

async function withFrustumCullingDisabled(object: Object3D, run: () => Promise<void>): Promise<void> {
  const savedCulling: Array<[Object3D, boolean]> = [];
  const savedVisibility: Array<[Object3D, boolean]> = [];
  object.traverse((child) => {
    if (child.frustumCulled) {
      savedCulling.push([child, child.frustumCulled]);
      child.frustumCulled = false;
    }
    if (!child.visible) {
      savedVisibility.push([child, child.visible]);
      child.visible = true;
    }
  });
  try {
    await run();
  } finally {
    for (const [child, frustumCulled] of savedCulling) child.frustumCulled = frustumCulled;
    for (const [child, visible] of savedVisibility) child.visible = visible;
  }
}

function initializeObjectTextures(renderer: PipelineCompilingRenderer | undefined, object: Object3D): void {
  if (!renderer?.initTexture) return;
  const textures = collectObjectTextures(object);
  for (const texture of textures) renderer.initTexture(texture);
}

function collectObjectTextures(object: Object3D): Set<Texture> {
  const textures = new Set<Texture>();
  object.traverse((child) => {
    const materialField = (child as { material?: Material | Material[] }).material;
    if (materialField) {
      const materials = Array.isArray(materialField) ? materialField : [materialField];
      for (const material of materials) collectMaterialTextures(material, textures);
    }
    if (child instanceof InstancedMesh && child.morphTexture) textures.add(child.morphTexture);
    if (child instanceof SkinnedMesh && child.skeleton?.boneTexture) textures.add(child.skeleton.boneTexture);
  });
  return textures;
}

function collectMaterialTextures(material: Material, textures: Set<Texture>): void {
  for (const value of Object.values(material)) {
    if (isTextureValue(value)) textures.add(value);
  }
}

function isTextureValue(value: unknown): value is Texture {
  return Boolean(value && typeof value === "object" && (value as { isTexture?: boolean }).isTexture === true);
}

async function serializeRendererCompile(
  renderer: PipelineCompilingRenderer,
  compile: () => Promise<unknown>,
): Promise<void> {
  const previous = pendingRendererCompiles.get(renderer) ?? Promise.resolve();
  const compilation = previous.then(compile);
  const settled = compilation.then(
    () => {},
    () => {},
  );
  pendingRendererCompiles.set(renderer, settled);
  try {
    await compilation;
  } finally {
    if (pendingRendererCompiles.get(renderer) === settled) pendingRendererCompiles.delete(renderer);
  }
}
