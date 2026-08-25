// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("Game entry settlement target subscription", () => {
  it("waits for pushed entity state and uses the deadline only as a slow alarm", () => {
    const source = readSource("src/ui/features/landing/components/game-entry-modal.tsx");

    expect(source).toContain("waitForSelectedWorldEntityState");
    expect(source).toContain("status.canPlay || status.settledCount >= Math.max(1, targetSettleCount)");
    expect(source).toContain("slowAfterMs: SETTLEMENT_SYNC_TIMEOUT_MS");
    expect(source).not.toContain("SETTLEMENT_PROGRESS_POLL_MS");
    expect(source).not.toContain("while (Date.now() - startedAt < timeoutMs)");
  });
});
