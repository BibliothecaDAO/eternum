// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("Game entry modal auto-settle", () => {
  it("accepts auto-settle mode and starts settlement automatically once the Blitz settlement phase is ready", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/ui/features/landing/components/game-entry-modal.tsx"),
      "utf8",
    );

    expect(source).toContain("autoSettleEnabled?: boolean");
    expect(source).toContain("hasReachedBlitzAutoSettleStart");
    expect(source).toContain("!hasReachedBlitzAutoSettleStart");
    expect(source).toContain("void handleSettle();");
    expect(source).toContain("markCompleted(autoSettleEntryKey)");
    expect(source).toContain("markFailed(autoSettleEntryKey");
  });
});
