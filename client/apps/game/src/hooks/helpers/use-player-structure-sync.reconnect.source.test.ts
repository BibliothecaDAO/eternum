// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("usePlayerStructureSync reconnect wiring", () => {
  it("resubscribes player-scoped Torii streams after the connection monitor rebuilds streams", () => {
    const source = readSource("src/hooks/helpers/use-player-structure-sync.ts");

    expect(source).toContain("useConnectionStore");
    expect(source).toContain("state.streamReconnectVersion");
    expect(source).toContain("writerRef.current?.reconnect()");
    expect(source).toContain("subscriptionSetupTimeoutMs: env.VITE_PUBLIC_TORII_SUBSCRIPTION_SETUP_TIMEOUT_MS");
  });

  it("delegates player writer ownership and coalescing to the headless runtime", () => {
    const source = readSource("src/hooks/helpers/use-player-structure-sync.ts");
    const writerSource = readSource("../../../packages/core/src/sync/player-structure-sync-writer.ts");

    expect(source).toContain("OWNED_STRUCTURE_BACKFILL_DEBOUNCE_MS");
    expect(source).toContain("getActiveGameSyncRuntime()");
    expect(source).not.toContain("requireActiveGameSyncRuntime()");
    expect(source).toContain("runtime.installPlayerWriter(writer)");
    expect(source).toContain("sqlApi.fetchStructuresByOwner(accountAddress)");
    expect(writerSource).toContain("rerunBackfill");
    expect(writerSource).toContain("requestOwnedStructureBackfill");
  });

  it("starts the player writer only as part of the complete legacy rollback path", () => {
    const source = readSource("src/hooks/helpers/use-player-structure-sync.ts");

    expect(source).toContain("if (!shouldUseLegacyBoundedSpatialSync()) return");
  });
});
