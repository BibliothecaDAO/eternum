import { describe, it, expect, vi } from "vitest";
import { createMapLoop } from "../../../src/map/loop.js";
import type { MapContext } from "../../../src/map/context.js";
import type { EternumClient, TileState } from "@bibliothecadao/client";

vi.mock("fs", () => ({
  writeFileSync: vi.fn(),
}));

function makeTile(x: number, y: number, occupierType = 0): TileState {
  return {
    position: { x, y },
    biome: 11,
    occupierId: 0,
    occupierType,
    occupierIsStructure: false,
    rewardExtracted: false,
  };
}

function makeClient(tiles: TileState[] = []): EternumClient {
  return {
    view: {
      mapArea: vi.fn().mockResolvedValue({ center: { x: 0, y: 0 }, radius: 999_999, tiles }),
    },
  } as unknown as EternumClient;
}

describe("map-loop", () => {
  it("refresh() updates the snapshot", async () => {
    const tiles = [makeTile(0, 0), makeTile(1, 0)];
    const client = makeClient(tiles);
    const ctx: MapContext = { snapshot: null, filePath: null };
    const loop = createMapLoop(client, ctx, undefined, 10_000);

    expect(ctx.snapshot).toBeNull();
    await loop.refresh();

    expect(ctx.snapshot).not.toBeNull();
    expect(ctx.snapshot!.tiles).toHaveLength(2);
  });

  it("refresh() picks up new tiles", async () => {
    const tiles1 = [makeTile(0, 0)];
    const tiles2 = [makeTile(0, 0), makeTile(1, 0), makeTile(2, 0)];
    const client = makeClient(tiles1);
    const ctx: MapContext = { snapshot: null, filePath: null };
    const loop = createMapLoop(client, ctx, undefined, 10_000);

    await loop.refresh();
    expect(ctx.snapshot!.tiles).toHaveLength(1);

    (client.view.mapArea as any).mockResolvedValue({ center: { x: 0, y: 0 }, radius: 999_999, tiles: tiles2 });
    await loop.refresh();
    expect(ctx.snapshot!.tiles).toHaveLength(3);
  });

  it("writes to filePath when set", async () => {
    const { writeFileSync } = await import("fs");
    const client = makeClient([makeTile(0, 0)]);
    const ctx: MapContext = { snapshot: null, filePath: "/tmp/map.txt" };
    const loop = createMapLoop(client, ctx, undefined, 10_000);

    await loop.refresh();
    expect(writeFileSync).toHaveBeenCalledWith("/tmp/map.txt", expect.any(String));
  });

  it("does not write when filePath is null", async () => {
    const { writeFileSync } = await import("fs");
    (writeFileSync as any).mockClear();
    const client = makeClient([makeTile(0, 0)]);
    const ctx: MapContext = { snapshot: null, filePath: null };
    const loop = createMapLoop(client, ctx, undefined, 10_000);

    await loop.refresh();
    expect(writeFileSync).not.toHaveBeenCalled();
  });

  it("survives a failed fetch", async () => {
    const client = makeClient([makeTile(0, 0)]);
    const ctx: MapContext = { snapshot: null, filePath: null };
    const loop = createMapLoop(client, ctx, undefined, 10_000);

    await loop.refresh();
    const firstSnapshot = ctx.snapshot;
    expect(firstSnapshot).not.toBeNull();

    // Next fetch fails
    (client.view.mapArea as any).mockRejectedValueOnce(new Error("network"));
    await loop.refresh();

    // Snapshot unchanged
    expect(ctx.snapshot).toBe(firstSnapshot);
  });

  it("start/stop controls the interval", () => {
    const client = makeClient([makeTile(0, 0)]);
    const ctx: MapContext = { snapshot: null, filePath: null };
    const loop = createMapLoop(client, ctx, undefined, 10_000);

    expect(loop.isRunning).toBe(false);
    loop.start();
    expect(loop.isRunning).toBe(true);
    loop.stop();
    expect(loop.isRunning).toBe(false);
  });

  it("fetches all tiles with large radius", async () => {
    const client = makeClient([makeTile(0, 0)]);
    const ctx: MapContext = { snapshot: null, filePath: null };
    const loop = createMapLoop(client, ctx, undefined, 10_000);

    await loop.refresh();
    expect(client.view.mapArea).toHaveBeenCalledWith({ x: 0, y: 0, radius: 999_999 });
  });
});
