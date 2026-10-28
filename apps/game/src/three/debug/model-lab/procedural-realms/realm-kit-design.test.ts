import { describe, expect, it } from "vitest";
import boxes from "./realm-kit-boxes.json";
import {
  REALM_KIT_RING,
  realmKitModules,
  resolveRealmKitDesign,
  type RealmKitDesign,
  type RealmKitLevel,
} from "./realm-kit-design";

const LEVELS: RealmKitLevel[] = [0, 1, 2, 3];
const LEVEL_KEYS = ["settlement", "city", "kingdom", "empire"] as const;

/** What a viewer can tell apart: which module stands where, and the palette. Heights are ignored. */
const silhouette = (design: RealmKitDesign) =>
  JSON.stringify([design.placements.map(({ module, at }) => `${module}@${at}`).sort(), design.stone, design.roof]);

describe("procedural realm kit design", () => {
  it.each(LEVELS)("keeps a home without a Realm on the level's fixed design (level %i)", (level) => {
    expect(resolveRealmKitDesign(level)).toEqual({
      placements: realmKitModules(level).map((module) => ({ module, at: module, heightScale: 1, yaw: 0 })),
      stone: [1, 1, 1],
      roof: [1, 1, 1],
    });
  });

  it("draws the same Realm the same way every time", () => {
    const traits = { realmId: 4096, resourceCount: 3 };
    expect(resolveRealmKitDesign(2, traits)).toEqual(resolveRealmKitDesign(2, { ...traits }));
    expect(resolveRealmKitDesign(2, traits)).not.toEqual(resolveRealmKitDesign(2, { ...traits, realmId: 4097 }));
  });

  it.each(LEVELS)("keeps every Realm's ring, gate and door where the camera sees them (level %i)", (level) => {
    for (let realmId = 1; realmId <= 8000; realmId++) {
      const { placements } = resolveRealmKitDesign(level, { realmId, resourceCount: 1 + (realmId % 7) });
      expect(placements[0]).toEqual({ module: REALM_KIT_RING, at: REALM_KIT_RING, heightScale: 1, yaw: 0 });
      for (const { module, at } of placements) {
        expect(realmKitModules(level)).toContain(module);
        expect(realmKitModules(level)).toContain(at);
      }
    }
  });

  // Layouts per level × 5 stone tints × 6 roof tints: settlement 6, city 3, kingdom 8, empire 4 layouts.
  it.each([
    [0, 180],
    [1, 90],
    [2, 240],
    [3, 120],
  ] as const)("reaches every look over the 8000 Realms, before heights (level %i: %i)", (level, total) => {
    const looks = new Set<string>();
    for (let realmId = 1; realmId <= 8000; realmId++) {
      looks.add(silhouette(resolveRealmKitDesign(level, { realmId, resourceCount: 3 })));
    }
    expect(looks.size).toBe(total);
  });

  it.each(LEVELS)("names exactly the modules the shipped source was cut into (level %i)", (level) => {
    const cut = Object.keys(boxes[LEVEL_KEYS[level]]).sort();
    expect(
      realmKitModules(level)
        .filter((module) => module !== REALM_KIT_RING)
        .toSorted(),
    ).toEqual(cut);
  });
});
