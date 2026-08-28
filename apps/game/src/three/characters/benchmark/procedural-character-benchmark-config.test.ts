import { describe, expect, it, vi } from "vitest";

import {
  applyProceduralCharacterBenchmarkConfigPatch,
  createDefaultProceduralCharacterBenchmarkConfig,
  createProceduralCharacterWalkingPerformanceConfig,
} from "./procedural-character-benchmark-config";

describe("procedural character benchmark config", () => {
  it("selects and normalizes the appearance used by the whole population", () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const base = createDefaultProceduralCharacterBenchmarkConfig();
    const universal = applyProceduralCharacterBenchmarkConfigPatch(base, { appearanceId: "universal-base" });
    const invalid = applyProceduralCharacterBenchmarkConfigPatch(base, {
      appearanceId: "missing-family" as "modular-fantasy",
    });

    expect(base.appearanceId).toBe("modular-fantasy");
    expect(universal.appearanceId).toBe("universal-base");
    expect(invalid.appearanceId).toBe("modular-fantasy");
    expect(createProceduralCharacterWalkingPerformanceConfig().appearanceId).toBe("modular-fantasy");
    warning.mockRestore();
  });
});
