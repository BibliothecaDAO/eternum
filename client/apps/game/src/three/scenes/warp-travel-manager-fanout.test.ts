import { describe, expect, it } from "vitest";

import { runWarpTravelManagerFanout } from "./warp-travel-manager-fanout";
import { createControlledAsyncCall, flushMicrotasks } from "./worldmap-test-harness";

describe("runWarpTravelManagerFanout", () => {
  it("fans out one chunk update to every registered manager with the same options", async () => {
    const army = createControlledAsyncCall<[string, { force: boolean; transitionToken: number }], void>();
    const structure = createControlledAsyncCall<[string, { force: boolean; transitionToken: number }], void>();
    const chest = createControlledAsyncCall<[string, { force: boolean; transitionToken: number }], void>();

    const resultPromise = runWarpTravelManagerFanout({
      chunkKey: "24,24",
      options: { force: true, transitionToken: 11 },
      managers: [
        { label: "army", updateChunk: army.fn },
        { label: "structure", updateChunk: structure.fn },
        { label: "chest", updateChunk: chest.fn },
      ],
    });

    await flushMicrotasks(2);

    expect(army.calls).toEqual([["24,24", { force: true, transitionToken: 11 }]]);
    expect(structure.calls).toEqual([["24,24", { force: true, transitionToken: 11 }]]);
    expect(chest.calls).toEqual([["24,24", { force: true, transitionToken: 11 }]]);

    army.resolveNext();
    structure.resolveNext();
    chest.resolveNext();

    await expect(resultPromise).resolves.toEqual({
      failedManagers: [],
    });
  });

  it("reports rejected managers without dropping successful updates", async () => {
    const army = createControlledAsyncCall<[string, { force: boolean; transitionToken: number }], void>();
    const structure = createControlledAsyncCall<[string, { force: boolean; transitionToken: number }], void>();
    const chest = createControlledAsyncCall<[string, { force: boolean; transitionToken: number }], void>();

    const resultPromise = runWarpTravelManagerFanout({
      chunkKey: "24,24",
      options: { force: false, transitionToken: 12 },
      managers: [
        { label: "army", updateChunk: army.fn },
        { label: "structure", updateChunk: structure.fn },
        { label: "chest", updateChunk: chest.fn },
      ],
    });

    await flushMicrotasks(2);

    army.resolveNext();
    structure.rejectNext(new Error("structure failed"));
    chest.resolveNext();

    await expect(resultPromise).resolves.toMatchObject({
      failedManagers: [{ label: "structure" }],
    });

    const result = await resultPromise;
    expect((result.failedManagers[0]?.reason as Error | undefined)?.message).toBe("structure failed");
  });
});
