// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("TileManager optimistic construction cleanup", () => {
  it("clears build-slot transitions from transaction wait failures, not only reverted receipts", () => {
    const source = readSource("src/managers/tile-manager.ts");

    expect(source).toContain("waitForTransactionWithCheck");
    expect(source).toContain("onFailed");
    expect(source).toMatch(/onFailed:\s*\(failureReason\)/);
    expect(source).toContain("clearBuildSlotTransition(buildSlotTransitions, buildKey)");
  });
});
