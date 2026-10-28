// @vitest-environment node
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";
import tseslint from "typescript-eslint";
import { describe, expect, it } from "vitest";

import { catalogGuardConfigs, planCatalogBaseline } from "../scripts/catalog-guards.mjs";

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

describe("one source per fact: no copy of a catalog outside its modules", () => {
  it.each([
    ["a list of two structure kinds", "export const BUILDERS = [StructureType.Realm, StructureType.Village];"],
    ["a set of troop tiers", "export const LOW = new Set([TroopTier.T1, TroopTier.T2]);"],
    [
      "a partial map of buildings",
      "export const ICONS: Partial<Record<BuildingType, string>> = { [BuildingType.WarHall]: 'a' };",
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
    ["an image path built in a template", "export const art = (name: string) => `/icons/facets/64/${name}.webp`;"],
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
  const lower = (counts) => planCatalogBaseline(counts, BASELINE, { lowering: true });

  it("lowers a file's count when a copy is removed, and drops a file left with none", () => {
    expect(lower({ "a.ts": 1 })).toEqual({ additions: [], unlowered: [], write: { "a.ts": 1 } });
  });

  it("asks for the lowering when a copy is removed and the run does not lower", () => {
    expect(planCatalogBaseline({ "a.ts": 1, "b.ts": 1 }, BASELINE)).toEqual({
      additions: [],
      unlowered: ["a.ts"],
      write: undefined,
    });
  });

  it("refuses a file over its count, and writes nothing", () => {
    expect(lower({ "a.ts": 3, "b.ts": 1 })).toEqual({ additions: ["a.ts"], unlowered: [], write: undefined });
  });

  it("refuses a file the baseline does not name, and writes nothing", () => {
    expect(lower({ ...BASELINE, "new.ts": 1 })).toEqual({ additions: ["new.ts"], unlowered: [], write: undefined });
  });

  it("refuses a cleanup that brings a copy in elsewhere, writing nothing and still asking for the cleanup's lowering", () => {
    expect(lower({ "a.ts": 1, "b.ts": 1, "new.ts": 1 })).toEqual({
      additions: ["new.ts"],
      unlowered: ["a.ts"],
      write: undefined,
    });
  });

  it("passes a tree that matches its baseline, writing nothing", () => {
    expect(lower(BASELINE)).toEqual({ additions: [], unlowered: [], write: undefined });
  });
});
