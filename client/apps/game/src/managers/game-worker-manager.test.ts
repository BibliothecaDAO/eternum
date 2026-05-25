// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

class MockPosition {
  constructor(private readonly coords: { x: number; y: number }) {}

  getNormalized() {
    return this.coords;
  }
}

type MockWorkerInstance = {
  onerror: ((event: { error?: unknown; message?: string }) => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  postMessage: ReturnType<typeof vi.fn>;
  terminate: ReturnType<typeof vi.fn>;
};

const createdWorkers: MockWorkerInstance[] = [];

const createMockWorkerInstance = (): MockWorkerInstance => {
  const worker = {
    onerror: null,
    onmessage: null,
    postMessage: vi.fn(),
    terminate: vi.fn(),
  };
  createdWorkers.push(worker);
  return worker;
};

const incrementWorldmapRenderCounter = vi.fn();
const recordWorldmapRenderDuration = vi.fn();

vi.mock("@bibliothecadao/eternum", () => ({
  Position: MockPosition,
}));

vi.mock("../workers/game-worker.ts?worker", () => ({
  default: vi.fn(() => createMockWorkerInstance()),
}));

vi.mock("../three/perf/worldmap-render-diagnostics", () => ({
  incrementWorldmapRenderCounter,
  recordWorldmapRenderDuration,
}));

const { createGameWorkerManager } = await import("./game-worker-manager");

describe("game worker manager", () => {
  beforeEach(() => {
    createdWorkers.length = 0;
    incrementWorldmapRenderCounter.mockClear();
    recordWorldmapRenderDuration.mockClear();
  });

  it("rejects pending path requests when the worker is terminated", async () => {
    const manager = createGameWorkerManager();
    const pendingPath = manager.findPath(
      new MockPosition({ x: 1, y: 2 }) as never,
      new MockPosition({ x: 3, y: 4 }) as never,
      8,
    );

    manager.terminate();

    await expect(pendingPath).rejects.toThrow("Game worker terminated");
  });

  it("creates a fresh worker after termination before posting new updates", () => {
    const manager = createGameWorkerManager();

    manager.updateExploredTile(5, 6, "forest" as never);
    manager.terminate();
    manager.updateExploredTile(7, 8, "desert" as never);

    expect(createdWorkers).toHaveLength(2);
    expect(createdWorkers[0].terminate).toHaveBeenCalledTimes(1);
    expect(createdWorkers[0].postMessage).toHaveBeenCalledWith({
      biome: "forest",
      col: 5,
      row: 6,
      type: "UPDATE_EXPLORED",
    });
    expect(createdWorkers[1].postMessage).toHaveBeenCalledWith({
      biome: "desert",
      col: 7,
      row: 8,
      type: "UPDATE_EXPLORED",
    });
  });

  it("resolves worker path results back into normalized positions", async () => {
    const manager = createGameWorkerManager();
    const resultPromise = manager.findPath(
      new MockPosition({ x: 10, y: 11 }) as never,
      new MockPosition({ x: 12, y: 13 }) as never,
      6,
    );

    createdWorkers.at(-1)?.onmessage?.({
      data: {
        path: [
          { x: 20, y: 21 },
          { x: 22, y: 23 },
        ],
        requestId: 1,
        type: "PATH_RESULT",
      },
    });

    await expect(resultPromise).resolves.toEqual([
      new MockPosition({ x: 20, y: 21 }),
      new MockPosition({ x: 22, y: 23 }),
    ]);
    expect(incrementWorldmapRenderCounter).toHaveBeenCalledWith("workerFindPathCalls");
    expect(recordWorldmapRenderDuration).toHaveBeenCalledWith("workerFindPath", expect.any(Number));
  });
});
