import { describe, expect, it } from "vitest";

import { prepareProceduralUnitAssembly } from "./procedural-unit-assembly";
import {
  applyProceduralUnitConfigPatch,
  createDefaultProceduralUnitConfig,
  PROCEDURAL_UNIT_KINDS,
} from "./procedural-unit-config";

const KNIGHT_GEAR = { weaponId: "t1-knight-default-sword", offhandId: "t1-knight-default-shield" } as const;

function createKnightWithOwnAppearance() {
  const knight = applyProceduralUnitConfigPatch(createDefaultProceduralUnitConfig(), { kind: "knight" });
  return applyProceduralUnitConfigPatch(knight, { humanoid: { appearanceId: "t1-knight-default" } });
}

describe("procedural unit assembly", () => {
  it("brings the Knight's own gear when its appearance is chosen", () => {
    const knight = createKnightWithOwnAppearance();
    expect(knight.melee).toMatchObject(KNIGHT_GEAR);
    expect(() => prepareProceduralUnitAssembly(knight)).not.toThrow();
  });

  it("takes the Knight's gear off when another appearance is chosen", () => {
    const other = applyProceduralUnitConfigPatch(createKnightWithOwnAppearance(), {
      humanoid: { appearanceId: "modular-fantasy" },
    });
    expect(other.melee).toMatchObject({ weaponId: "iron-longsword", offhandId: "round-shield" });
  });

  it("replaces an appearance and gear the new kind cannot use, in the same patch that changes the kind", () => {
    const knight = createKnightWithOwnAppearance();
    for (const { id } of PROCEDURAL_UNIT_KINDS) {
      const changed = applyProceduralUnitConfigPatch(knight, { kind: id });
      if (id !== "knight") {
        expect(changed.humanoid.appearanceId).toBe("modular-fantasy");
        expect(changed.melee).not.toMatchObject(KNIGHT_GEAR);
      }
      expect(() => prepareProceduralUnitAssembly(changed)).not.toThrow();
    }
  });

  it("keeps fanning one humanoid configuration across every kind without throwing", () => {
    let config = createKnightWithOwnAppearance();
    for (const kind of ["archer", "knight", "paladin", "crossbowman", "knight"] as const) {
      config = applyProceduralUnitConfigPatch(config, { kind });
      expect(() => prepareProceduralUnitAssembly(config)).not.toThrow();
    }
  });

  it("still throws, as the last line, when gear is asked for on a rig it was not fitted to", () => {
    const knight = createKnightWithOwnAppearance();
    const wrongRig = { ...knight, humanoid: { ...knight.humanoid, appearanceId: "modular-fantasy" as const } };
    expect(() => prepareProceduralUnitAssembly(wrongRig)).toThrow("fitted to t1-knight-default");
    const paladinAppearance = { ...applyProceduralUnitConfigPatch(knight, { kind: "paladin" }) };
    expect(() =>
      prepareProceduralUnitAssembly({
        ...paladinAppearance,
        humanoid: { ...paladinAppearance.humanoid, appearanceId: "t1-knight-default" },
      }),
    ).toThrow("incompatible");
  });
});
