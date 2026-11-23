// @vitest-environment node
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { aspects, ETERNUM_MAP_NAMES, LAYER_NAMES, orders } from "@bibliothecadao/types";
import { ESLint } from "eslint";
import tseslint from "typescript-eslint";
import { describe, expect, it } from "vitest";

import {
  catalogGuardConfigs,
  planCatalogBaseline,
  readAspectAndOrderNames,
  readLayerNames,
} from "../scripts/catalog-guards.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const BASE = {
  files: ["**/*.{ts,tsx}"],
  languageOptions: { parser: tseslint.parser },
  // As CI's lint guards run: a source's own eslint comments switch nothing off.
  linterOptions: { noInlineConfig: true, reportUnusedDisableDirectives: "off" },
};
const guard = new ESLint({ cwd: REPO, overrideConfigFile: true, overrideConfig: [BASE, ...catalogGuardConfigs] });

/** The guard's errors for a source at a real path in the repo, as CI's lint guards count them. */
const hits = async (path, source) => {
  const [result] = await guard.lintText(source, { filePath: resolve(REPO, path) });
  return result.messages.filter((message) => message.fatal || message.severity === 2).map((message) => message.message);
};

const SCREEN = "apps/game/src/ui/features/world/zz-guard-probe.tsx";
const CORE = "packages/core/src/utils/zz-guard-probe.ts";

describe("the layer names the guard refuses", () => {
  const ETERNUM = "\nexport const ETERNUM_MAP_NAMES = [LAYER_NAMES[0], 'Ethereal Layer'] as const;";
  it("are read from the catalog's source, so the guard needs no build and never checks stale names", () => {
    expect(readLayerNames()).toEqual([...LAYER_NAMES, ETERNUM_MAP_NAMES[1]]);
    expect(() => readLayerNames(`export const LAYER_NAMES = layers;${ETERNUM}`)).toThrow("No LAYER_NAMES tuple");
    expect(() => readLayerNames(`export const LAYER_NAMES = [SURFACE, 'Veil'] as const;${ETERNUM}`)).toThrow(
      "No LAYER_NAMES tuple",
    );
    expect(
      readLayerNames(
        `export const LAYER_NAMES = ['Surface', \`Veil\`] as const satisfies readonly string[];${ETERNUM}`,
      ),
    ).toEqual(["Surface", "Veil", "Ethereal Layer"]);
    expect(
      readLayerNames(`export const LAYER_NAMES =\n  [\n    'Surface',\n    "Veil",\n  ] as const;${ETERNUM}`),
    ).toEqual(["Surface", "Veil", "Ethereal Layer"]);
  });

  it("include Eternum's other map name, so its tuple cannot be renamed or emptied out of the guard's sight", () => {
    const layers = "export const LAYER_NAMES = ['Surface'] as const;";
    expect(() => readLayerNames(layers)).toThrow("No ETERNUM_MAP_NAMES tuple");
    expect(() => readLayerNames(`${layers}\nexport const ETERNUM_MAP_NAMES = [LAYER_NAMES[0]] as const;`)).toThrow(
      "No ETERNUM_MAP_NAMES tuple",
    );
    expect(() => readLayerNames(`${layers}\nexport const ETERNUM_MAP_NAMES = [LAYER_NAMES[0], ALT] as const;`)).toThrow(
      "No ETERNUM_MAP_NAMES tuple",
    );
  });

  it("reads Aspect and Order names directly from orders.ts", () => {
    expect(readAspectAndOrderNames()).toEqual({
      aspectNames: aspects.map((aspect) => aspect.name),
      orderNames: orders.map((order) => order.fullOrderName),
    });
  });
});

