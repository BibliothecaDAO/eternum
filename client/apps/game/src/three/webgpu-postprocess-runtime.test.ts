import { beforeEach, describe, expect, it, vi } from "vitest";

import { createWebGPUPostProcessRuntime } from "./webgpu-postprocess-runtime";
import type { RendererPostProcessPlan } from "./renderer-backend-v2";

function createPlan(overrides: Partial<RendererPostProcessPlan> = {}): RendererPostProcessPlan {
  return {
    antiAlias: "none",
    bloom: {
      enabled: false,
      intensity: 0,
    },
    chromaticAberration: {
      enabled: false,
    },
    colorGrade: {
      brightness: 0,
      contrast: 0,
      hue: 0,
      saturation: 0,
    },
    toneMapping: {
      exposure: 1.25,
      mode: "cineon",
      whitePoint: 1,
    },
    vignette: {
      darkness: 0,
      enabled: false,
      offset: 0,
    },
    ...overrides,
  };
}

describe("createWebGPUPostProcessRuntime", () => {
  beforeEach(() => {
    vi.stubGlobal("window", {
      innerHeight: 720,
      innerWidth: 1280,
    });
  });

  it("routes the scene through renderOutput with explicit output transforms", () => {
    const renderer = {
      clear: vi.fn(),
      clearDepth: vi.fn(),
      info: {
        reset: vi.fn(),
      },
      outputColorSpace: "srgb",
      render: vi.fn(),
      toneMapping: 0,
      toneMappingExposure: 0,
    };
    const postProcessing = {
      dispose: vi.fn(),
      needsUpdate: false,
      outputColorTransform: true,
      outputNode: null,
      render: vi.fn(),
    };
    const sceneColorNode = { id: "scene-color-node" };
    const scenePass = {
      camera: null,
      getTextureNode: vi.fn(() => sceneColorNode),
      scene: null,
      setMRT: vi.fn(),
    };
    const outputNode = { id: "output-node" };
    const createPass = vi.fn(() => scenePass);
    const createRenderOutput = vi.fn(() => outputNode);

    const runtime = createWebGPUPostProcessRuntime(
      {
        renderer: renderer as never,
      },
      {
        createPass,
        createPostProcessing: vi.fn(() => postProcessing as never),
        createRenderOutput,
      },
    );

    runtime.setPlan(createPlan());
    runtime.renderFrame({
      mainCamera: { id: "main-camera" } as never,
      mainScene: { id: "main-scene" } as never,
      overlayCamera: { id: "overlay-camera" } as never,
      overlayScene: { id: "overlay-scene" } as never,
    });

    expect(createPass).toHaveBeenCalledWith({ id: "main-scene" }, { id: "main-camera" });
    expect(scenePass.getTextureNode).toHaveBeenCalledWith("output");
    expect(createRenderOutput).toHaveBeenCalledWith(sceneColorNode, renderer.toneMapping, "srgb");
    expect(postProcessing.outputColorTransform).toBe(false);
    expect(postProcessing.outputNode).toBe(outputNode);
    expect(postProcessing.needsUpdate).toBe(true);
    expect(renderer.toneMappingExposure).toBe(1.25);
    expect(postProcessing.render).toHaveBeenCalledTimes(1);
    expect(renderer.clearDepth).toHaveBeenCalledTimes(1);
    expect(renderer.render).toHaveBeenCalledWith({ id: "overlay-scene" }, { id: "overlay-camera" });
  });

  it("falls back to the live renderer tone mapping when no explicit plan has been applied yet", () => {
    const renderer = {
      clear: vi.fn(),
      clearDepth: vi.fn(),
      info: {
        reset: vi.fn(),
      },
      outputColorSpace: "srgb",
      render: vi.fn(),
      toneMapping: 7,
      toneMappingExposure: 0.9,
    };
    const postProcessing = {
      dispose: vi.fn(),
      needsUpdate: false,
      outputColorTransform: true,
      outputNode: null,
      render: vi.fn(),
    };
    const sceneColorNode = { id: "scene-color-node" };
    const scenePass = {
      camera: null,
      getTextureNode: vi.fn(() => sceneColorNode),
      scene: null,
      setMRT: vi.fn(),
    };
    const outputNode = { id: "output-node" };
    const createRenderOutput = vi.fn(() => outputNode);

    const runtime = createWebGPUPostProcessRuntime(
      {
        renderer: renderer as never,
      },
      {
        createPass: vi.fn(() => scenePass),
        createPostProcessing: vi.fn(() => postProcessing as never),
        createRenderOutput,
      },
    );

    runtime.renderFrame({
      mainCamera: { id: "main-camera" } as never,
      mainScene: { id: "main-scene" } as never,
    });

    expect(createRenderOutput).toHaveBeenCalledWith(sceneColorNode, 7, "srgb");
    expect(postProcessing.outputNode).toBe(outputNode);
    expect(postProcessing.render).toHaveBeenCalledTimes(1);
  });

  it("builds bloom from the emissive mrt output when bloom is enabled", () => {
    const renderer = {
      clear: vi.fn(),
      clearDepth: vi.fn(),
      info: {
        reset: vi.fn(),
      },
      outputColorSpace: "srgb",
      render: vi.fn(),
      toneMapping: 0,
      toneMappingExposure: 0,
    };
    const postProcessing = {
      dispose: vi.fn(),
      needsUpdate: false,
      outputColorTransform: true,
      outputNode: null,
      render: vi.fn(),
    };
    const bloomNode = { id: "bloom-node" };
    const combinedOutputNode = { id: "combined-output-node" };
    const emissiveNode = { id: "emissive-node" };
    const sceneColorNode = {
      add: vi.fn(() => combinedOutputNode),
      id: "scene-color-node",
    };
    const scenePass = {
      camera: null,
      getTextureNode: vi.fn((name?: string) => (name === "emissive" ? emissiveNode : sceneColorNode)),
      scene: null,
      setMRT: vi.fn(),
    };
    const mrtNode = { id: "mrt-node" };
    const outputNode = { id: "output-node" };
    const createBloom = vi.fn(() => bloomNode);
    const createRenderOutput = vi.fn(() => outputNode);

    const runtime = createWebGPUPostProcessRuntime(
      {
        renderer: renderer as never,
      },
      {
        createBloom,
        createBloomMrt: vi.fn(() => mrtNode),
        createPass: vi.fn(() => scenePass),
        createPostProcessing: vi.fn(() => postProcessing as never),
        createRenderOutput,
      },
    );

    runtime.setPlan(
      createPlan({
        bloom: {
          enabled: true,
          intensity: 0.4,
        },
      }),
    );
    runtime.renderFrame({
      mainCamera: { id: "main-camera" } as never,
      mainScene: { id: "main-scene" } as never,
    });

    expect(scenePass.setMRT).toHaveBeenCalledWith(mrtNode);
    expect(scenePass.setMRT.mock.invocationCallOrder[0]).toBeLessThan(scenePass.getTextureNode.mock.invocationCallOrder[0]);
    expect(scenePass.getTextureNode).toHaveBeenCalledWith("emissive");
    expect(createBloom).toHaveBeenCalledWith(emissiveNode, 0.4);
    expect(sceneColorNode.add).toHaveBeenCalledWith(bloomNode);
    expect(createRenderOutput).toHaveBeenCalledWith(combinedOutputNode, renderer.toneMapping, "srgb");
  });
});
