import { Vector3 } from "three";
import { describe, expect, it } from "vitest";

import type { MapLabelEntity } from "@/three/debug/map-label-lab-fixture";

import { codeName, restingGuard } from "./map-label-reading";

const entity = (fields: Partial<MapLabelEntity>): MapLabelEntity => ({
  entityId: 1,
  kind: "realm",
  relation: "enemy",
  owner: "Ravero",
  anchor: new Vector3(),
  ground: new Vector3(),
  name: "Stolsli",
  homeName: "Stolsli",
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

  it("rests a guard on one number: a single slot as itself, several as their total, none as open", () => {
    const crossbows = { type: "crossbowman", tier: 3, count: 1500 } as const;
    expect(restingGuard([crossbows])).toEqual({ kind: "slot", slot: crossbows });
    expect(
      restingGuard([
        { type: "crossbowman", tier: 1, count: 516 },
        { type: "knight", tier: 2, count: 577 },
        { type: "paladin", tier: 3, count: 638 },
      ]),
    ).toEqual({ kind: "total", total: 1731 });
    expect(restingGuard([])).toEqual({ kind: "open" });
  });
});
