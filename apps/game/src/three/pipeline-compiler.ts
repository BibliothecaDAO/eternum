import type { Camera, Object3D, Scene } from "three";
import { incrementWorldmapRenderCounter, recordWorldmapRenderDuration } from "./perf/worldmap-render-diagnostics";

/** Prepares an object's material pipelines against its destination scene before attachment. */
export type PipelineCompiler = (object: Object3D, targetScene: Scene) => Promise<void>;

export interface PipelineCompilingRenderer {
  compileAsync?(object: Object3D, camera: Camera, targetScene?: Scene | null): Promise<unknown>;
}

const pendingRendererCompiles = new WeakMap<PipelineCompilingRenderer, Promise<void>>();

// Compiles queued or running in this page, and the callers waiting for none to be.
let compilesInFlight = 0;
let settleWaiters: Array<() => void> = [];

/**
 * Resolves "settled" once no pipeline compile is queued or running, checked a task after the last one ends, so a
 * manager that compiles its models one after another is not read as done between two of them; "timed-out" after
 * `atMostMs`, so a compile that never ends cannot hold its caller.
 */
export function whenPipelineCompilesSettle(atMostMs: number): Promise<"settled" | "timed-out"> {
  if (compilesInFlight === 0) return Promise.resolve("settled");
  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve("timed-out"), atMostMs);
    settleWaiters.push(() => {
      clearTimeout(timeout);
      resolve("settled");
    });
  });
}

function endCompile(): void {
  compilesInFlight -= 1;
  if (compilesInFlight > 0) return;
  setTimeout(() => {
    if (compilesInFlight > 0) return;
    const waiters = settleWaiters;
    settleWaiters = [];
    waiters.forEach((resolve) => resolve());
  }, 0);
}

export function createPipelineCompiler(input: {
  getRenderer: () => PipelineCompilingRenderer | undefined;
  getCamera: () => Camera;
}): PipelineCompiler {
  let warnedMissingCompile = false;
  return async (object, targetScene) => {
    const renderer = input.getRenderer();
    if (!renderer?.compileAsync) {
      if (!warnedMissingCompile && import.meta.env?.DEV) {
        warnedMissingCompile = true;
        console.warn("[PipelineCompiler] renderer has no compileAsync; pipelines compile on first draw");
      }
      return;
    }
    const startedAt = performance.now();
    compilesInFlight += 1;
    try {
      const camera = input.getCamera();
      await serializeRendererCompile(renderer, () => renderer.compileAsync!(object, camera, targetScene));
      incrementWorldmapRenderCounter("pipelinePrecompiles");
    } finally {
      recordWorldmapRenderDuration("pipelineCompileMs", performance.now() - startedAt);
      endCompile();
    }
  };
}

/** Shared material node builders cannot prepare overlapping WebGPU binding layouts safely. */
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
