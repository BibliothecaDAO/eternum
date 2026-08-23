const PROCEDURAL_CHARACTER_TARGET_FPS = 60;
const PROCEDURAL_CHARACTER_FRAME_BUDGET_MS = 1_000 / PROCEDURAL_CHARACTER_TARGET_FPS;

export type ProceduralCharacterPerformanceEvaluationState = "complete" | "sampling" | "warming";
export type ProceduralCharacterPerformanceEvaluationStatus =
  | "display-limited"
  | "fail"
  | "pass"
  | ProceduralCharacterPerformanceEvaluationState;

export interface ProceduralCharacterPerformanceDistribution {
  average: number;
  p95: number;
  p99: number;
}

export interface ProceduralCharacterPerformanceEvaluation {
  animationCpuMs: ProceduralCharacterPerformanceDistribution;
  displayRefreshFps: number | null;
  frameBudgetHitRate: number;
  frameMs: ProceduralCharacterPerformanceDistribution;
  gpuFrameMs: ProceduralCharacterPerformanceDistribution | null;
  gpuSampleCount: number;
  gpuTimerSupported: boolean;
  headroomPass: boolean;
  observedFps: number;
  onePercentLowFps: number;
  onScreenPass: boolean;
  reasons: readonly string[];
  renderCpuMs: ProceduralCharacterPerformanceDistribution;
  sampleCount: number;
  sampleTarget: number;
  state: ProceduralCharacterPerformanceEvaluationState;
  status: ProceduralCharacterPerformanceEvaluationStatus;
  targetFps: number;
  targetFrameMs: number;
  totalCpuMs: ProceduralCharacterPerformanceDistribution;
  warmupRemaining: number;
}

export interface ProceduralCharacterPerformanceFrameSample {
  animationCpuMs: number;
  frameMs: number;
  renderCpuMs: number;
  totalCpuMs: number;
}

interface ResolvedPerformanceMeasurements {
  animationCpuMs: ProceduralCharacterPerformanceDistribution;
  frameBudgetHitRate: number;
  frameMs: ProceduralCharacterPerformanceDistribution;
  gpuFrameMs: ProceduralCharacterPerformanceDistribution | null;
  observedFps: number;
  onePercentLowFps: number;
  renderCpuMs: ProceduralCharacterPerformanceDistribution;
  totalCpuMs: ProceduralCharacterPerformanceDistribution;
}

interface ResolvedPerformanceOutcome {
  headroomPass: boolean;
  onScreenPass: boolean;
  reasons: string[];
  status: ProceduralCharacterPerformanceEvaluationStatus;
}

const DEFAULT_WARMUP_FRAMES = 60;
const DEFAULT_SAMPLE_FRAMES = 240;
const MIN_PRESENTATION_FPS = 59;
const MIN_GPU_SAMPLES = 30;
const PRESENTATION_FRAME_TOLERANCE_MS = 0.5;

export class ProceduralCharacterPerformanceEvaluator {
  private readonly animationCpuSamples: number[] = [];
  private readonly frameSamples: number[] = [];
  private readonly gpuSamples: number[] = [];
  private readonly renderCpuSamples: number[] = [];
  private readonly totalCpuSamples: number[] = [];
  private displayRefreshFps: number | null = null;
  private gpuTimerSupported = false;
  private warmupFrames = 0;

  public constructor(
    private readonly warmupTarget = DEFAULT_WARMUP_FRAMES,
    private readonly sampleTarget = DEFAULT_SAMPLE_FRAMES,
  ) {}

  public reset(): void {
    this.animationCpuSamples.length = 0;
    this.frameSamples.length = 0;
    this.gpuSamples.length = 0;
    this.renderCpuSamples.length = 0;
    this.totalCpuSamples.length = 0;
    this.warmupFrames = 0;
  }

  public setDisplayRefreshFps(fps: number): void {
    this.displayRefreshFps = normalizePositiveMetric(fps);
  }

  public setGpuTimerSupported(supported: boolean): void {
    this.gpuTimerSupported = supported;
  }

  public recordFrame(sample: ProceduralCharacterPerformanceFrameSample): void {
    if (this.frameSamples.length >= this.sampleTarget || !isFiniteFrameSample(sample)) return;
    if (this.warmupFrames < this.warmupTarget) {
      this.warmupFrames += 1;
      return;
    }
    this.frameSamples.push(sample.frameMs);
    this.animationCpuSamples.push(sample.animationCpuMs);
    this.renderCpuSamples.push(sample.renderCpuMs);
    this.totalCpuSamples.push(sample.totalCpuMs);
  }

  public recordGpuFrame(frameMs: number): void {
    if (this.state !== "sampling" || this.gpuSamples.length >= this.sampleTarget) return;
    const normalized = normalizePositiveMetric(frameMs);
    if (normalized !== null) this.gpuSamples.push(normalized);
  }

