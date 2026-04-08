import { describe, expect, it, vi } from "vitest";

import { catchUpCommittedWorldmapChunkManagers } from "./worldmap-committed-chunk-manager-catchup";

describe("catchUpCommittedWorldmapChunkManagers", () => {
  it("runs structure catch-up before deferring the remaining managers on the staged path", async () => {
    const events: string[] = [];

    await catchUpCommittedWorldmapChunkManagers({
      stagedPathEnabled: true,
      runImmediateFullManagerCatchUp: vi.fn(async () => {
        events.push("full");
      }),
      runImmediateStructureCatchUp: vi.fn(async () => {
        events.push("structure");
      }),
      scheduleDeferredRemainingManagerCatchUp: vi.fn(() => {
        events.push("defer-remaining");
      }),
    });

    expect(events).toEqual(["structure", "defer-remaining"]);
  });

  it("keeps the legacy path on the full immediate manager catch-up", async () => {
    const events: string[] = [];

    await catchUpCommittedWorldmapChunkManagers({
      stagedPathEnabled: false,
      runImmediateFullManagerCatchUp: vi.fn(async () => {
        events.push("full");
      }),
      runImmediateStructureCatchUp: vi.fn(async () => {
        events.push("structure");
      }),
      scheduleDeferredRemainingManagerCatchUp: vi.fn(() => {
        events.push("defer-remaining");
      }),
    });

    expect(events).toEqual(["full"]);
  });
});
