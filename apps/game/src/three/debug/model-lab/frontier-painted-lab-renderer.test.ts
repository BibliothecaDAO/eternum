import { describe, expect, it } from "vitest";
import { MAP_SITES } from "@/config/map-sites";
import { SPIRE, SUPPLY_POST } from "@/ui/design-system/kit/words";
import { FRONTIER_PAINTED_GROUPS } from "../../structures/frontier-painted-buildings";
import { OUTPOST_PATHS } from "../../structures/outpost-kit";
import { isProceduralModelPath, resolveProceduralModel } from "../../structures/procedural-model-resolver";
import { realmSupportLabEntries } from "../../structures/realm-support-kit";
import { RUIN_VARIANTS } from "../../structures/ruin-kit";
import { SPIRE_MODEL_PATH } from "../../structures/spire-kit";
import {
  FRONTIER_LAB_GROUPS,
  frontierLabEntries,
  resolveFrontierLabShippedPath,
} from "./frontier-painted-lab-renderer";

describe("frontier model lab groups", () => {
  it("exposes every procedural building and landmark group through one shared entry list", () => {
    for (const { group } of FRONTIER_LAB_GROUPS) {
      const entries = frontierLabEntries(group);
      expect(entries.length, group).toBeGreaterThan(0);
      for (const entry of entries) {
        expect(entry.group).toBe(group);
        if (entry.path.startsWith("procedural:")) {
          expect(isProceduralModelPath(entry.path), entry.path).toBe(true);
          expect(resolveProceduralModel(entry.path), entry.path).not.toBeNull();
        }
      }
    }
    const expectedTraining = realmSupportLabEntries()
      .filter((entry) => entry.group === "training")
      .map((entry) => entry.id);
    expect(frontierLabEntries("training").map((entry) => entry.id)).toEqual(expectedTraining);
    expect(frontierLabEntries("wells-shrines").map((entry) => entry.id)).toEqual(
      MAP_SITES.map(({ kind }) => kind.toLowerCase()),
    );
    expect(frontierLabEntries("ruins")).toHaveLength(RUIN_VARIANTS.length);
    expect(frontierLabEntries("outposts").map((entry) => entry.id)).toEqual(Object.keys(OUTPOST_PATHS));
    expect(frontierLabEntries("outposts").map((entry) => entry.path)).toEqual(Object.values(OUTPOST_PATHS));
    expect(frontierLabEntries("outposts").find((entry) => entry.id === "cleared-standard")?.label).toBe(
      SUPPLY_POST.title,
    );
    expect(frontierLabEntries("spire").map((entry) => ({ path: entry.path, label: entry.label }))).toEqual([
      { path: SPIRE_MODEL_PATH, label: SPIRE },
    ]);

    const paintedGroups = new Set<string>(FRONTIER_PAINTED_GROUPS.map(({ group }) => group));
    const landmarkGroups = FRONTIER_LAB_GROUPS.filter(({ group }) => !paintedGroups.has(group));
    expect(landmarkGroups.length).toBeGreaterThan(0);
    for (const { group } of landmarkGroups) {
      for (const entry of frontierLabEntries(group)) {
        expect(resolveFrontierLabShippedPath(entry), `${group}:${entry.id}`).toBe(entry.path);
      }
    }
  });
});