  public get state(): ProceduralCharacterPerformanceEvaluationState {
    if (this.warmupFrames < this.warmupTarget) return "warming";
    return this.frameSamples.length < this.sampleTarget ? "sampling" : "complete";
  }

  public getSnapshot(): ProceduralCharacterPerformanceEvaluation {
    const measurements = resolvePerformanceMeasurements({
      animationCpuSamples: this.animationCpuSamples,
      frameSamples: this.frameSamples,
      gpuSamples: this.gpuSamples,
      renderCpuSamples: this.renderCpuSamples,
      totalCpuSamples: this.totalCpuSamples,
    });
    const outcome = resolvePerformanceOutcome({
      displayRefreshFps: this.displayRefreshFps,
      gpuSampleCount: this.gpuSamples.length,
      gpuTimerSupported: this.gpuTimerSupported,
      measurements,
      sampleTarget: this.sampleTarget,
      state: this.state,
    });

    return {
      animationCpuMs: measurements.animationCpuMs,
      displayRefreshFps: roundMetric(this.displayRefreshFps),
      frameBudgetHitRate: roundMetric(measurements.frameBudgetHitRate) ?? 0,
      frameMs: measurements.frameMs,
      gpuFrameMs: measurements.gpuFrameMs,
      gpuSampleCount: this.gpuSamples.length,
      gpuTimerSupported: this.gpuTimerSupported,
      headroomPass: outcome.headroomPass,
      observedFps: roundMetric(measurements.observedFps) ?? 0,
      onePercentLowFps: roundMetric(measurements.onePercentLowFps) ?? 0,
      onScreenPass: outcome.onScreenPass,
      reasons: outcome.reasons,
      renderCpuMs: measurements.renderCpuMs,
      sampleCount: this.frameSamples.length,
      sampleTarget: this.sampleTarget,
      state: this.state,
      status: outcome.status,
      targetFps: PROCEDURAL_CHARACTER_TARGET_FPS,
      targetFrameMs: roundMetric(frameBudgetMs()) ?? 0,
      totalCpuMs: measurements.totalCpuMs,
      warmupRemaining: Math.max(0, this.warmupTarget - this.warmupFrames),
    };
  }
}

function resolvePerformanceMeasurements(input: {
  animationCpuSamples: readonly number[];
  frameSamples: readonly number[];
  gpuSamples: readonly number[];
  renderCpuSamples: readonly number[];
  totalCpuSamples: readonly number[];
}): ResolvedPerformanceMeasurements {
  const frameMs = resolveDistribution(input.frameSamples);
  return {
    animationCpuMs: resolveDistribution(input.animationCpuSamples),
    frameBudgetHitRate: resolveFrameBudgetHitRate(input.frameSamples),
    frameMs,
    gpuFrameMs: input.gpuSamples.length > 0 ? resolveDistribution(input.gpuSamples) : null,
    observedFps: frameMs.average > 0 ? 1_000 / frameMs.average : 0,
    onePercentLowFps: frameMs.p99 > 0 ? 1_000 / frameMs.p99 : 0,
    renderCpuMs: resolveDistribution(input.renderCpuSamples),
    totalCpuMs: resolveDistribution(input.totalCpuSamples),
  };
}

function resolvePerformanceOutcome(input: {
  displayRefreshFps: number | null;
  gpuSampleCount: number;
  gpuTimerSupported: boolean;
  measurements: ResolvedPerformanceMeasurements;
  sampleTarget: number;
  state: ProceduralCharacterPerformanceEvaluationState;
}): ResolvedPerformanceOutcome {
  const onScreenPass =
    input.state === "complete" &&
    input.measurements.observedFps >= MIN_PRESENTATION_FPS &&
    input.measurements.frameMs.p95 <= frameBudgetMs() + PRESENTATION_FRAME_TOLERANCE_MS;
  const minimumGpuSamples = Math.min(MIN_GPU_SAMPLES, Math.max(1, Math.floor(input.sampleTarget * 0.75)));
  const gpuEvidenceReady = !input.gpuTimerSupported || input.gpuSampleCount >= minimumGpuSamples;
  const gpuHeadroom =
    !input.gpuTimerSupported || (input.measurements.gpuFrameMs?.p95 ?? Number.POSITIVE_INFINITY) <= frameBudgetMs();
  const headroomPass =
    input.state === "complete" &&
    input.measurements.totalCpuMs.p95 <= frameBudgetMs() &&
    gpuEvidenceReady &&
    gpuHeadroom;
  const displayLimited =
    input.state === "complete" &&
    input.displayRefreshFps !== null &&
    input.displayRefreshFps < MIN_PRESENTATION_FPS &&
    headroomPass;
  const reasons = resolveFailureReasons({
    displayLimited,
    displayRefreshFps: input.displayRefreshFps,
    frameMs: input.measurements.frameMs,
    gpuEvidenceReady,
    gpuFrameMs: input.measurements.gpuFrameMs,
    gpuTimerSupported: input.gpuTimerSupported,
    headroomPass,
    observedFps: input.measurements.observedFps,
    onScreenPass,
    state: input.state,
    totalCpuMs: input.measurements.totalCpuMs,
  });
  return {
    headroomPass,
    onScreenPass,
    reasons,
    status: resolveStatus(input.state, onScreenPass, displayLimited, headroomPass),
  };
}

