import { describe, it, expect } from "vitest";
import { buildGameStateBlock } from "../../../src/entry/game-state.js";
import type { MapContext } from "../../../src/map/context.js";
import type { AutomationStatusMap } from "../../../src/automation/status.js";

function makeMapCtx(overrides: Partial<MapContext> = {}): MapContext {
  return { snapshot: null, filePath: null, ...overrides };
}

describe("buildGameStateBlock", () => {
  it("returns empty block when no data available", () => {
    const result = buildGameStateBlock(makeMapCtx(), new Map(), []);
    expect(result).toContain("<game_state>");
    expect(result).toContain("</game_state>");
    expect(result).toContain("No structures");
    expect(result).toContain("No armies");
  });

  it("includes automation status for each realm", () => {
    const status: AutomationStatusMap = new Map();
    status.set(165, {
      entityId: 165,
      name: "Realm 165",
      level: 3,
      buildOrderProgress: "44/45",
      lastBuilt: ["KnightT3"],
      lastUpgrade: null,
      produced: true,
      errors: [],
      wheatBalance: 105000,
      essenceBalance: 5600,
    });
    const result = buildGameStateBlock(makeMapCtx(), status, []);
    expect(result).toContain("Realm 165");
    expect(result).toContain("lv3");
    expect(result).toContain("44/45");
    expect(result).toContain("105K");
  });

  it("includes tool errors grouped by tool name", () => {
    const errors = [
      { tool: "move_army", error: "No army at position", tick: 1 },
      { tool: "move_army", error: "No army at position", tick: 2 },
      { tool: "attack_target", error: "Insufficient stamina", tick: 3 },
    ];
    const result = buildGameStateBlock(makeMapCtx(), new Map(), errors);
    expect(result).toContain("move_army");
    expect(result).toContain("2x");
    expect(result).toContain("attack_target");
  });
});
