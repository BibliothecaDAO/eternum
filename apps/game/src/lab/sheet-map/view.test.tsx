import { StrictMode, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { MapContextWorld } from "./view";

const renderer = vi.hoisted(() => ({ mount: vi.fn(), dispose: vi.fn() }));
vi.mock("@/three/debug/procedural-terrain-debug-renderer", () => ({
  mountProceduralTerrainDebugRenderer: renderer.mount,
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root, host: HTMLDivElement;
afterEach(async () => {
  await act(async () => root?.unmount());
  host?.remove();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

it("opens the shared sheet's world once, switches through visible controls, and closes its renderer", async () => {
  const frames = new Map<number, FrameRequestCallback>();
  let next = 0;
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    frames.set(++next, callback);
    return next;
  });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => {
    frames.delete(id);
  });
  renderer.mount.mockResolvedValue({ dispose: renderer.dispose });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () =>
    root.render(
      <StrictMode>
        <MemoryRouter initialEntries={["/lab/kit?rendererMode=webgpu-force-webgl"]}>
          <MapContextWorld />
        </MemoryRouter>
      </StrictMode>,
    ),
  );
  expect(host.querySelector("canvas")).toBeNull();
  expect(renderer.mount).not.toHaveBeenCalled();
  const click = async (name: string) => {
    const button = [...host.querySelectorAll("button")].find((button) => button.textContent === name);
    expect(button).toBeDefined();
    await act(async () => button!.click());
  };
  const draw = async () => {
    await act(async () => {
      for (const callback of frames.values()) callback(0);
      frames.clear();
    });
  };
  await click("Open 3D comparison");
  expect(frames.size).toBe(1);
  await draw();
  expect(renderer.mount).toHaveBeenCalledTimes(1);
  expect(renderer.mount.mock.calls[0][0]).toMatchObject({ forceWebGL: true, mapSheet: { chapter: "hexes" } });
  expect(host.querySelector("[data-map-sheet]")?.getAttribute("data-ready")).toBe("true");
  await click("Paths & orders");
  expect(renderer.dispose).toHaveBeenCalledTimes(1);
  await draw();
  expect(renderer.mount).toHaveBeenCalledTimes(2);
  expect(renderer.mount.mock.calls[1][0]).toMatchObject({ forceWebGL: true, mapSheet: { chapter: "routes" } });
  await click("Close 3D comparison");
  expect(renderer.dispose).toHaveBeenCalledTimes(2);
  expect(host.querySelector("canvas")).toBeNull();
});
