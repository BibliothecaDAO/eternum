import { PerspectiveCamera, Group, Scene } from "three";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPipelineCompiler } from "./pipeline-compiler";
import { resetWorldmapRenderDiagnostics, snapshotWorldmapRenderDiagnostics } from "./perf/worldmap-render-diagnostics";

describe("createPipelineCompiler", () => {
  beforeEach(() => resetWorldmapRenderDiagnostics());
  afterEach(() => vi.restoreAllMocks());

  it("records elapsed compilation time even when pipeline preparation fails", async () => {
    vi.spyOn(performance, "now").mockReturnValueOnce(100).mockReturnValueOnce(350);
    const failure = new Error("pipeline failed");
    const compile = createPipelineCompiler({
      getRenderer: () => ({
        compileAsync: async () => {
          throw failure;
        },
      }),
      getCamera: () => new PerspectiveCamera(),
    });
    await expect(compile(new Group(), new Scene())).rejects.toBe(failure);
    const diagnostics = snapshotWorldmapRenderDiagnostics();
    expect(diagnostics.durations.pipelineCompileMs.samples).toEqual([250]);
    expect(diagnostics.counters.pipelinePrecompiles).toBe(0);
  });
  it("compiles the object against the target scene with the live renderer and camera", async () => {
    const compileAsync = vi.fn(async () => undefined);
    const camera = new PerspectiveCamera();
    const scene = new Scene();
    const object = new Group();
    const compile = createPipelineCompiler({ getRenderer: () => ({ compileAsync }), getCamera: () => camera });

    await compile(object, scene);

    expect(compileAsync).toHaveBeenCalledWith(object, camera, scene);
  });

  it("resolves without a renderer that cannot precompile", async () => {
    const compile = createPipelineCompiler({ getRenderer: () => undefined, getCamera: () => new PerspectiveCamera() });
    await expect(compile(new Group(), new Scene())).resolves.toBeUndefined();
  });
});
