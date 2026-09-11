import type { Camera, Group, Mesh, Object3D, Scene } from "three";
import { incrementWorldmapRenderCounter, recordWorldmapRenderDuration } from "./perf/worldmap-render-diagnostics";

/** Compiles an object's render pipelines before its first draw, so the frame that first shows it does not pay for them. */
export type PipelineCompiler = (object: Object3D, targetScene: Scene) => Promise<void>;

export interface PipelineCompilingRenderer {
  compileAsync?(object: Object3D, camera: Camera, targetScene?: Scene | null): Promise<unknown>;
}

const MODEL_COMPILE_CONCURRENCY = 4;

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
    try {
      const camera = input.getCamera();
      await compileModelParts(object, (part) => renderer.compileAsync!(part, camera, targetScene));
      incrementWorldmapRenderCounter("pipelinePrecompiles");
    } finally {
      recordWorldmapRenderDuration("pipelineCompileMs", performance.now() - startedAt);
    }
  };
}

async function compileModelParts(object: Object3D, compile: (part: Object3D) => Promise<unknown>): Promise<void> {
  const parts = resolveIndependentModelParts(object);
  // Three prepares a compound model serially. The rift took 10s in an entry
  // capture; overlap a bounded number of parts while retaining the first-draw readiness gate.
  const workers = Array.from({ length: Math.min(MODEL_COMPILE_CONCURRENCY, parts.length) }, async () => {
    for (let part = parts.shift(); part; part = parts.shift()) await compile(part);
  });
  const results = await Promise.allSettled(workers);
  // Owners may dispose the model on rejection; let every active compile settle first.
  const failure = results.find((result) => result.status === "rejected");
  if (failure?.status === "rejected") throw failure.reason;
}

function resolveIndependentModelParts(object: Object3D): Object3D[] {
  const isFlatMeshGroup =
    (object as Group).isGroup &&
    object.visible &&
    object.children.length > 1 &&
    object.children.every((child) => (child as Mesh).isMesh && child.children.length === 0);
  if (!isFlatMeshGroup) return [object];

  // Compiling a child directly must retain its parent's authored transform. Hierarchies
  // containing lights or other node types stay intact for Three's normal traversal.
  object.updateWorldMatrix(true, true);
  return object.children.filter((child) => child.visible);
}
