import { describe, expect, it, vi } from "vitest";

import { catchUpCommittedWorldmapChunkManagers } from "./worldmap-committed-chunk-manager-catchup";

describe("catchUpCommittedWorldmapChunkManagers", () => {
  it("runs critical catch-up before deferring the non-critical managers on the staged path", async () => {
    const events: string[] = [];

    await catchUpCommittedWorldmapChunkManagers({
      stagedPathEnabled: true,
      runImmediateFullManagerCatchUp: vi.fn(async () => {
        events.push("full");
      }),
      runImmediateCriticalManagerCatchUp: vi.fn(async () => {
        events.push("critical");
      }),
      scheduleDeferredNonCriticalManagerCatchUp: vi.fn(() => {
        events.push("defer-non-critical");
      }),
    });

    expect(events).toEqual(["critical", "defer-non-critical"]);
  });

  it("keeps the legacy path on the full immediate manager catch-up", async () => {
    const events: string[] = [];

    await catchUpCommittedWorldmapChunkManagers({
      stagedPathEnabled: false,
      runImmediateFullManagerCatchUp: vi.fn(async () => {
        events.push("full");
      }),
      runImmediateCriticalManagerCatchUp: vi.fn(async () => {
        events.push("critical");
      }),
      scheduleDeferredNonCriticalManagerCatchUp: vi.fn(() => {
        events.push("defer-non-critical");
      }),
    });

    expect(events).toEqual(["full"]);
  });
});
