import { StrictMode, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { EndgameMistLabView } from "./view";

const renderer = vi.hoisted(() => ({
  mount: vi.fn(),
  playEndgame: vi.fn(),
  skipEndgame: vi.fn(),
  resetEndgame: vi.fn(),
  dispose: vi.fn(),
}));
vi.mock("@/three/debug/procedural-terrain-debug-renderer", () => ({
  mountProceduralTerrainDebugRenderer: renderer.mount,
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root;
let host: HTMLDivElement;
afterEach(async () => {
  await act(async () => root?.unmount());
  host?.remove();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

it("mounts one renderer under development remount, opens Results during the effect and releases the renderer", async () => {
  const frames = new Map<number, FrameRequestCallback>();
  let next = 0;
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
    frames.set(++next, cb);
    return next;
  });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => {
    frames.delete(id);
  });
  renderer.mount.mockResolvedValue({ ...renderer, getStats: () => ({}), seekEndgame: vi.fn() });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () =>
    root.render(
      <StrictMode>
        <MemoryRouter initialEntries={["/lab/endgame"]}>
          <EndgameMistLabView />
        </MemoryRouter>
      </StrictMode>,
    ),
  );
  expect(host.querySelector('[aria-label="Sequence"]')).toBeNull();
  expect(host.querySelector("h1")?.textContent).toBe("Fractured veil");
  expect(renderer.mount).not.toHaveBeenCalled();
  expect(frames.size).toBe(1);
  await act(async () => {
    for (const callback of frames.values()) callback(0);
    frames.clear();
  });
  expect(renderer.mount).toHaveBeenCalledTimes(1);
  const click = async (label: string) => {
    const button = [...host.querySelectorAll("button")].find((b) => b.textContent === label)!;
    expect(button.disabled).toBe(false);
    await act(async () => button.click());
  };
  await click("End game preview");
  expect(renderer.playEndgame).toHaveBeenCalledTimes(1);
  await click("See the results");
  expect(renderer.skipEndgame).toHaveBeenCalledTimes(1);
  expect(host.querySelector('[role="dialog"][aria-label="Results fixture"]')).not.toBeNull();
  await click("Back to the frozen map");
  await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
  expect(renderer.skipEndgame).toHaveBeenCalledTimes(2);
  await act(async () => root.unmount());
  expect(renderer.dispose).toHaveBeenCalledTimes(1);
});
