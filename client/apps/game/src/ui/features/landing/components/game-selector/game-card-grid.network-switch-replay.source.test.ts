// @vitest-environment node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

describe("Game card network switch replay", () => {
  it("persists the switched chain and replays the blocked action after a successful modal switch", () => {
    const source = readFileSync(fileURLToPath(new URL("./game-card-grid.tsx", import.meta.url)), "utf8");

    expect(source).toContain('import { setSelectedChain, type WorldSelectionInput } from "@/runtime/world";');
    expect(source).toContain("resolvePendingNetworkSwitchOutcome");
    expect(source).toContain("setSelectedChain(outcome.selectedChain);");
    expect(source).toContain("outcome.replay?.();");
  });
});
