import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("Game card network switch resume wiring", () => {
  it("stores pending guarded actions and replays them after a successful switch", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/ui/features/landing/components/game-selector/game-card-grid.tsx"),
      "utf8",
    );

    expect(source).toContain("type PendingGuardedAction");
    expect(source).toContain("pendingGuardedAction");
    expect(source).toContain("replayPendingGuardedAction");
    expect(source).toContain("Switch your wallet and we'll continue automatically.");
  });
});
