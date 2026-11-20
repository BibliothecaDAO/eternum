import { describe, expect, it } from "vitest";

import { deepViewFor } from "./deep-geometry";

const store = (aspects: Record<string, number>, rules: { gate_distance: number } | null = { gate_distance: 4 }) => ({
  get: (model: string, key: { home?: bigint }) => {
    if (model === "DeepRules") return rules ?? undefined;
    if (model === "HomeAspect") {
      const aspect = aspects[String(key.home)];
      return aspect === undefined ? undefined : { aspect };
    }
    return undefined;
  },
});

describe("the Deep's gates", () => {
  it("opens each home's view on its Aspect's gate where the contract stands it: Prowess, Luminary, Havoc, Insight around the centre", () => {
    const homes = store({ "1": 1, "2": 2, "3": 3, "4": 4 });
    expect([1n, 2n, 3n, 4n].map((home) => deepViewFor(homes as never, 7, home, 1024))).toEqual([
      { col: 512, row: 3588 },
      { col: 516, row: 3584 },
      { col: 512, row: 3580 },
      { col: 508, row: 3584 },
    ]);
  });

  it("opens on the centre for a viewer with no home or a home with no Aspect yet", () => {
    const homes = store({});
    expect(deepViewFor(homes as never, 7, null, 1024)).toEqual({ col: 512, row: 3584 });
    expect(deepViewFor(homes as never, 7, 9n, 1024)).toEqual({ col: 512, row: 3584 });
  });

  it("refuses an Aspect with no gate, and a game without the rules that place the gates", () => {
    expect(() => deepViewFor(store({ "5": 5 }) as never, 7, 5n, 1024)).toThrow("No gate for Aspect 5");
    expect(() => deepViewFor(store({}, null) as never, 7, 1n, 1024)).toThrow("needs the game's DeepRules row");
  });
});
