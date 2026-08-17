export const PIPELINE_PREWARM_BUDGET_MS = 10_000;
export const PIPELINE_PREWARM_DISABLED_FOR_P5_MEASUREMENT = true;

let measurementDisableReported = false;

export function shouldSkipPipelinePrewarmForP5Measurement(log: (message: string) => void = console.info): boolean {
  if (!PIPELINE_PREWARM_DISABLED_FOR_P5_MEASUREMENT) {
    return false;
  }
  if (!measurementDisableReported) {
    measurementDisableReported = true;
    log("[GpuBackendPerf] pipeline prewarm disabled for P5 cold-entry measurement");
  }
  return true;
}

export type PipelinePrewarmStatus = "completed" | "timed out";

interface RunTimeboxedPipelinePrewarmInput {
  budgetMs?: number;
  compile: () => Promise<void>;
  enterWarmupView: () => () => void;
  log?: (message: string) => void;
  now?: () => number;
  prepare: () => Promise<void>;
  warn?: (message: string, error: unknown) => void;
}

export async function runTimeboxedPipelinePrewarm({
  budgetMs = PIPELINE_PREWARM_BUDGET_MS,
  compile,
  enterWarmupView,
  log = console.info,
  now = () => performance.now(),
  prepare,
  warn = console.warn,
}: RunTimeboxedPipelinePrewarmInput): Promise<PipelinePrewarmStatus> {
  const startedAt = now();
  let budgetOpen = true;
  const viewLease: { restore: (() => void) | null } = { restore: null };

  const backgroundPrewarm = (async () => {
    await prepare();
    if (budgetOpen) {
      viewLease.restore = enterWarmupView();
    }
    await compile();
  })().catch((error) => {
    warn("[GpuBackendPerf] Pipeline prewarm failed", error);
  });

  const status = await waitForPipelinePrewarm(backgroundPrewarm, budgetMs);
  budgetOpen = false;
  viewLease.restore?.();

  log(`[GpuBackendPerf] pipeline prewarm ${Math.round(now() - startedAt)}ms (${status})`);
  return status;
}

async function waitForPipelinePrewarm(
  backgroundPrewarm: Promise<void>,
  budgetMs: number,
): Promise<PipelinePrewarmStatus> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      backgroundPrewarm.then(() => "completed" as const),
      new Promise<PipelinePrewarmStatus>((resolve) => {
        timeoutId = setTimeout(() => resolve("timed out"), budgetMs);
      }),
    ]);
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
}
