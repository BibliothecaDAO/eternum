import type { RendererBackendCapabilities, RendererCapabilityFeature, RendererActiveMode } from "./renderer-backend-v2";

export interface WebgpuPostprocessPolicy {
  bloomRouting: "deferred" | "mrt-emissive" | "none";
  mode: "native-webgpu-minimal" | "native-webgpu-postprocess" | "webgl2-fallback-postprocess";
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
  if (input.activeMode === "webgl2-fallback") {
    return {
      bloomRouting: "none",
      mode: "webgl2-fallback-postprocess",
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
    unsupportedFeatures,
  };
}
