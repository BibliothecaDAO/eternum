import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AspectRaceRendererHandle, MountAspectRaceRendererInput } from "@/three/race/aspect-race-renderer";
import { ASPECT_PAGE_CASES } from "./aspect-page-fixtures";
import { AspectRaceCanvas } from "./aspect-race-canvas";

const mockHandle: AspectRaceRendererHandle = {
  setStandings: vi.fn(),
  setPaused: vi.fn(),
  dispose: vi.fn(),
};

let lastMountInput: MountAspectRaceRendererInput | null = null;
const mountAspectRaceRenderer = vi.fn(async (input: MountAspectRaceRendererInput) => {
  lastMountInput = input;
  input.onReady?.();
  return mockHandle;
});

vi.mock("@/three/race/aspect-race-renderer", () => ({
  mountAspectRaceRenderer: (input: MountAspectRaceRendererInput) => mountAspectRaceRenderer(input),
}));

let host: HTMLDivElement;
let root: Root;
let intersectionCallback: ((entries: Array<{ isIntersecting: boolean }>) => void) | null = null;
const originalGetContext = HTMLCanvasElement.prototype.getContext;
const originalResizeObserver = globalThis.ResizeObserver;
const originalIntersectionObserver = globalThis.IntersectionObserver;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  lastMountInput = null;
  vi.clearAllMocks();

  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
    getExtension: () => ({ loseContext: vi.fn() }),
  })) as unknown as typeof HTMLCanvasElement.prototype.getContext;

  globalThis.ResizeObserver = class {
    observe() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;

  globalThis.IntersectionObserver = class {
    constructor(cb: (entries: Array<{ isIntersecting: boolean }>) => void) {
      intersectionCallback = cb;
    }
    observe() {}
    disconnect() {}
  } as unknown as typeof IntersectionObserver;
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  HTMLCanvasElement.prototype.getContext = originalGetContext;
  globalThis.ResizeObserver = originalResizeObserver;
  globalThis.IntersectionObserver = originalIntersectionObserver;
});

describe("AspectRaceCanvas lifecycle", () => {
  it("mounts the production renderer, pauses off-screen, updates standings and disposes on unmount", async () => {
    const race = ASPECT_PAGE_CASES["Mid-season, the player's Aspect second"].race;
    await act(async () => {
      root.render(<AspectRaceCanvas standings={race.standings} finishHeight={race.finishHeight} />);
    });

    expect(mountAspectRaceRenderer).toHaveBeenCalledTimes(1);
    expect(lastMountInput?.standings).toEqual(race.standings);
    expect(host.querySelector("[data-race-stage]")?.getAttribute("data-ready")).toBe("true");
    expect(mockHandle.setPaused).toHaveBeenLastCalledWith(false);

    act(() => intersectionCallback?.([{ isIntersecting: false }]));
    expect(mockHandle.setPaused).toHaveBeenLastCalledWith(true);

    act(() => intersectionCallback?.([{ isIntersecting: true }]));
    expect(mockHandle.setPaused).toHaveBeenLastCalledWith(false);

    const won = ASPECT_PAGE_CASES["Age won by another Aspect"].race;
    await act(async () => {
      root.render(<AspectRaceCanvas standings={won.standings} finishHeight={won.finishHeight} />);
    });
    expect(mockHandle.setStandings).toHaveBeenLastCalledWith(won.standings, won.finishHeight);

    act(() => root.unmount());
    expect(mockHandle.dispose).toHaveBeenCalledTimes(1);
  });
});