describe("one source per fact: no copy of a catalog outside its modules", () => {
  it.each([
    ["a list of two structure kinds", "export const BUILDERS = [StructureType.Realm, StructureType.Village];"],
    ["a set of troop tiers", "export const LOW = new Set([TroopTier.T1, TroopTier.T2]);"],
    [
      "a partial map of buildings",
      "export const ICONS: Partial<Record<BuildingType, string>> = { [BuildingType.RationsDepot]: 'a' };",
    ],
    [
      "an untyped map keyed by resources",
      "export const MAKERS = { [ResourcesIds.Wheat]: 1, [ResourcesIds.Labor]: 2 } as const;",
    ],
    [
      "a map held to a partial record",
      "export const M = { [StructureType.Realm]: 1, [StructureType.Camp]: 2 } satisfies Partial<Record<StructureType, number>>;",
    ],
    [
      "a map cast as a whole record, Camp missing (review 1: a cast vouches for nothing)",
      "export const M = { [StructureType.Realm]: 1, [StructureType.Village]: 2 } as Record<StructureType, number>;",
    ],
    [
      "a cast map assigned to a whole record",
      "export const M: Record<StructureType, number> = { [StructureType.Realm]: 1, [StructureType.Village]: 2 } as Record<StructureType, number>;",
    ],
    ["an image path", "export const art = '/images/biomes/ocean.png';"],
    ...LAYER_NAMES.map((name) => [
      `the layer ${name} before a qualification`,
      `export const word = ${JSON.stringify(`${name} (locked)`)};`,
    ]),
    ["a layer's old name", "export const word = 'Ethereal II';"],
    ["Eternum's other map name", `export const word = ${JSON.stringify(`Enter the ${ETERNUM_MAP_NAMES[1]}`)};`],
    ["a layer's name in a template", `export const line = (n: string) => \`\${n} · ${LAYER_NAMES[2]}\`;`],
    ["an image path built in a template", "export const art = (name: string) => `/icons/facets/64/${name}.webp`;"],
    ["a partial map of Aspects", "export const COLORS: Partial<Record<AspectId, string>> = { 1: 'red' };"],
    ["a spelled Aspect name", "export const word = 'Prowess';"],
    ["a spelled Order name", "export const word = 'Order of Giants';"],
  ])("refuses %s", async (_, source) => {
    expect(await hits(SCREEN, source)).toEqual([expect.stringMatching(/^One source per fact/)]);
  });

  it("refuses the same in the shared packages", async () => {
    expect(await hits(CORE, "export const SITES = [StructureType.Ruin, StructureType.Camp];")).toHaveLength(1);
  });

  it.each([
    [
      "a whole record keyed by the catalog",
      "export const W: Record<TroopType, string> = { [TroopType.Knight]: 'a', [TroopType.Paladin]: 'b' };",
    ],
    [
      "a map that satisfies a whole record, through as const",
      "export const W = { [StructureType.Realm]: 1, [StructureType.Camp]: 2 } as const satisfies Record<StructureType, number>;",
    ],
    ["one member", "export const ONLY = [StructureType.Realm];"],
    ["a comparison", "export const isRealm = (c: number) => c === StructureType.Realm || c === StructureType.Village;"],
    ["a route that is not artwork", "export const page = '/play/blitz';"],
    ["a resource named Deep Crystal", "export const word = 'Deep Crystal';"],
    ["a resource's description in sentence case", "export const tip = 'Deep crystal hums underground';"],
    ["a resource in the plural", "export const tip = 'Collect two Deep Crystals';"],
  ])("allows %s", async (_, source) => {
    expect(await hits(SCREEN, source)).toEqual([]);
  });

  it.each([
    ["the catalog's own module", "packages/types/src/constants/zz-guard-probe.ts"],
    ["the names module", "packages/types/src/words/zz-guard-probe.ts"],
    ["a test's scenario", "apps/game/src/ui/features/world/zz-guard-probe.test.ts"],
    ["a lab", "apps/game/src/ui/features/debug/zz-guard-probe.tsx"],
  ])("leaves lists to %s", async (_, path) => {
    expect(await hits(path, "export const L = [StructureType.Realm, StructureType.Village];")).toEqual([]);
  });

  it("counts only files that exist in its baseline, each with at least one copy left", () => {
    const baseline = JSON.parse(readFileSync(resolve(REPO, "apps/game/scripts/catalog-copies-baseline.json"), "utf8"));
    for (const [file, count] of Object.entries(baseline)) {
      expect(() => readFileSync(resolve(REPO, file)), file).not.toThrow();
      expect(count, file).toBeGreaterThan(0);
    }
  });
});

describe("the baseline only falls (review 1: lowering it must never carry a copy in)", () => {
  const BASELINE = { "a.ts": 2, "b.ts": 1 };
  const plan = (counts, lowering = false) => planCatalogBaseline(counts, BASELINE, { lowering });

  it("passes without writing when counts drop or reach zero in a plain check", () => {
    expect(plan({ "a.ts": 1 })).toEqual({ additions: [], write: undefined });
    expect(plan({ "a.ts": 1, "b.ts": 1 })).toEqual({ additions: [], write: undefined });
  });

  it("lowers a file's count when asked to write, dropping a file left with none", () => {
    expect(plan({ "a.ts": 1 }, true)).toEqual({ additions: [], write: { "a.ts": 1 } });
    expect(plan({ "a.ts": 1, "b.ts": 1 }, true)).toEqual({ additions: [], write: { "a.ts": 1, "b.ts": 1 } });
  });

  it("refuses a file over its count, and writes nothing", () => {
    expect(plan({ "a.ts": 3, "b.ts": 1 })).toEqual({ additions: ["a.ts"], write: undefined });
    expect(plan({ "a.ts": 3, "b.ts": 1 }, true)).toEqual({ additions: ["a.ts"], write: undefined });
  });

  it("refuses a file the baseline does not name, and writes nothing", () => {
    expect(plan({ ...BASELINE, "new.ts": 1 })).toEqual({ additions: ["new.ts"], write: undefined });
    expect(plan({ ...BASELINE, "new.ts": 1 }, true)).toEqual({ additions: ["new.ts"], write: undefined });
  });

  it("refuses a cleanup that brings a copy in elsewhere, and writes nothing even when asked to lower", () => {
    expect(plan({ "a.ts": 1, "b.ts": 1, "new.ts": 1 }, true)).toEqual({
      additions: ["new.ts"],
      write: undefined,
    });
  });

  it("passes a tree that matches its baseline, writing nothing", () => {
    expect(plan(BASELINE)).toEqual({ additions: [], write: undefined });
    expect(plan(BASELINE, true)).toEqual({ additions: [], write: undefined });
  });
});
