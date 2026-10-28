import { PerspectiveCamera, Group, Scene, Mesh, PointLight, type Object3D } from "three";
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

  it("serializes whole-model preparation across compiler owners sharing one renderer", async () => {
    const pending: Array<() => void> = [];
    const compileAsync = vi.fn(() => new Promise<void>((resolve) => pending.push(resolve)));
    const renderer = { compileAsync };
    const camera = new PerspectiveCamera();
    const firstCompiler = createPipelineCompiler({ getRenderer: () => renderer, getCamera: () => camera });
    const secondCompiler = createPipelineCompiler({ getRenderer: () => renderer, getCamera: () => camera });
    const first = new Group().add(new Mesh(), new Mesh());
    const second = new Group().add(new Mesh(), new Mesh());
    const scene = new Scene();
    const firstDone = firstCompiler(first, scene);
    const secondDone = secondCompiler(second, scene);
    await vi.waitFor(() => expect(compileAsync).toHaveBeenCalledTimes(1));
    expect(compileAsync).toHaveBeenLastCalledWith(first, camera, scene);
    pending.shift()!();
    await firstDone;
    await vi.waitFor(() => expect(compileAsync).toHaveBeenCalledTimes(2));
    expect(compileAsync).toHaveBeenLastCalledWith(second, camera, scene);
    pending.shift()!();
    await secondDone;
  });

  it("propagates a failed preparation and still prepares the next queued model", async () => {
    const error = new Error("compile failed");
    const compileAsync = vi.fn().mockRejectedValueOnce(error).mockResolvedValueOnce(undefined);
    const renderer = { compileAsync };
    const compile = createPipelineCompiler({ getRenderer: () => renderer, getCamera: () => new PerspectiveCamera() });
    const failed = compile(new Group().add(new Mesh(), new Mesh()), new Scene());
    const next = compile(new Group(), new Scene());
    await expect(failed).rejects.toBe(error);
    await expect(next).resolves.toBeUndefined();
    expect(compileAsync).toHaveBeenCalledTimes(2);
  });

  it("keeps groups with lights or nested objects intact", async () => {
    const compileAsync = vi.fn(async (_object: Object3D) => undefined);
    const compile = createPipelineCompiler({
      getRenderer: () => ({ compileAsync }),
      getCamera: () => new PerspectiveCamera(),
    });
    const model = new Group().add(new Mesh(), new PointLight());
    await compile(model, new Scene());
    expect(compileAsync.mock.calls[0][0]).toBe(model);
    const nested = new Group().add(new Group().add(new Mesh()), new Mesh());
    await compile(nested, new Scene());
    expect(compileAsync.mock.calls[1][0]).toBe(nested);
  });
});
