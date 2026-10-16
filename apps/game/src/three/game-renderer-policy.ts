import type { RendererBackendCapabilities, RendererFeatureDegradation } from "./renderer-backend";

type LabelRenderView = "close" | "medium" | "far" | undefined;

interface LabelRenderDecisionInput {
  now: number;
  lastLabelRenderTime: number;
  labelsDirty: boolean;
  lastLabelsActive: boolean;
  labelsActive: boolean;
  intervalMs: number;
}

interface LabelRenderDecision {
  shouldRender: boolean;
  nextLabelsDirty: boolean;
  nextLastLabelsActive: boolean;
  nextLastLabelRenderTime: number;
}

interface RendererEnvironmentPolicyInput {
  capabilities: RendererBackendCapabilities;
  intensity: number;
}

interface RendererEnvironmentPolicyResult {
  degradations: RendererFeatureDegradation[];
  intensity: number;
  shouldApplyEnvironment: boolean;
}

export function resolveRendererEnvironmentPolicy(
  input: RendererEnvironmentPolicyInput,
): RendererEnvironmentPolicyResult {
  if (input.capabilities.supportsEnvironmentIbl) {
    return {
      degradations: [],
      intensity: input.intensity,
      shouldApplyEnvironment: true,
    };
  }

  return {
    degradations: [
      {
        detail: `Using scene key/fill fallback lighting policy at target environment intensity ${input.intensity.toFixed(2)}`,
        feature: "environmentIbl",
        reason: "unsupported-backend",
      },
    ],
    intensity: input.intensity,
    shouldApplyEnvironment: false,
  };
}

export function resolveLabelRenderIntervalMs(view: LabelRenderView, isMobileDevice: boolean): number {
  const baseInterval = (() => {
    switch (view) {
      case "close":
        return 16;
      case "medium":
        return 33;
      case "far":
        return 100;
      default:
        return 33;
    }
  })();

  if (!isMobileDevice) {
    return baseInterval;
  }

  return Math.round(baseInterval * 1.5);
}

export function resolveLabelRenderDecision(input: LabelRenderDecisionInput): LabelRenderDecision {
  const labelsActiveChanged = input.labelsActive !== input.lastLabelsActive;
  const nextLabelsDirty = input.labelsDirty || labelsActiveChanged;
  const shouldRenderOnInterval = input.labelsActive && input.now - input.lastLabelRenderTime >= input.intervalMs;

  if (nextLabelsDirty || shouldRenderOnInterval) {
    return {
      shouldRender: true,
      nextLabelsDirty: false,
      nextLastLabelsActive: input.labelsActive,
      nextLastLabelRenderTime: input.now,
    };
  }

  return {
    shouldRender: false,
    nextLabelsDirty: nextLabelsDirty,
    nextLastLabelsActive: input.labelsActive,
    nextLastLabelRenderTime: input.lastLabelRenderTime,
  };
}
