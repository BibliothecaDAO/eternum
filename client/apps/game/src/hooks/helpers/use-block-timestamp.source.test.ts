// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const actionOrientedFiles = [
  "client/apps/game/src/ui/features/economy/resources/entity-resource-table/entity-resource-table-new.tsx",
  "client/apps/game/src/ui/features/economy/resources/realm-transfer.tsx",
  "client/apps/game/src/ui/features/economy/trading/market-order-panel.tsx",
  "client/apps/game/src/ui/features/economy/trading/unified-trade-panel.tsx",
  "client/apps/game/src/ui/features/economy/transfers/transfer-automation-panel.tsx",
  "client/apps/game/src/ui/features/infrastructure/bridge/bridge.tsx",
  "client/apps/game/src/ui/modules/entity-details/hooks/use-structure-upgrade.ts",
];

describe("action-oriented default tick usage", () => {
  it("uses the live default tick hook instead of the coarse hook", () => {
    for (const filePath of actionOrientedFiles) {
      const source = readFileSync(resolve(process.cwd(), "..", "..", "..", filePath), "utf8");

      expect(source).toContain("useCurrentDefaultTick");
      expect(source).not.toContain("useCoarseCurrentDefaultTick");
    }
  });
});
