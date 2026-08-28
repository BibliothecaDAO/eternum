import { env } from "../../../env";
import { initializeRendererBackendRuntime } from "@/three/renderer-backend-runtime";

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
  const results = await Promise.allSettled([
    initializeRendererBackendRuntime({
      envBuildMode: env.VITE_PUBLIC_RENDERER_BUILD_MODE,
      isMobileDevice: window.matchMedia("(pointer: coarse)").matches,
      pixelRatio: Math.min(window.devicePixelRatio || 1, input.pixelRatioCap),
      search: window.location.search,
    }),
    ProceduralUnitRuntime.create({ preloadPhysics: input.preloadPhysics }),
  ] as const);
  const [rendererResult, characterResult] = results;

  if (rendererResult.status === "rejected") {
    if (characterResult.status === "fulfilled") characterResult.value.dispose();
    throw rendererResult.reason;
  }
  if (characterResult.status === "rejected") {
    rendererResult.value.backend.dispose?.();
    throw characterResult.reason;
  }

  return {
    unitRuntime: characterResult.value,
    rendererRuntime: rendererResult.value,
  };
}
