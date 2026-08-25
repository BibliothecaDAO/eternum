import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("Game card blitz entry", () => {
  it("uses a direct settle action instead of the old card-level auto-settle flow", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/ui/features/landing/components/game-selector/game-card-grid.tsx"),
      "utf8",
    );

    expect(source).toContain("const handleSettle = useCallback(() => {");
    expect(source).toContain("void settle().catch((err) => {");
    expect(source).toContain('return "Settling...";');
    expect(source).toContain('return "Settle";');
    expect(source).not.toContain("useAutoSettleStore");
    expect(source).not.toContain("resolveAutoSettleRuntimeState");
    expect(source).not.toContain("resolveBlitzSettlementAvailability");
    expect(source).not.toContain("Auto-settle");
  });
});
