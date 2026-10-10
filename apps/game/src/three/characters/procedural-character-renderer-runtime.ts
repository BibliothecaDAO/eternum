import { env } from "../../../env";
import { initializeRendererBackendRuntime } from "@/three/renderer-backend-runtime";
import { configureGltfTextureSupport } from "@/three/utils/gltf-loader";
import { isCoarsePointer } from "@/utils/pointer";

import { resolveActiveProceduralCharacterReviewCapability } from "./procedural-character-review-capability";
import { ProceduralUnitRuntime } from "./procedural-unit-runtime";

interface InitializeProceduralCharacterRendererRuntimeInput {
  pixelRatioCap: number;
  preloadPhysics: boolean;
}

export async function initializeProceduralCharacterRendererRuntime(
  input: InitializeProceduralCharacterRendererRuntimeInput,
): Promise<{
  unitRuntime: ProceduralUnitRuntime;
  rendererRuntime: Awaited<ReturnType<typeof initializeRendererBackendRuntime>>;
}> {
  const reviewCapability = resolveActiveProceduralCharacterReviewCapability();
  const rendererRuntime = await initializeRendererBackendRuntime({
    envBuildMode: env.VITE_PUBLIC_RENDERER_BUILD_MODE,
    isMobileDevice: isCoarsePointer(),
    pixelRatio: Math.min(window.devicePixelRatio || 1, input.pixelRatioCap),
    search: window.location.search,
  });
  // Characters load after this: a KTX2-compressed file can only be decoded once the loader knows the renderer.
  configureGltfTextureSupport(rendererRuntime.renderer as Parameters<typeof configureGltfTextureSupport>[0]);
  try {
    const unitRuntime = await ProceduralUnitRuntime.create({
      preloadPhysics: input.preloadPhysics,
      includeT1KnightDefault: reviewCapability.includeT1KnightDefault,
    });
    return { unitRuntime, rendererRuntime };
  } catch (error) {
    rendererRuntime.backend.dispose?.();
    throw error;
  }
}
