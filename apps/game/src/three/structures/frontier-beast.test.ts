import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";

import { beastMeaning } from "@/ui/design-system/domain-icon-meaning";
import { iconDefinition } from "@/ui/design-system/icon-meaning";
import { describe, expect, it } from "vitest";
import { basename } from "node:path";
import {
  BEASTS,
  DEEP_BEASTS,
  RESOURCE_PRECISION,
  StructureType,
  beastModel,
  beastsOfFamily,
  type BeastRow,
} from "@bibliothecadao/types";
import { getStructureModelPaths } from "../constants/scene-constants";
import { getGameModeConfig } from "@/config/game-modes";
import { GAME_FAMILIES } from "../../../../../config/source/common/native-preset-modes";
import { resolveStructureRotationY } from "./structure-orientation";
import {
  FRONTIER_BEASTS,
  beastBand,
  frontierBeast,
  frontierBeastModelIndex,
  readStandingFrontierBeast,
  frontierSiteComposition,
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
      category,
      initial_guard_count: scaled(initialCount),
      row: depth * 10 + 5,
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
  it("fits the painted rift to all six terrain edges and corners at its live composition", async () => {
    const { createDecoderModule } = createRequire(import.meta.url)("draco3dgltf");
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
      "draco3d.decoder": await createDecoderModule(),
    });
    const paths = getGameModeConfig(GAME_FAMILIES.frontier).assets.structureModelPaths[StructureType.Rift];
    const root = (await io.readBinary(readFileSync(new URL(`../../../public${paths[0]}`, import.meta.url)))).getRoot();
    const composition = frontierSiteComposition(StructureType.Rift);
    const points = root.listMeshes().flatMap((mesh) =>
      mesh.listPrimitives().flatMap((primitive) => {
        const positions = primitive.getAttribute("POSITION")!;
        return Array.from({ length: positions.getCount() }, (_, index) => {
          const [x, , z] = positions.getElement(index, [0, 0, 0]);
          return [x * composition.baseScale, z * composition.baseScale + composition.baseZ];
        });
      }),
    );
    for (let direction = 0; direction < 6; direction++) {
      expect(resolveStructureRotationY([paths[0], FRONTIER_BEASTS["dark-fey"].path], (direction * Math.PI) / 3)).toBe(
        0,
      );
      const angle = (direction * Math.PI) / 3;
      const edge = Math.max(...points.map(([x, z]) => x * Math.cos(angle) + z * Math.sin(angle)));
      expect(edge).toBeCloseTo(Math.sqrt(3) / 2, 2);
      const corner = angle + Math.PI / 6;
      expect(Math.min(...points.map(([x, z]) => Math.hypot(x - Math.cos(corner), z - Math.sin(corner))))).toBeLessThan(
        0.015,
      );
    }
  });

  it("ships exactly the models the beast tables stand on, the Deep's beasts included", () => {
    const species = [...new Set([...Object.values(BEASTS), ...Object.values(DEEP_BEASTS)].map(beastModel))].sort();
    expect(Object.keys(FRONTIER_BEASTS).sort()).toEqual(species);
    const deliveries = readdirSync(new URL("../../../public/models/frontier", import.meta.url), {
      recursive: true,
      encoding: "utf8",
    })
      .filter((file) => file.endsWith(".glb") && basename(file).startsWith("beast-"))
      .sort();
    expect(deliveries).toEqual(species.map((beast) => basename(FRONTIER_BEASTS[beast].path)).sort());
  });

  it("keeps one editable sculpt per legacy beast, without retired study sources", async () => {
    const { createDecoderModule } = createRequire(import.meta.url)("draco3dgltf");
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
      "draco3d.decoder": await createDecoderModule(),
    });
    const legacySpecies: string[] = [];
    for (const [species, entry] of Object.entries(FRONTIER_BEASTS)) {
      const root = (
        await io.readBinary(readFileSync(new URL(`../../../public${entry.path}`, import.meta.url)))
      ).getRoot();
      const tripo = root.listNodes().some((node) => node.getMesh() && node.getExtras()?.assetKind === "beast");
      if (!tripo) legacySpecies.push(species);
    }
    const sources = readdirSync(new URL("../../../asset-sources/frontier-beasts", import.meta.url), {
      recursive: true,
      encoding: "utf8",
    })
      .filter((file) => file.endsWith(".blend"))
      .sort();
    expect(sources).toEqual(legacySpecies.map((species) => `refined/${species}.blend`).sort());
  });

  it("keeps one ruin beast a layer and refuses a layer the table has no beast for", () => {
    expect([0, 1, 2].map((depth) => frontierBeast(depth).name)).toEqual(["Wyvern", "Ammit", "Minotaur"]);
    expect(() => frontierBeast(3)).toThrow("No ruin beast on layer 3");
    expect(() => frontierBeast(3, StructureType.Camp)).toThrow("No camp beast on layer 3");
    expect(() => frontierBeast(0, StructureType.Realm)).toThrow("No Frontier beast guards structure category");
    expect(() => frontierBeast(0, StructureType.Beasts)).toThrow("initial strength band");
  });
  it("reads the fourth personal layer's row, what Season 0 drew there, in a game without a Deep only", () => {
    const withDeep = (store: ReturnType<typeof facts>) => {
      const original = store as { get: (model: string) => unknown };
      return { get: (model: string) => (model === "DeepRules" ? { game_id: 1 } : original.get(model)) } as never;
    };
    const fourth = (category: StructureType, initialCount = 325) => facts(category, 3, initialCount);
    expect(readStandingFrontierBeast(fourth(StructureType.Camp), 1, 9)).toEqual({
      beast: "troll",
      name: "Troll",
      scale: 0.85,
      idle: BEASTS.troll.idle,
    });
    expect(readStandingFrontierBeast(fourth(StructureType.Rift), 1, 9)).toEqual({
      beast: "dark-fey",
      name: "Dark fey",
      scale: 0.75,
      idle: { motion: "hover" },
    });
    expect(readStandingFrontierBeast(fourth(StructureType.Ruin), 1, 9)).toEqual({
      beast: "hydra",
      name: "Hydra",
      scale: 1.2,
      idle: BEASTS.hydra.idle,
    });
    expect(readStandingFrontierBeast(fourth(StructureType.Beasts, 6_500), 1, 9)).toEqual({
      beast: "cyclops",
      name: "Cyclops",
      scale: 1,
      idle: BEASTS.cyclops.idle,
    });
    expect(readStandingFrontierBeast(fourth(StructureType.Beasts, 10_000), 1, 9)).toEqual({
      beast: "wraith",
      name: "Wraith",
      scale: 1,
      idle: BEASTS.wraith.idle,
    });
    expect(() => readStandingFrontierBeast(withDeep(fourth(StructureType.Ruin)), 1, 9)).toThrow(
      "No ruin beast on layer 3",
    );
    expect(readStandingFrontierBeast(withDeep(facts(StructureType.Ruin, 2)), 1, 9)?.name).toBe("Minotaur");
  });
  it("gives every beast its own idle line, the fey hovering and the beasts standing in for it breathing", () => {
    const rows = Object.values<BeastRow>(BEASTS);
    expect(rows.map(({ name, idle }) => `${name} ${idle.motion}`)).toEqual([
      "Cyclops breath",
      "Hydra breath",
      "Tarrasque breath",
      "Wraith lift",
      "Banshee lift",
      "Lich lift",
      "Troll breath",
      "Golem breath",
      "Ettin breath",
      "Fairy hover",
      "Kappa breath",
      "Kitsune breath",
      "Wyvern breath",
      "Ammit breath",
      "Minotaur breath",
    ]);
    expect([BEASTS.kappa, BEASTS.kitsune].map(beastModel)).toEqual(["kappa", "kitsune"]);
    for (const { idle } of rows) if (idle.motion !== "hover") expect(idle.height).toBeLessThanOrEqual(0.028);
  });
  it("names each family's beast by layer, a stronger Loot Survivor tier deeper", () => {
    const named = (family: Parameters<typeof beastsOfFamily>[0]) => beastsOfFamily(family).map(({ name }) => name);
    expect(named("herd")).toEqual(["Cyclops", "Hydra", "Tarrasque"]);
    expect(named("band")).toEqual(["Wraith", "Banshee", "Lich"]);
    expect(named("camp")).toEqual(["Troll", "Golem", "Ettin"]);
    expect(named("rift")).toEqual(["Fairy", "Kappa", "Kitsune"]);
    expect(named("ruin")).toEqual(["Wyvern", "Ammit", "Minotaur"]);
  });
  it.each([StructureType.Camp, StructureType.Rift, StructureType.Ruin])(
    "uses the same live identity to select model and label for site %s",
    (category) => {
      const identity = readStandingFrontierBeast(facts(category, 1), 1, 9)!;
      expect(identity.name).toBe(
        category === StructureType.Camp ? "Golem" : category === StructureType.Rift ? "Kappa" : "Ammit",
      );
      expect(getStructureModelPaths()[category][frontierBeastModelIndex(identity.beast)]).toBe(
        FRONTIER_BEASTS[identity.beast].path,
      );
      expect(readStandingFrontierBeast(facts(category, 1, 325, 0, true), 1, 9)).toBeUndefined();
    },
  );
  it.each([
    [0, BEASTS.troll, BEASTS.fairy],
    [1, BEASTS.golem, BEASTS.kappa],
    [2, BEASTS.ettin, BEASTS.kitsune],
  ])("keeps camps beast-only and rifts fey-guarded at layer %s", (depth, camp, rift) => {
    expect(readStandingFrontierBeast(facts(StructureType.Camp, depth), 1, 9)).toEqual({
      beast: beastModel(camp),
      name: camp.name,
      scale: 0.85,
      idle: camp.idle,
    });
    expect(frontierSiteComposition(StructureType.Camp).baseScale).toBe(0);
    expect(readStandingFrontierBeast(facts(StructureType.Rift, depth), 1, 9)).toEqual({
      beast: beastModel(rift),
      name: rift.name,
      scale: 0.75,
      idle: rift.idle,
    });
    expect(frontierSiteComposition(StructureType.Rift)).toEqual({ baseScale: 1.09, baseZ: 0, beastZ: 0, beastY: 0.2 });
  });
  it.each(DEPTH_BOUNDS.slice(0, 3).map((bounds, depth) => ({ depth, bounds })))(
    "keeps both roaming encounters' identities at layer $depth through casualties",
    ({ depth, bounds }) => {
      const herd = beastsOfFamily("herd")[depth];
      const band = beastsOfFamily("band")[depth];
      for (const [low, high, { name, scale, idle }, species] of [
        [bounds.beast_weak_lower, bounds.beast_weak_upper, herd, beastModel(herd)],
        [bounds.beast_strong_lower, bounds.beast_strong_upper, band, beastModel(band)],
      ] as const) {
        for (const initial of [low, Math.floor((low + high) / 2), high]) {
          const read = (remaining: number, cleared = false) =>
            readStandingFrontierBeast(facts(StructureType.Beasts, depth, initial, remaining, cleared), 1, 9);
          const identity = read(initial)!;
          expect(identity).toEqual({ beast: species, name, scale, idle });
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
    expect(() => readStandingFrontierBeast(facts(StructureType.Beasts, 0, count), 1, 9)).toThrow(
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
    expect(() => readStandingFrontierBeast(without(facts(StructureType.Beasts), "DepthRules"), 1, 9)).toThrow(
      "without depth rules",
    );
  });
  it("gives every species its own model and portrait delivery", () => {
    const species = Object.keys(FRONTIER_BEASTS) as (keyof typeof FRONTIER_BEASTS)[];
    expect(new Set(Object.values(FRONTIER_BEASTS).map((beast) => beast.path)).size).toBe(species.length);
    expect(new Set(species.map((beast) => iconDefinition(beastMeaning(beast)).art)).size).toBe(species.length);
  });
  it("does not turn ordinary neutral holdings into Frontier beasts", () => {
    expect(readStandingFrontierBeast(without(facts(StructureType.Camp), "ExpeditionSite"), 1, 9)).toBeUndefined();
    expect(readStandingFrontierBeast(facts(StructureType.Realm), 1, 9)).toBeUndefined();
  });
});

describe("the feature map's beast guards", () => {
  const section = readFileSync(new URL("../../../FEATURE-MAP.md", import.meta.url), "utf8")
    .split("## Frontier beast guards")[1]
    .split("\n## ")[0]
    .replace(/\s+/g, " ");

  it("names the Surface's beasts only, leaving the layers below to the table, and each roaming band's beast", () => {
    const named = Object.values(BEASTS).filter(({ name }) => section.includes(name));
    expect(named.filter(({ layer }) => layer !== 0)).toEqual([]);
    expect(named.map(({ family }) => family).sort()).toEqual(["band", "camp", "herd", "rift", "ruin"]);
    for (const band of ["lowly", "stronger"] as const) {
      const { name } = frontierBeast(0, StructureType.Beasts, band);
      expect(section).toContain(`${name} for the ${band} encounter`);
    }
  });
});
