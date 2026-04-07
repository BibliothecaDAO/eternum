// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

const createRendererInteractionRuntime = vi.fn();
const createRendererLabelRuntime = vi.fn();

vi.mock("./renderer-interaction-runtime", () => ({
  createRendererInteractionRuntime,
}));

vi.mock("./renderer-label-runtime", () => ({
  createRendererLabelRuntime,
}));

const { createRendererFoundationRuntime } = await import("./renderer-foundation-runtime");

describe("createRendererFoundationRuntime", () => {
  it("creates the interaction and label runtimes and exposes the interaction primitives", () => {
    const interactionRuntime = {
      camera: { id: "camera" },
      pointer: { id: "pointer" },
      raycaster: { id: "raycaster" },
    };
    const labelRuntime = {
      initialize: vi.fn(async () => {}),
    };
    createRendererInteractionRuntime.mockReturnValue(interactionRuntime);
    createRendererLabelRuntime.mockReturnValue(labelRuntime);
    const warn = vi.fn();

    const runtime = createRendererFoundationRuntime({
      graphicsSetting: "HIGH" as never,
      isMobileDevice: false,
      onControlsChange: vi.fn(),
      resolveCurrentSceneName: vi.fn(),
      warn,
    });

    expect(createRendererInteractionRuntime).toHaveBeenCalledTimes(1);
    expect(createRendererLabelRuntime).toHaveBeenCalledWith({
      isMobileDevice: false,
    });
    expect(labelRuntime.initialize).toHaveBeenCalledTimes(1);
    expect(runtime.interactionRuntime).toBe(interactionRuntime);
    expect(runtime.labelRuntime).toBe(labelRuntime);
    expect(runtime.camera).toBe(interactionRuntime.camera);
    expect(runtime.raycaster).toBe(interactionRuntime.raycaster);
    expect(runtime.pointer).toBe(interactionRuntime.pointer);
    expect(warn).not.toHaveBeenCalled();
  });

  it("warns when label runtime initialization fails", async () => {
    const error = new Error("boom");
    createRendererInteractionRuntime.mockReturnValue({
      camera: { id: "camera" },
      pointer: { id: "pointer" },
      raycaster: { id: "raycaster" },
    });
    createRendererLabelRuntime.mockReturnValue({
      initialize: vi.fn(async () => {
        throw error;
      }),
    });
    const warn = vi.fn();

    createRendererFoundationRuntime({
      graphicsSetting: "HIGH" as never,
      isMobileDevice: true,
      onControlsChange: vi.fn(),
      resolveCurrentSceneName: vi.fn(),
      warn,
    });

    await Promise.resolve();

    expect(warn).toHaveBeenCalledWith("GameRenderer: Failed to initialize label renderer:", error);
  });
});
