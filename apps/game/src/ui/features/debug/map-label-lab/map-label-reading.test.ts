import { Vector3 } from "three";
import { describe, expect, it } from "vitest";

import type { MapLabelEntity } from "@/three/debug/map-label-lab-fixture";

import { attackOrder, homeCode, restingGuard } from "./map-label-reading";

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
  it("reads a thing's short id off its entity id: its home namespace and serial", () => {
    expect(homeCode(entity({ kind: "camp", entityId: 19 * 2 ** 32 + 21 }))).toBe("19·21");
    expect(homeCode(entity({ kind: "army", entityId: 12884901891 }))).toBe("3·3");
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

  it("lists guard slots as an attacker meets them: the highest occupied slot first, empty slots skipped", () => {
    const slot0 = { type: "crossbowman", tier: 1, count: 516 } as const;
    const slot1 = { type: "knight", tier: 2, count: 0 } as const;
    const slot2 = { type: "paladin", tier: 3, count: 638 } as const;
    expect(attackOrder([slot0, slot1, slot2])).toEqual([slot2, slot0]);
  });
});
