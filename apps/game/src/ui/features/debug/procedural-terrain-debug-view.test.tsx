import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountProceduralTerrainDebugRenderer } from "@/three/debug/procedural-terrain-debug-renderer";
import { ProceduralTerrainDebugView } from "./procedural-terrain-debug-view";

vi.mock("@/three/debug/procedural-terrain-debug-renderer", () => ({
  mountProceduralTerrainDebugRenderer: vi.fn(),
}));
vi.mock("@/ui/modules/boot-loader", () => ({ useBootDocumentState: vi.fn() }));
vi.mock("./weather-lab-controls", () => ({ WeatherLabControls: () => null }));
vi.mock("./atmosphere-lab-controls", () => ({ AtmosphereLabControls: () => null }));

describe("terrain lab telemetry and controls", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("updates live metrics without rewriting dropdown selections, and still updates the building count", async () => {
    let buildingInstances = 0;
    let frameMs = 10;
    const getStats = vi.fn(
      () =>
        new Proxy(
          {
            activeMode: "webgl",
            sceneId: "temperate-grove",
            qualityTier: "detail",
            fingerprint: "test",
            buildingInstances,
            frameP50Ms: frameMs,
          },
          { get: (target, key) => Reflect.get(target, key) ?? 0 },
        ),
    );
    const dispose = vi.fn();
    vi.mocked(mountProceduralTerrainDebugRenderer).mockResolvedValue({
      getStats,
      dispose,
      setPreview: vi.fn().mockResolvedValue(undefined),
      setCycleProgress: vi.fn(),
    } as unknown as Awaited<ReturnType<typeof mountProceduralTerrainDebugRenderer>>);

    await act(async () => {
      root.render(
        <MemoryRouter>
          <ProceduralTerrainDebugView />
        </MemoryRouter>,
      );
    });
    await act(async () => vi.advanceTimersByTimeAsync(20));
    const select = container.querySelector<HTMLSelectElement>('[aria-label="Building model"]')!;
    select.focus();
    const selectedWrites = vi.spyOn(HTMLOptionElement.prototype, "selected", "set");
    frameMs = 24;
    await act(async () => vi.advanceTimersByTimeAsync(1500));

    expect(getStats.mock.calls.length).toBeGreaterThanOrEqual(4);
    expect(container.textContent).toContain("24.0 ms");
    expect(document.activeElement).toBe(select);
    expect(selectedWrites).not.toHaveBeenCalled();

    buildingInstances = 2;
    await act(async () => vi.advanceTimersByTimeAsync(500));
    expect(container.textContent).toContain("Buildings and chests · 2");
    selectedWrites.mockClear();
    await act(async () => vi.advanceTimersByTimeAsync(1000));
    expect(selectedWrites).not.toHaveBeenCalled();
  });
});
