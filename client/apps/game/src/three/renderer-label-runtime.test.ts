// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

const { rendererInstances } = vi.hoisted(() => ({
  rendererInstances: [] as MockCSS2DRenderer[],
}));

class MockCSS2DRenderer {
  public readonly render = vi.fn();
  public readonly setSize = vi.fn();

  constructor(public readonly input: { element: HTMLDivElement }) {
    rendererInstances.push(this);
  }
}

vi.mock("three-stdlib", () => ({
  CSS2DRenderer: MockCSS2DRenderer,
}));

const { createRendererLabelRuntime, waitForRendererLabelElement } = await import("./renderer-label-runtime");

describe("renderer label runtime", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    rendererInstances.length = 0;
  });

  it("rejects label-container polling when disposal happens before the element appears", async () => {
    const rafCallbacks: Array<() => void> = [];
    const state = { disposed: false };

    const waitPromise = waitForRendererLabelElement({
      getElementById: () => null,
      isDisposed: () => state.disposed,
      requestAnimationFrame: (callback) => {
        rafCallbacks.push(callback);
      },
    });

    expect(rafCallbacks).toHaveLength(1);
    state.disposed = true;
    rafCallbacks[0]?.();

    await expect(waitPromise).rejects.toThrow("GameRenderer destroyed while waiting for label renderer element");
  });

  it("creates the CSS2D renderer once the label container is ready", async () => {
    const element = document.createElement("div");
    element.id = "labelrenderer";
    document.body.appendChild(element);
    const runtime = createRendererLabelRuntime({
      isMobileDevice: false,
    });

    await runtime.initialize();

    expect(runtime.isReady()).toBe(true);
    expect(rendererInstances).toHaveLength(1);
    expect(rendererInstances[0]?.input.element).toBe(element);
    expect(rendererInstances[0]?.setSize).toHaveBeenCalledWith(window.innerWidth, window.innerHeight);
  });

  it("tracks dirty label cadence independently from GameRenderer", async () => {
    const element = document.createElement("div");
    element.id = "labelrenderer";
    document.body.appendChild(element);
    const runtime = createRendererLabelRuntime({
      isMobileDevice: false,
    });

    await runtime.initialize();

    expect(
      runtime.shouldRender({
        cadenceView: "close",
        labelsActive: false,
        now: 100,
      }),
    ).toBe(true);
    expect(
      runtime.shouldRender({
        cadenceView: "close",
        labelsActive: false,
        now: 110,
      }),
    ).toBe(false);

    runtime.markDirty();

    expect(
      runtime.shouldRender({
        cadenceView: "close",
        labelsActive: false,
        now: 120,
      }),
    ).toBe(true);
  });

  it("resizes, renders, and clears the label container during disposal", async () => {
    const element = document.createElement("div");
    element.id = "labelrenderer";
    element.appendChild(document.createElement("span"));
    document.body.appendChild(element);
    const runtime = createRendererLabelRuntime({
      isMobileDevice: true,
    });

    await runtime.initialize();

    runtime.resize(320, 180);
    runtime.render("world-scene" as never, "camera" as never);
    runtime.dispose();
    runtime.dispose();

    expect(rendererInstances[0]?.setSize).toHaveBeenNthCalledWith(2, 320, 180);
    expect(rendererInstances[0]?.render).toHaveBeenCalledWith("world-scene", "camera");
    expect(element.childElementCount).toBe(0);
    expect(runtime.isReady()).toBe(false);
  });
});
