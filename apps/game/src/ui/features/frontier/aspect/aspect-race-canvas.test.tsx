import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AspectRaceRendererHandle, MountAspectRaceRendererInput } from "@/three/race/aspect-race-renderer";
import { AspectRaceCanvas } from "./aspect-race-canvas";

const MID_SEASON = {
  standings: [
    { aspectId: 2 as const, height: 6400, finished: false },
    { aspectId: 1 as const, height: 5200, finished: false },
    { aspectId: 3 as const, height: 2800, finished: false },
    { aspectId: 4 as const, height: 900, finished: false },
  ],
  finishHeight: 10_000,
};
const WON = {
  standings: [{ ...MID_SEASON.standings[0]!, height: 10_000, finished: true }, ...MID_SEASON.standings.slice(1)],
  finishHeight: 10_000,
};

const DEEP = { spacing: 100, rings: [{ radius: 7 }, { radius: 11 }, { radius: 15 }, { radius: 19 }] };

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
    const race = MID_SEASON;
    await act(async () => {
      root.render(
        <AspectRaceCanvas standings={race.standings} finishHeight={race.finishHeight} deep={DEEP} surface="shell" />,
      );
    });

    expect(mountAspectRaceRenderer).toHaveBeenCalledTimes(1);
    expect(lastMountInput?.standings).toEqual(race.standings);
    expect(host.querySelector("[data-race-stage]")?.getAttribute("data-ready")).toBe("true");
    expect(mockHandle.setPaused).toHaveBeenLastCalledWith(false);

    act(() => intersectionCallback?.([{ isIntersecting: false }]));
    expect(mockHandle.setPaused).toHaveBeenLastCalledWith(true);

    act(() => intersectionCallback?.([{ isIntersecting: true }]));
    expect(mockHandle.setPaused).toHaveBeenLastCalledWith(false);

    const won = WON;
    await act(async () => {
      root.render(
        <AspectRaceCanvas standings={won.standings} finishHeight={won.finishHeight} deep={DEEP} surface="shell" />,
      );
    });
    expect(mockHandle.setStandings).toHaveBeenLastCalledWith(won.standings, won.finishHeight);

    act(() => root.unmount());
    expect(mockHandle.dispose).toHaveBeenCalledTimes(1);
  });

  it("supports shell and shell-compact variants, skips redundant standings updates, and keeps plates without WebGL", async () => {
    const race = MID_SEASON;
    await act(async () => {
      root.render(
        <AspectRaceCanvas standings={race.standings} finishHeight={race.finishHeight} deep={DEEP} surface="shell" />,
      );
    });
    const shellStage = host.querySelector("[data-race-stage]")!;
    expect(shellStage.getAttribute("data-race-surface")).toBe("shell");
    expect(shellStage.classList.contains("race-stage--shell")).toBe(true);
    const syncedCount = (mockHandle.setStandings as ReturnType<typeof vi.fn>).mock.calls.length;

    await act(async () => {
      root.render(
        <AspectRaceCanvas
          standings={race.standings.map((entry) => ({ ...entry }))}
          finishHeight={race.finishHeight}
          deep={DEEP}
          surface="shell-compact"
        />,
      );
    });
    expect(shellStage.getAttribute("data-race-surface")).toBe("shell-compact");
    expect(shellStage.classList.contains("race-stage--shell-compact")).toBe(true);
    expect(mockHandle.setStandings).toHaveBeenCalledTimes(syncedCount);

    act(() => root.unmount());
    mountAspectRaceRenderer.mockClear();
    HTMLCanvasElement.prototype.getContext = vi.fn(
      () => null,
    ) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    root = createRoot(host);
    await act(async () => {
      root.render(
        <AspectRaceCanvas
          standings={race.standings}
          finishHeight={race.finishHeight}
          deep={DEEP}
          surface="shell-compact"
        />,
      );
    });
    expect(mountAspectRaceRenderer).not.toHaveBeenCalled();
    expect(host.querySelector("[data-race-stage]")?.getAttribute("data-race-surface")).toBe("shell-compact");
    expect(host.querySelectorAll(".race-stage__plate")).toHaveLength(4);
  });
});
