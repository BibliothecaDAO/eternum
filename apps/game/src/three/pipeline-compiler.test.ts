import {
  BoxGeometry,
  DirectionalLight,
  Group,
  HalfFloatType,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  PointLight,
  RenderTarget,
  Scene,
  Texture,
  type Object3D,
} from "three";
import type { WebGPURenderer } from "three/webgpu";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MapFinish } from "./map-finish";
import { createPipelineCompiler, warmTexturePipeline } from "./pipeline-compiler";
import { resetWorldmapRenderDiagnostics, snapshotWorldmapRenderDiagnostics } from "./perf/worldmap-render-diagnostics";

describe("createPipelineCompiler", () => {
  beforeEach(() => resetWorldmapRenderDiagnostics());
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

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

  it("initializes every unique texture and temporarily disables frustum culling and restores flags", async () => {
    const sharedMap = new Texture();
    const normalMap = new Texture();
    const matA = new MeshStandardMaterial({ map: sharedMap, normalMap });
    const matB = new MeshStandardMaterial({ map: sharedMap });
    const meshA = new Mesh(new BoxGeometry(), matA);
    const meshB = new Mesh(new BoxGeometry(), [matB]);
    meshA.frustumCulled = true;
    meshB.frustumCulled = true;
    meshB.visible = false;
    const root = new Group().add(meshA, meshB);

    const initTexture = vi.fn();
    let cullingDuringCompile: boolean[] = [];
    let visibilityDuringCompile: boolean[] = [];
    const compileAsync = vi.fn(async () => {
      cullingDuringCompile = [meshA.frustumCulled, meshB.frustumCulled];
      visibilityDuringCompile = [meshA.visible, meshB.visible];
    });
    const compile = createPipelineCompiler({
      getRenderer: () => ({ compileAsync, initTexture }),
      getCamera: () => new PerspectiveCamera(),
    });

    await compile(root, new Scene());

    expect(initTexture).toHaveBeenCalledTimes(2);
    expect(initTexture).toHaveBeenCalledWith(sharedMap);
    expect(initTexture).toHaveBeenCalledWith(normalMap);
    expect(cullingDuringCompile).toEqual([false, false]);
    expect(visibilityDuringCompile).toEqual([true, true]);
    expect(meshA.frustumCulled).toBe(true);
    expect(meshB.frustumCulled).toBe(true);
    expect(meshB.visible).toBe(false);
  });

  it("compiles against MapFinish MRT renderTarget and shadow pass for shadow casters then restores state", async () => {
    vi.stubGlobal(
      "Image",
      class {
        src = "";
        onload: (() => void) | null = null;
      },
    );
    const scene = new Scene();
    const camera = new PerspectiveCamera();
    const sun = new DirectionalLight();
    sun.castShadow = true;
    const shadowMap = new RenderTarget(512, 512);
    sun.shadow.map = shadowMap;
    scene.add(sun);

    const caster = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
    caster.castShadow = true;
    const nonCaster = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
    nonCaster.castShadow = false;
    const model = new Group().add(caster, nonCaster);

    let activeTarget: RenderTarget | null = null;
    let activeMRT: unknown = null;
    const calls: Array<{
      camera: unknown;
      target: RenderTarget | null;
      mrt: unknown;
      overrideShadow: boolean;
      nonCasterVisible: boolean;
      targetTextureTypes: number[];
    }> = [];
    const renderer = {
      samples: 4,
      reversedDepthBuffer: false,
      shadowMap: { enabled: true },
      getOutputBufferType: () => HalfFloatType,
      getRenderTarget: () => activeTarget,
      setRenderTarget: (target: RenderTarget | null) => {
        activeTarget = target;
      },
      getMRT: () => activeMRT,
      setMRT: (mrtNode: unknown) => {
        activeMRT = mrtNode;
      },
      initTexture: vi.fn(),
      compileAsync: vi.fn(async (_object: Object3D, compileCamera: unknown, targetScene: Scene) => {
        calls.push({
          camera: compileCamera,
          target: activeTarget,
          mrt: activeMRT,
          overrideShadow: Boolean(
            (targetScene.overrideMaterial as { isShadowPassMaterial?: boolean } | null)?.isShadowPassMaterial,
          ),
          nonCasterVisible: nonCaster.visible,
          targetTextureTypes: activeTarget ? activeTarget.textures.map((texture) => texture.type) : [],
        });
      }),
    };

    const finish = new MapFinish(renderer as unknown as WebGPURenderer);
    const compile = createPipelineCompiler({
      getRenderer: () => renderer,
      getCamera: () => camera,
      compileObjectAsync: (object, viewer, targetScene) => finish.compileObjectAsync(object, viewer, targetScene),
    });

    await compile(model, scene);

    expect(calls).toHaveLength(2);
    expect(calls[0].camera).toBe(camera);
    expect(calls[0].target).not.toBeNull();
    expect(calls[0].target?.samples).toBe(4);
    expect(calls[0].targetTextureTypes).toEqual([HalfFloatType, HalfFloatType]);
    expect(calls[0].mrt).not.toBeNull();
    expect(calls[0].overrideShadow).toBe(false);
    expect(calls[0].nonCasterVisible).toBe(true);

    expect(calls[1].camera).toBe(sun.shadow.camera);
    expect(calls[1].target).toBe(shadowMap);
    expect(calls[1].mrt).toBeNull();
    expect(calls[1].overrideShadow).toBe(true);
    expect(calls[1].nonCasterVisible).toBe(false);

    expect(activeTarget).toBeNull();
    expect(activeMRT).toBeNull();
    expect(scene.overrideMaterial).toBeNull();
    expect(nonCaster.visible).toBe(true);
    finish.dispose();
    shadowMap.dispose();
  });

  it("warms standalone textures through the shared pipeline compiler chokepoint", async () => {
    const texture = new Texture();
    const scene = new Scene();
    const initTexture = vi.fn();
    const compileAsync = vi.fn(async () => undefined);
    const compile = createPipelineCompiler({
      getRenderer: () => ({ compileAsync, initTexture }),
      getCamera: () => new PerspectiveCamera(),
    });

    await warmTexturePipeline(compile, scene, texture);

    expect(initTexture).toHaveBeenCalledWith(texture);
    expect(compileAsync).toHaveBeenCalledTimes(1);
  });
});
