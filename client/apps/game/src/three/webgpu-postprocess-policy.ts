import type { Camera, Object3D } from "three";

import type { RendererBackendCapabilities, RendererCapabilityFeature, RendererActiveMode } from "./renderer-backend-v2";
import type { RendererSurfaceLike } from "./renderer-backend";

export interface WebgpuPostprocessPolicy {
  bloomRouting: "deferred" | "mrt-emissive" | "none";
  mode:
    | "legacy-webgl-postprocess"
    | "native-webgpu-minimal"
    | "native-webgpu-postprocess"
    | "webgl2-fallback-postprocess";
  prewarmStrategy: "compile-async" | "none";
  unsupportedFeatures: RendererCapabilityFeature[];
}

const POSTPROCESS_FEATURES: RendererCapabilityFeature[] = [
  "bloom",
  "chromaticAberration",
  "colorGrade",
  "environmentIbl",
  "toneMappingControl",
  "vignette",
];

export function resolveWebgpuPostprocessPolicy(input: {
  activeMode: RendererActiveMode;
  capabilities: RendererBackendCapabilities;
}): WebgpuPostprocessPolicy {
  if (input.activeMode === "legacy-webgl") {
    return {
      bloomRouting: "none",
      mode: "legacy-webgl-postprocess",
      prewarmStrategy: "compile-async",
      unsupportedFeatures: [],
    };
  }

  if (input.activeMode === "webgl2-fallback") {
    return {
      bloomRouting: "none",
      mode: "webgl2-fallback-postprocess",
      prewarmStrategy: "compile-async",
      unsupportedFeatures: [],
    };
  }

  const unsupportedFeatures = POSTPROCESS_FEATURES.filter((feature) => {
    switch (feature) {
      case "bloom":
        return !input.capabilities.supportsBloom;
      case "chromaticAberration":
        return !input.capabilities.supportsChromaticAberration;
      case "colorGrade":
        return !input.capabilities.supportsColorGrade;
      case "environmentIbl":
        return !input.capabilities.supportsEnvironmentIbl;
      case "toneMappingControl":
        return !input.capabilities.supportsToneMappingControl;
      case "vignette":
        return !input.capabilities.supportsVignette;
      default:
        return false;
    }
  });

  return {
    bloomRouting: input.capabilities.supportsBloom ? "mrt-emissive" : "deferred",
    mode: "native-webgpu-minimal",
    prewarmStrategy: "compile-async",
    unsupportedFeatures,
  };
}

export async function requestRendererScenePrewarm(
  renderer: RendererSurfaceLike | undefined,
  scene: Object3D,
  camera: Camera,
): Promise<void> {
  const rendererWithCompile = renderer as
    | (RendererSurfaceLike & {
        compileAsync?: (scene: Object3D, camera: Camera) => Promise<void>;
      })
    | undefined;

  if (typeof rendererWithCompile?.compileAsync !== "function") {
    return;
  }

  await rendererWithCompile.compileAsync(scene, camera);
}
