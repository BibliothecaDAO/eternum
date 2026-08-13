// @vitest-environment node

import { describe, expect, it, vi } from "vitest";
import type { BoundsDescriptor } from "./torii-stream-manager";
import { switchLegacyBoundedSyncForCamera, type LegacyBoundedSyncAdapter } from "./legacy-bounded-sync-adapter";

const descriptor: BoundsDescriptor = {
  minCol: 0,
  maxCol: 10,
  minRow: 0,
  maxRow: 10,
  models: [],
};

describe("legacy bounded sync adapter", () => {
  it("performs zero Torii work for camera movement in game-wide mode", async () => {
    await expect(switchLegacyBoundedSyncForCamera(null, descriptor)).resolves.toBeNull();
  });

  it("keeps the complete bounded switch available for rollback mode", async () => {
    const switchBounds = vi.fn(async () => ({ outcome: "applied" as const }));
    const adapter = {
      switchBounds,
      forceResubscribe: vi.fn(),
      cancelCurrentSubscription: vi.fn(),
      shutdown: vi.fn(),
    } satisfies LegacyBoundedSyncAdapter;

    await expect(switchLegacyBoundedSyncForCamera(adapter, descriptor)).resolves.toEqual({ outcome: "applied" });
    expect(switchBounds).toHaveBeenCalledWith(descriptor);
  });
});
