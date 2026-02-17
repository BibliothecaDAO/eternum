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
  vignette: boolean;
}

interface PostProcessingEffectPlan {
  shouldEnableFXAA: boolean;
  shouldEnableBloom: boolean;
  shouldEnableVignette: boolean;
  shouldEnableChromaticAberration: boolean;
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
  const shouldRenderOnInterval =
    input.labelsActive && input.now - input.lastLabelRenderTime >= input.intervalMs;

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
    shouldEnableChromaticAberration: input.vignette,
  };
}
