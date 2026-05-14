// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("Game entry settlement target polling", () => {
  it("waits for the requested settled realm count instead of accepting empty indexed snapshots", () => {
    const source = readSource("src/ui/features/landing/components/game-entry-modal.tsx");

    expect(source).toContain("status.canPlay || status.settledCount >= Math.max(1, targetSettleCount)");
    expect(source).not.toContain("hasReachedSettlementTarget(status, targetSettleCount)");
  });
});
