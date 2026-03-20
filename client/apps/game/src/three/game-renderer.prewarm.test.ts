import { describe, expect, it, vi } from "vitest";

import { requestRendererScenePrewarm } from "./webgpu-postprocess-policy";

describe("requestRendererScenePrewarm runtime behavior", () => {
  it("calls compileAsync on the renderer with the scene and camera", async () => {
    const compileAsync = vi.fn().mockResolvedValue(undefined);
    const renderer = { compileAsync };
    const scene = { id: "scene" };
    const camera = { id: "camera" };

    await requestRendererScenePrewarm(renderer as never, scene as never, camera as never);

    expect(compileAsync).toHaveBeenCalledTimes(1);
    expect(compileAsync).toHaveBeenCalledWith(scene, camera);
  });

  it("no-ops safely when renderer is undefined", async () => {
    await expect(
      requestRendererScenePrewarm(undefined, { id: "scene" } as never, { id: "camera" } as never),
    ).resolves.toBeUndefined();
  });

  it("no-ops safely when renderer lacks compileAsync", async () => {
    const renderer = { render: vi.fn() };

    await expect(
      requestRendererScenePrewarm(renderer as never, { id: "scene" } as never, { id: "camera" } as never),
    ).resolves.toBeUndefined();
  });
});
