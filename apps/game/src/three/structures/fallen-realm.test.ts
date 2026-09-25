import { describe, expect, it } from "vitest";
import { StructureType } from "@bibliothecadao/types";
import { getStructureModelPaths } from "../constants/scene-constants";
import {
  FALLEN_REALM_BEASTS,
  FALLEN_REALM_DEPTHS,
  FALLEN_REALM_RUIN_MODEL_INDEX,
  FALLEN_REALM_RUIN_PATH,
  fallenRealmBeast,
  fallenRealmBeastModelIndex,
  fallenRealmOnTile,
  readStandingFallenRealm,
} from "./fallen-realm";

/** A Frontier game whose expedition bands are ten rows deep, holding the given site at entity 9. */
const siteFacts = (site: { kind: "Camp" | "Rift" | "FallenRealm"; cleared: boolean } | undefined) => {
  const rows: Record<string, Record<string, unknown> | undefined> = {
    SliceRules: { epoch_seconds: 86_400 },
    GameRegistry: { start_main_at: 0 },
    SettlementRules: { spacing: 10 },
    ExpeditionSite: site && { game_id: 1, entity_id: 9, initial_guard_count: 0n, ...site },
  };
  return { get: (model: string) => rows[model] } as never;
};

describe("a fallen realm on the map", () => {
  it("is held by a troll at the surface, a wyvern at Ethereal I and a hydra deeper, larger the deeper it stands", () => {
    expect([0, 1, 2, 3].map((depth) => fallenRealmBeast(depth).name)).toEqual(["Troll", "Wyvern", "Hydra", "Hydra"]);
    const scales = FALLEN_REALM_DEPTHS.map(({ scale }) => scale);
    expect(scales).toEqual(scales.toSorted((left, right) => left - right));
    expect(() => fallenRealmBeast(4)).toThrow("No fallen realm beast for depth 4");
  });

  it("never scales a beast past the largest it can take inside the ruin", () => {
    for (const { beast, scale } of FALLEN_REALM_DEPTHS)
      expect(scale).toBeLessThanOrEqual(FALLEN_REALM_BEASTS[beast].maxScale);
  });

  it("shows the ruin and its beast only while the fallen realm stands", () => {
    expect(fallenRealmOnTile({ kind: "FallenRealm", cleared: false }, 1)?.beast).toBe("wyvern");
    // Cleared: the tile's closed chest is the capture's occupancy, drawn as every closed chest.
    expect(fallenRealmOnTile({ kind: "FallenRealm", cleared: true }, 1)).toBeNull();
    expect(fallenRealmOnTile({ kind: "Camp", cleared: false }, 0)).toBeNull();
  });

  it("draws a camp whose site is a fallen realm as its ruin and its depth's beast, from the facts alone", () => {
    const standing = siteFacts({ kind: "FallenRealm", cleared: false });
    // Row 15 lies in the second band of ten: Ethereal I.
    expect(readStandingFallenRealm(standing, 1, 9, { row: 15 })?.beast).toBe("wyvern");
    expect(
      readStandingFallenRealm(siteFacts({ kind: "FallenRealm", cleared: true }), 1, 9, { row: 15 }),
    ).toBeUndefined();
    expect(readStandingFallenRealm(siteFacts({ kind: "Camp", cleared: false }), 1, 9, { row: 15 })).toBeUndefined();
    expect(readStandingFallenRealm(siteFacts(undefined), 1, 9, { row: 15 })).toBeUndefined();

    const campModels = getStructureModelPaths()[StructureType.Camp];
    expect(campModels[FALLEN_REALM_RUIN_MODEL_INDEX]).toBe(FALLEN_REALM_RUIN_PATH);
    for (const beast of Object.keys(FALLEN_REALM_BEASTS) as (keyof typeof FALLEN_REALM_BEASTS)[])
      expect(campModels[fallenRealmBeastModelIndex(beast)]).toBe(FALLEN_REALM_BEASTS[beast].path);
  });
});
