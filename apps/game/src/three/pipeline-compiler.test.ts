import { PerspectiveCamera, Group, Scene } from "three";
import { describe, expect, it, vi } from "vitest";
import { createPipelineCompiler } from "./pipeline-compiler";

describe("createPipelineCompiler", () => {
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
