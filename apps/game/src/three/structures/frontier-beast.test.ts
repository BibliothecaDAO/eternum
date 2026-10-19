import { beastMeaning } from "@/ui/design-system/domain-icon-meaning";
import { iconDefinition } from "@/ui/design-system/icon-meaning";
import { describe, expect, it } from "vitest";
import { readdirSync } from "node:fs";
import { basename } from "node:path";
import { BEAST_NAMES } from "@/ui/design-system/kit/words";
import { RESOURCE_PRECISION, StructureType } from "@bibliothecadao/types";
import { getStructureModelPaths } from "../constants/scene-constants";
import {
  FRONTIER_BEASTS,
  FALLEN_REALM_DEPTHS,
  beastBand,
  frontierBeast,
  frontierBeastModelIndex,
  readStandingFrontierBeast,
} from "./frontier-beast";

const DEPTH_BOUNDS = [
  { beast_weak_lower: 300, beast_weak_upper: 350, beast_strong_lower: 450, beast_strong_upper: 550 },
  { beast_weak_lower: 900, beast_weak_upper: 1050, beast_strong_lower: 1350, beast_strong_upper: 1650 },
  { beast_weak_lower: 2400, beast_weak_upper: 2800, beast_strong_lower: 3600, beast_strong_upper: 4400 },
  { beast_weak_lower: 6000, beast_weak_upper: 7000, beast_strong_lower: 9000, beast_strong_upper: 11000 },
];
const scaled = (count: number) => BigInt(count) * BigInt(RESOURCE_PRECISION);
const facts = (category: StructureType, depth = 0, initialCount = 325, remaining = 1, cleared = false) => {
  const rows = {
    SliceRules: { day_unit_seconds: 86400 },
    GameRegistry: { start_main_at: 0, seed: 1 },
    SettlementRules: { spacing: 10 },
    DepthRules: DEPTH_BOUNDS[depth],
    Structure: { game_id: 1, entity_id: 9, base: { category } },
    ExpeditionSite: {
      game_id: 1,
      entity_id: 9,
      initial_guard_count: scaled(initialCount),
      clear: cleared ? { explorer_id: 1n, home_id: 7n, reward: null } : null,
    },
    Guard: { troops: { category: "Knight", tier: "T1", count: scaled(remaining) } },
  };
  return { get: (model: keyof typeof rows) => rows[model] } as never;
};
const without = (store: ReturnType<typeof facts>, missing: string) => {
  const original = store as { get: (model: string) => unknown };
  return { get: (model: string) => (model === missing ? undefined : original.get(model)) } as never;
};

