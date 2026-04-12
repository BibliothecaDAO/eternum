import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("Game card auto-settle wiring", () => {
  it("adds a registered-player auto-settle switch and defaults it on after registration", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/ui/features/landing/components/game-selector/game-card-grid.tsx"),
      "utf8",
    );

    expect(source).toContain("useAutoSettleStore");
    expect(source).toContain("resolveAutoSettleRuntimeState");
    expect(source).toContain("resolveAutoSettleTriggerAtSec");
    expect(source).toContain("Auto-settle");
    expect(source).toContain("setEnabled(autoSettleEntryKey, true");
    expect(source).toContain("markOpening(autoSettleEntryKey");
  });
});
