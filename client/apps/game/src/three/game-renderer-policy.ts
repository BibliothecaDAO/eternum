import type {
  RendererBackendCapabilities,
  RendererFeatureDegradation,
  RendererPostProcessPlan,
} from "./renderer-backend-v2";

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

interface PostProcessingConfigGateInput {
  hasPostProcessingConfig: boolean;
  isMobileDevice: boolean;
  isHighGraphicsSetting: boolean;
}

interface PostProcessingEffectPlanInput {
  fxaa: boolean;
  bloom: boolean;
  chromaticAberration: boolean;
  vignette: boolean;
}

interface PostProcessingEffectPlan {
  shouldEnableFXAA: boolean;
  shouldEnableBloom: boolean;
  shouldEnableVignette: boolean;
  shouldEnableChromaticAberration: boolean;
}

interface RendererEffectPlanInput {
  antiAlias: RendererPostProcessPlan["antiAlias"];
  bloomEnabled: boolean;
  bloomIntensity: number;
  chromaticAberrationEnabled: boolean;
  colorGrade: RendererPostProcessPlan["colorGrade"];
  toneMapping: RendererPostProcessPlan["toneMapping"];
  vignette: RendererPostProcessPlan["vignette"];
}

type RendererOptionalFeatureDisableReason = Extract<
  RendererFeatureDegradation["reason"],
  "disabled-by-quality" | "disabled-by-user"
>;

interface CapabilityAwareRendererEffectPlanInput extends RendererEffectPlanInput {
  capabilities: RendererBackendCapabilities;
  disabledReasons: {
    bloom?: RendererOptionalFeatureDisableReason;
    chromaticAberration?: RendererOptionalFeatureDisableReason;
    vignette?: RendererOptionalFeatureDisableReason;
  };
}

interface CapabilityAwareRendererEffectPlanResult {
  degradations: RendererFeatureDegradation[];
  plan: RendererPostProcessPlan;
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

const NEUTRAL_COLOR_GRADE: RendererPostProcessPlan["colorGrade"] = {
  brightness: 0,
  contrast: 0,
  hue: 0,
  saturation: 0,
};

export function resolveRendererEffectPlan(input: RendererEffectPlanInput): RendererPostProcessPlan {
  return {
    antiAlias: input.antiAlias,
    bloom: {
      enabled: input.bloomEnabled,
      intensity: input.bloomIntensity,
    },
    chromaticAberration: {
      enabled: input.chromaticAberrationEnabled,
    },
    colorGrade: {
      brightness: input.colorGrade.brightness,
      contrast: input.colorGrade.contrast,
      hue: input.colorGrade.hue,
      saturation: input.colorGrade.saturation,
    },
    toneMapping: {
      exposure: input.toneMapping.exposure,
      mode: input.toneMapping.mode,
      whitePoint: input.toneMapping.whitePoint,
    },
    vignette: {
      darkness: input.vignette.darkness,
      enabled: input.vignette.enabled,
      offset: input.vignette.offset,
    },
  };
}

export function resolveCapabilityAwareRendererEffectPlan(
  input: CapabilityAwareRendererEffectPlanInput,
): CapabilityAwareRendererEffectPlanResult {
  const plan = resolveRendererEffectPlan(input);
  const degradations: RendererFeatureDegradation[] = [];

  if (!input.capabilities.supportsColorGrade && hasNonNeutralColorGrade(plan.colorGrade)) {
    plan.colorGrade = { ...NEUTRAL_COLOR_GRADE };
    degradations.push({
      feature: "colorGrade",
      reason: "unsupported-backend",
    });
  }

  resolveOptionalFeatureSupport({
    capabilities: input.capabilities,
    capability: "supportsBloom",
    degradations,
    disabledReason: input.disabledReasons.bloom,
    feature: "bloom",
    requestedEnabled: input.bloomEnabled,
    setEnabled: (enabled) => {
      plan.bloom.enabled = enabled;
    },
  });

  resolveOptionalFeatureSupport({
    capabilities: input.capabilities,
    capability: "supportsVignette",
    degradations,
    disabledReason: input.disabledReasons.vignette,
    feature: "vignette",
    requestedEnabled: input.vignette.enabled,
    setEnabled: (enabled) => {
      plan.vignette.enabled = enabled;
    },
  });

  resolveOptionalFeatureSupport({
    capabilities: input.capabilities,
    capability: "supportsChromaticAberration",
    degradations,
    disabledReason: input.disabledReasons.chromaticAberration,
    feature: "chromaticAberration",
    requestedEnabled: input.chromaticAberrationEnabled,
    setEnabled: (enabled) => {
      plan.chromaticAberration.enabled = enabled;
    },
  });

  return {
    degradations,
    plan,
  };
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

function hasNonNeutralColorGrade(input: RendererPostProcessPlan["colorGrade"]): boolean {
  return input.brightness !== 0 || input.contrast !== 0 || input.hue !== 0 || input.saturation !== 0;
}

function resolveOptionalFeatureSupport(input: {
  capabilities: RendererBackendCapabilities;
  capability: "supportsBloom" | "supportsChromaticAberration" | "supportsVignette";
  degradations: RendererFeatureDegradation[];
  disabledReason?: RendererOptionalFeatureDisableReason;
  feature: "bloom" | "chromaticAberration" | "vignette";
  requestedEnabled: boolean;
  setEnabled: (enabled: boolean) => void;
}): void {
  if (input.requestedEnabled) {
    if (input.capabilities[input.capability]) {
      return;
    }

    input.setEnabled(false);
    input.degradations.push({
      feature: input.feature,
      reason: "unsupported-backend",
    });
    return;
  }

  if (!input.disabledReason) {
    return;
  }

  input.degradations.push({
    feature: input.feature,
    reason: input.disabledReason,
  });
}

export function resolveLabelRenderIntervalMs(view: LabelRenderView, isMobileDevice: boolean): number {
  const baseInterval = (() => {
    switch (view) {
      case "close":
        return 0;
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

  if (baseInterval === 0) {
    return 33;
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

export function shouldEnablePostProcessingConfig(input: PostProcessingConfigGateInput): boolean {
  if (!input.hasPostProcessingConfig) {
    return false;
  }

  if (input.isMobileDevice && !input.isHighGraphicsSetting) {
    return false;
  }

  return true;
}

export function resolvePostProcessingEffectPlan(input: PostProcessingEffectPlanInput): PostProcessingEffectPlan {
  return {
    shouldEnableFXAA: input.fxaa,
    shouldEnableBloom: input.bloom,
    shouldEnableVignette: input.vignette,
    shouldEnableChromaticAberration: input.chromaticAberration,
  };
}