describe("Frontier guard identity", () => {
  it("ships only the beast names and models reachable from live encounters", () => {
    const species = [
      ...new Set(
        [0, 1, 2, 3].flatMap((depth) => [
          ...[StructureType.Camp, StructureType.Rift, StructureType.Ruin].map(
            (category) => frontierBeast(depth, category).beast,
          ),
          ...(["lowly", "stronger"] as const).map((band) => frontierBeast(depth, StructureType.Beasts, band).beast),
        ]),
      ),
    ].sort();
    expect(Object.keys(FRONTIER_BEASTS).sort()).toEqual(species);
    expect(Object.keys(BEAST_NAMES).sort()).toEqual(species);
    const deliveries = readdirSync(new URL("../../../public/models/frontier", import.meta.url), {
      recursive: true,
      encoding: "utf8",
    })
      .filter((file) => file.endsWith(".glb") && basename(file).startsWith("beast-"))
      .sort();
    expect(deliveries).toEqual(species.map((beast) => basename(FRONTIER_BEASTS[beast].path)).sort());
  });

  it("keeps one editable sculpt per shipped beast, without retired study sources", () => {
    const sources = readdirSync(new URL("../../../asset-sources/frontier-beasts", import.meta.url), {
      recursive: true,
      encoding: "utf8",
    })
      .filter((file) => file.endsWith(".blend"))
      .sort();
    expect(sources).toEqual(
      Object.keys(FRONTIER_BEASTS)
        .map((species) => `refined/${species}.blend`)
        .sort(),
    );
  });

  it("keeps the shipped Ruin progression and measured scales", () => {
    expect([0, 1, 2, 3].map((depth) => frontierBeast(depth).name)).toEqual(["Troll", "Wyvern", "Hydra", "Hydra"]);
    for (const { beast, scale } of FALLEN_REALM_DEPTHS)
      expect(scale).toBeLessThanOrEqual(FRONTIER_BEASTS[beast].maxScale);
    expect(() => frontierBeast(4)).toThrow("No Frontier beast");
    expect(() => frontierBeast(0, StructureType.Beasts)).toThrow("initial strength band");
  });
  it.each([StructureType.Camp, StructureType.Rift, StructureType.Ruin])(
    "uses the same live identity to select model and label for site %s",
    (category) => {
      const identity = readStandingFrontierBeast(facts(category, 1), 1, 9, { row: 15 })!;
      expect(identity.name).toBe("Wyvern");
      expect(getStructureModelPaths()[category][frontierBeastModelIndex(identity.beast)]).toBe(
        FRONTIER_BEASTS[identity.beast].path,
      );
      expect(readStandingFrontierBeast(facts(category, 1, 325, 0, true), 1, 9, { row: 15 })).toBeUndefined();
    },
  );
  it.each(DEPTH_BOUNDS.map((bounds, depth) => ({ depth, bounds })))(
    "keeps both ranged encounters' identities at depth $depth through casualties",
    ({ depth, bounds }) => {
      for (const [low, high, name, species] of [
        [bounds.beast_weak_lower, bounds.beast_weak_upper, "Minotaur", "minotaur"],
        [bounds.beast_strong_lower, bounds.beast_strong_upper, "Cyclops", "cyclops"],
      ] as const) {
        for (const initial of [low, Math.floor((low + high) / 2), high]) {
          const read = (remaining: number, cleared = false) =>
            readStandingFrontierBeast(facts(StructureType.Beasts, depth, initial, remaining, cleared), 1, 9, {
              row: depth * 10 + 5,
            });
          const identity = read(initial)!;
          expect(identity).toEqual({ beast: species, name, scale: species === "minotaur" ? 0.8 : 1 });
          expect(getStructureModelPaths()[StructureType.Beasts][frontierBeastModelIndex(identity.beast)]).toBe(
            FRONTIER_BEASTS[species].path,
          );
          expect(iconDefinition(beastMeaning(identity.beast)).art).toBe(`beast-${identity.beast}`);
          expect(read(1)).toEqual(identity);
          expect(read(0)).toEqual(identity);
          expect(read(0, true)).toBeUndefined();
        }
      }
    },
  );
  it.each([299, 351, 449, 551])("rejects initial count %s outside both preset bands", (count) => {
    expect(() => readStandingFrontierBeast(facts(StructureType.Beasts, 0, count), 1, 9, { row: 5 })).toThrow(
      "outside its depth ranges",
    );
  });
  it.each([
    { beast_weak_lower: 0 },
    { beast_weak_upper: 299 },
    { beast_strong_lower: 350 },
    { beast_strong_upper: 449 },
  ])("rejects invalid preset bands %j", (invalid) => {
    expect(() => beastBand(scaled(325), { ...DEPTH_BOUNDS[0], ...invalid })).toThrow(
      "positive, separate strength ranges",
    );
  });
  it("requires the depth preset to resolve a beast", () => {
    expect(() =>
      readStandingFrontierBeast(without(facts(StructureType.Beasts), "DepthRules"), 1, 9, { row: 5 }),
    ).toThrow("without depth rules");
  });
  it("has exactly five active species with distinct model and portrait deliveries", () => {
    expect(Object.keys(FRONTIER_BEASTS)).toEqual(["troll", "wyvern", "hydra", "minotaur", "cyclops"]);
    expect(new Set(Object.values(FRONTIER_BEASTS).map((beast) => beast.path)).size).toBe(5);
    expect(
      new Set(
        (Object.keys(FRONTIER_BEASTS) as (keyof typeof FRONTIER_BEASTS)[]).map(
          (beast) => iconDefinition(beastMeaning(beast)).art,
        ),
      ).size,
    ).toBe(5);
  });
  it("does not turn ordinary neutral holdings into Frontier beasts", () => {
    expect(
      readStandingFrontierBeast(without(facts(StructureType.Camp), "ExpeditionSite"), 1, 9, { row: 15 }),
    ).toBeUndefined();
    expect(readStandingFrontierBeast(facts(StructureType.Realm), 1, 9, { row: 15 })).toBeUndefined();
  });
});
