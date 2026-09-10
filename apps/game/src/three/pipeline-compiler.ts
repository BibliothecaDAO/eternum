import type { Camera, Object3D, Scene } from "three";
import { incrementWorldmapRenderCounter, recordWorldmapRenderDuration } from "./perf/worldmap-render-diagnostics";

/** Compiles an object's render pipelines before its first draw, so the frame that first shows it does not pay for them. */
export type PipelineCompiler = (object: Object3D, targetScene: Scene) => Promise<void>;

export interface PipelineCompilingRenderer {
  compileAsync?(object: Object3D, camera: Camera, targetScene?: Scene | null): Promise<unknown>;
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
    try {
      await renderer.compileAsync(object, input.getCamera(), targetScene);
      incrementWorldmapRenderCounter("pipelinePrecompiles");
    } finally {
      recordWorldmapRenderDuration("pipelineCompileMs", performance.now() - startedAt);
    }
  };
}
