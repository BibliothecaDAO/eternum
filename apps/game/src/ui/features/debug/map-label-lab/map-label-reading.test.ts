import { Vector3 } from "three";
import { describe, expect, it } from "vitest";

import type { MapLabelEntity } from "@/three/debug/map-label-lab-fixture";

import { codeName, guardLine, standingOf, strongestOwnArmy, troopStrength } from "./map-label-reading";

const entity = (fields: Partial<MapLabelEntity>): MapLabelEntity => ({
  entityId: 1,
  kind: "realm",
  relation: "enemy",
  owner: "Ravero",
  anchor: new Vector3(),
  name: "Stolsli",
  level: 0,
  guards: [],
  ...fields,
});

describe("what a map plate reads", () => {
  it("calls an unnamed thing by its kind and its home and serial, and a realm by its name", () => {
    expect(codeName(entity({ kind: "camp", entityId: 19 * 2 ** 32 + 21 }))).toBe("Camp 19·21");
    expect(codeName(entity({ kind: "army", entityId: 12884901891 }))).toBe("Army 3·3");
    expect(codeName(entity({ kind: "realm" }))).toBe("Stolsli");
  });

  it("weighs troops by tier, 1 / 3 / 9 per troop", () => {
    expect(
      troopStrength([
        { tier: 1, count: 900 },
        { tier: 3, count: 300 },
      ]),
    ).toBe(3600);
  });

  it("reads a strength against the viewer's strongest army: stronger, even, weaker, or open", () => {
    expect(standingOf(5400, 2700)).toBe("stronger");
    expect(standingOf(2850, 2700)).toBe("even");
    expect(standingOf(800, 2700)).toBe("weaker");
    expect(standingOf(0, 2700)).toBe("open");
  });

  it("finds the viewer's strongest army among their own", () => {
    const army = (relation: MapLabelEntity["relation"], tier: 1 | 2 | 3, count: number) =>
      entity({ kind: "army", relation, army: { troops: { tier, count }, stamina: 1, staminaMax: 120 } });
    expect(strongestOwnArmy([army("own", 1, 1400), army("own", 2, 900), army("enemy", 3, 600)])).toBe(2700);
  });

  it("puts the tier before the number, every slot's tier in order, and the total once", () => {
    expect(guardLine([{ tier: 3, count: 1500 }])).toEqual({ tiers: ["T3"], total: "1,500" });
    expect(
      guardLine([
        { tier: 1, count: 900 },
        { tier: 1, count: 500 },
        { tier: 1, count: 300 },
        { tier: 3, count: 300 },
      ]),
    ).toEqual({ tiers: ["T1", "T1", "T1", "T3"], total: "2,000" });
    expect(guardLine([])).toBeNull();
  });
});
