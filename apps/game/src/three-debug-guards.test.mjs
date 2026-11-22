import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";
import tseslint from "typescript-eslint";
import { describe, expect, it } from "vitest";

import { threeDebugGuardConfigs } from "../scripts/three-debug-guards.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const BASE = {
  files: ["**/*.{ts,tsx}"],
  languageOptions: { parser: tseslint.parser },
  linterOptions: { noInlineConfig: true, reportUnusedDisableDirectives: "off" },
};
const guard = new ESLint({ cwd: REPO, overrideConfigFile: true, overrideConfig: [BASE, ...threeDebugGuardConfigs] });

const hits = async (source, path) => {
  const [result] = await guard.lintText(source, { filePath: resolve(REPO, "apps/game/src", path) });
  return result.messages.filter((message) => message.fatal || message.severity === 2).map((message) => message.message);
};

describe("no production module imports three/debug", () => {
  it.each([
    [
      "a static alias import in a feature screen",
      `import { mountProceduralTerrainDebugRenderer } from "@/three/debug/procedural-terrain-debug-renderer";`,
      "ui/features/frontier/aspect/zz-guard.tsx",
    ],
    [
      "a dynamic import in a feature screen",
      `export const load = () => import("@/three/debug/procedural-terrain-debug-renderer");`,
      "ui/features/frontier/aspect/zz-guard.tsx",
    ],
    [
      "a relative import from three/scenes",
      `import { createLocalTerrainLabRequest } from "../debug/local-terrain-lab";`,
      "three/scenes/zz-guard.ts",
    ],
    [
      "a re-export from shell",
      `export { DEFAULT_TERRAIN_LAB_PREVIEW } from "@/three/debug/terrain-lab-preview";`,
      "shell/zz-guard.ts",
    ],
  ])("refuses %s", async (_, source, path) => {
    const found = await hits(source, path);
    expect(found.length).toBeGreaterThan(0);
    expect(found.every((message) => message.startsWith("Production modules cannot import three/debug"))).toBe(true);
  });

  it.each([
    ["ui/features/debug", "ui/features/debug/zz-guard.tsx"],
    ["lab", "lab/studio/zz-guard.ts"],
    ["three/debug", "three/debug/zz-guard.ts"],
    ["a unit test", "three/scenes/zz-guard.test.ts"],
  ])("allows %s", async (_, path) => {
    const source = `import { mountProceduralTerrainDebugRenderer } from "@/three/debug/procedural-terrain-debug-renderer";`;
    expect(await hits(source, path)).toEqual([]);
  });
});
