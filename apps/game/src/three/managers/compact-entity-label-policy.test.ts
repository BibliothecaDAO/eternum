import { StructureType } from "@bibliothecadao/types";
import { describe, expect, it } from "vitest";

import { resolveStructureCompactEntityLabel } from "./compact-entity-label-policy";

const structure = (overrides: Record<string, unknown>) =>
  ({
    entityId: 7566894856929285,
    structureName: "Rift 7566894856929285",
    structureType: StructureType.Rift,
    ...overrides,
  }) as Parameters<typeof resolveStructureCompactEntityLabel>[0];

describe("a structure's plate", () => {
  it("reads a Frontier site's kind and the strength of its guard, never its id", () => {
    const rift = structure({
      siteKind: "Rift",
      guardArmies: [
        { slot: 0, category: "Knight", tier: 1, count: 1_100 },
        { slot: 1, category: "Knight", tier: 1, count: 0 },
      ],
    });
    expect(resolveStructureCompactEntityLabel(rift)).toBe("Rift 1.1k");
  });

  it("reads the kind alone while the site's guard is not known", () => {
    expect(resolveStructureCompactEntityLabel(structure({ siteKind: "Stragglers", guardArmies: undefined }))).toBe(
      "Stragglers",
    );
  });

  it("reads any other structure's name", () => {
    const realm = structure({ structureName: "Ozhuch", structureType: StructureType.Realm });
    expect(resolveStructureCompactEntityLabel(realm)).toBe("Ozhuch");
  });
});
