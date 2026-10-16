// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Mesh, type Scene } from "three";
import { resolveDebugChunkScenario } from "./three-chunk-debug-fixture";
import { mountThreeChunkDebugRenderer } from "./three-chunk-debug-renderer";

const initialize = vi.hoisted(() => vi.fn());
vi.mock("../renderer-backend-runtime", () => ({ initializeRendererBackendRuntime: initialize }));
vi.mock("../../../env", () => ({ env: { VITE_PUBLIC_RENDERER_BUILD_MODE: "webgpu-auto" } }));
vi.mock("../../utils/pointer", () => ({ isCoarsePointer: () => false }));

const disconnect = vi.fn();
let tick: FrameRequestCallback;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect = disconnect;
    },
  );
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn((callback: FrameRequestCallback) => {
      tick = callback;
      return 1;
    }),
  );
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
});

afterEach(() => vi.unstubAllGlobals());

function createRuntime() {
  return {
    backend: { dispose: vi.fn(), resize: vi.fn(), renderFrame: vi.fn() },
    renderer: {
      domElement: document.createElement("canvas"),
      info: { render: { calls: 50, drawCalls: 4, triangles: 301 } },
    },
  };
}

it("renders the selected fixture through the shared backend and releases its canvas and geometry", async () => {
  const runtime = createRuntime();
  initialize.mockResolvedValue(runtime);
  const container = document.createElement("div");
  vi.spyOn(container, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 800, 600));
  const onFrame = vi.fn();
  const handle = await mountThreeChunkDebugRenderer({
    container,
    scenario: resolveDebugChunkScenario("baseline"),
    signal: new AbortController().signal,
    onFrame,
  });
  expect(container.querySelector("canvas")).toBe(runtime.renderer.domElement);
  expect(runtime.backend.resize).toHaveBeenCalledWith(800, 600);
  tick(performance.now() + 300);
  const pipeline = runtime.backend.renderFrame.mock.calls[0][0];
  expect(pipeline.sceneName).toBe("three-chunks");
  const scene = pipeline.mainScene as Scene;
  expect(scene.getObjectByName("three-chunk-debug-instanced-chunks")).toMatchObject({ count: 25 });
  expect(onFrame).toHaveBeenCalledWith(expect.objectContaining({ drawCalls: 4, triangles: 301, renderedChunks: 25 }));
  pipeline.mainCamera.position.set(1, 2, 3);
  handle.resetCamera();
  expect(pipeline.mainCamera.position.y).toBeCloseTo(57.6);
  const geometryDisposed = vi.fn();
  scene.traverse((object) => {
    if (object instanceof Mesh) object.geometry.addEventListener("dispose", geometryDisposed);
  });
  handle.dispose();
  handle.dispose();
  expect(geometryDisposed).toHaveBeenCalledTimes(1);
  expect(runtime.backend.dispose).toHaveBeenCalledTimes(1);
  expect(disconnect).toHaveBeenCalledTimes(1);
  expect(cancelAnimationFrame).toHaveBeenCalledWith(1);
  expect(container.childElementCount).toBe(0);
  tick(performance.now() + 600);
  expect(runtime.backend.renderFrame).toHaveBeenCalledTimes(1);
});

it("disposes a late backend when navigation cancels initialization", async () => {
  const runtime = createRuntime();
  let complete!: (value: typeof runtime) => void;
  initialize.mockReturnValue(
    new Promise((resolve) => {
      complete = resolve;
    }),
  );
  const controller = new AbortController();
  const container = document.createElement("div");
  const mounting = mountThreeChunkDebugRenderer({
    container,
    scenario: resolveDebugChunkScenario("stress"),
    signal: controller.signal,
  });
  controller.abort();
  complete(runtime);
  await expect(mounting).rejects.toMatchObject({ name: "AbortError" });
  expect(runtime.backend.dispose).toHaveBeenCalledTimes(1);
  expect(container.childElementCount).toBe(0);
  expect(requestAnimationFrame).not.toHaveBeenCalled();
});