function resolveStatus(
  state: ProceduralCharacterPerformanceEvaluationState,
  onScreenPass: boolean,
  displayLimited: boolean,
  headroomPass: boolean,
): ProceduralCharacterPerformanceEvaluationStatus {
  if (state !== "complete") return state;
  if (onScreenPass && headroomPass) return "pass";
  if (displayLimited) return "display-limited";
  return "fail";
}

function resolveFailureReasons(input: {
  displayLimited: boolean;
  displayRefreshFps: number | null;
  frameMs: ProceduralCharacterPerformanceDistribution;
  gpuEvidenceReady: boolean;
  gpuFrameMs: ProceduralCharacterPerformanceDistribution | null;
  gpuTimerSupported: boolean;
  headroomPass: boolean;
  observedFps: number;
  onScreenPass: boolean;
  state: ProceduralCharacterPerformanceEvaluationState;
  totalCpuMs: ProceduralCharacterPerformanceDistribution;
}): string[] {
  if (input.state !== "complete") return [];
  if (input.onScreenPass && input.headroomPass) return [];
  if (input.displayLimited) {
    const evidence = input.gpuTimerSupported
      ? "CPU/GPU work fits the 60 FPS budget"
      : "CPU work fits the 60 FPS budget; GPU timing is unavailable";
    return [`display refresh is ${roundMetric(input.displayRefreshFps)}Hz; ${evidence}`];
  }
  const reasons: string[] = [];
  if (input.observedFps < MIN_PRESENTATION_FPS) {
    reasons.push(`observed ${roundMetric(input.observedFps)} FPS; target is 60 FPS`);
  }
  if (input.frameMs.p95 > frameBudgetMs() + PRESENTATION_FRAME_TOLERANCE_MS) {
    reasons.push(`presentation p95 is ${input.frameMs.p95}ms; budget is 17.17ms`);
  }
  if (input.totalCpuMs.p95 > frameBudgetMs()) {
    reasons.push(`CPU p95 is ${input.totalCpuMs.p95}ms; budget is ${roundMetric(frameBudgetMs())}ms`);
  }
  if (input.gpuTimerSupported && !input.gpuEvidenceReady) reasons.push("GPU timer did not collect enough samples");
  if (input.gpuTimerSupported && (input.gpuFrameMs?.p95 ?? 0) > frameBudgetMs()) {
    reasons.push(`GPU p95 is ${input.gpuFrameMs?.p95}ms; budget is ${roundMetric(frameBudgetMs())}ms`);
  }
  return reasons;
}

function resolveDistribution(samples: readonly number[]): ProceduralCharacterPerformanceDistribution {
  if (samples.length === 0) return { average: 0, p95: 0, p99: 0 };
  const sorted = samples.toSorted((left, right) => left - right);
  return {
    average: roundMetric(samples.reduce((sum, value) => sum + value, 0) / samples.length) ?? 0,
    p95: roundMetric(readPercentile(sorted, 0.95)) ?? 0,
    p99: roundMetric(readPercentile(sorted, 0.99)) ?? 0,
  };
}

function readPercentile(sorted: readonly number[], percentile: number): number {
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * percentile))] ?? 0;
}

function resolveFrameBudgetHitRate(samples: readonly number[]): number {
  if (samples.length === 0) return 0;
  const hits = samples.filter((sample) => sample <= frameBudgetMs()).length;
  return hits / samples.length;
}

function isFiniteFrameSample(sample: ProceduralCharacterPerformanceFrameSample): boolean {
  return (
    normalizePositiveMetric(sample.frameMs) !== null &&
    isFiniteNonNegativeMetric(sample.animationCpuMs) &&
    isFiniteNonNegativeMetric(sample.renderCpuMs) &&
    isFiniteNonNegativeMetric(sample.totalCpuMs)
  );
}

function isFiniteNonNegativeMetric(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

function normalizePositiveMetric(value: number): number | null {
  return Number.isFinite(value) && value > 0 ? value : null;
}

function roundMetric(value: number | null): number | null {
  return value === null ? null : Number(value.toFixed(2));
}

function frameBudgetMs(): number {
  return PROCEDURAL_CHARACTER_FRAME_BUDGET_MS;
}
