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

  it("overlaps at most four mesh parts and preserves their world transforms and visibility", async () => {
    const model = new Group();
    model.position.set(2, 3, 4);
    const meshes = Array.from({ length: 7 }, () => new Mesh());
    const hidden = new Mesh();
    hidden.visible = false;
    model.add(...meshes, hidden);
    const pending: Array<() => void> = [];
    const compileAsync = vi.fn((_object: Object3D) => new Promise<void>((resolve) => pending.push(resolve)));
    const scene = new Scene();
    const camera = new PerspectiveCamera();
    const compile = createPipelineCompiler({ getRenderer: () => ({ compileAsync }), getCamera: () => camera });

    const completed = compile(model, scene);
    expect(compileAsync).toHaveBeenCalledTimes(4);
    expect(meshes[0].matrixWorld.elements.slice(12, 15)).toEqual([2, 3, 4]);
    pending.shift()!();
    await vi.waitFor(() => expect(compileAsync).toHaveBeenCalledTimes(5));
    pending.splice(0).forEach((resolve) => resolve());
    await vi.waitFor(() => expect(compileAsync).toHaveBeenCalledTimes(7));
    pending.splice(0).forEach((resolve) => resolve());
    await completed;
    expect(compileAsync.mock.calls.map((call) => call[0])).toEqual(meshes);
    expect(compileAsync).toHaveBeenLastCalledWith(meshes[6], camera, scene);
  });

  it("waits for active sibling compiles before rejecting so the owner can safely dispose", async () => {
    const model = new Group().add(new Mesh(), new Mesh());
    let finishSibling!: () => void;
    const error = new Error("compile failed");
    const compileAsync = vi
      .fn()
      .mockRejectedValueOnce(error)
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            finishSibling = resolve;
          }),
      );
    const compile = createPipelineCompiler({
      getRenderer: () => ({ compileAsync }),
      getCamera: () => new PerspectiveCamera(),
    });
    const rejected = vi.fn();
    const completed = compile(model, new Scene()).catch(rejected);
    await Promise.resolve();
    await Promise.resolve();
    expect(rejected).not.toHaveBeenCalled();
    finishSibling();
    await completed;
    expect(rejected).toHaveBeenCalledWith(error);
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
