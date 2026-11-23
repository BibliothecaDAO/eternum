import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";
import tseslint from "typescript-eslint";
import { describe, expect, it } from "vitest";

import { modelUrlGuardConfigs } from "../scripts/model-url-guards.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const BASE = {
  files: ["**/*.{ts,tsx}"],
  languageOptions: { parser: tseslint.parser },
  linterOptions: { noInlineConfig: true, reportUnusedDisableDirectives: "off" },
};
const guard = new ESLint({ cwd: REPO, overrideConfigFile: true, overrideConfig: [BASE, ...modelUrlGuardConfigs] });

const hits = async (source, path) => {
  const [result] = await guard.lintText(source, { filePath: resolve(REPO, "apps/game/src", path) });
  return result.messages.filter((message) => message.fatal || message.severity === 2).map((message) => message.message);
};

describe("model URLs come from model-url.ts and never bypass fetchModel", () => {
  it.each([
    ["a literal /models/ path", `export const p = "/models/terrain-flora/manifest.json";`, "three/terrain/zz-guard.ts"],
    ["a template /models/ path", "export const p = `/models/realms/${id}.glb`;", "three/structures/zz-guard.ts"],
    ["bare fetch(modelPath(...))", `export const load = () => fetch(modelPath("a.glb"));`, "three/terrain/zz-guard.ts"],
    ["bare fetch(modelUrl(...))", `export const load = () => fetch(modelUrl(p));`, "three/terrain/zz-guard.ts"],
    [
      "bare fetch of a MANIFEST_PATH constant",
      `export const load = () => fetch(TERRAIN_FLORA_MANIFEST_PATH);`,
      "three/terrain/zz-guard.ts",
    ],
    [
      "bare fetch through a helper parameter inside src/three",
      `export const fetchJson = (path: string) => fetch(path);`,
      "three/debug/zz-guard.ts",
    ],
  ])("refuses %s", async (_, source, path) => {
    const found = await hits(source, path);
    expect(found.length).toBeGreaterThan(0);
  });

  it("allows modelPath and fetchModel in client modules, and raw /models/ only in model-url.ts or tests", async () => {
    expect(
      await hits(
        `export const p = modelPath("terrain-flora/manifest.json"); export const load = () => fetchModel(p);`,
        "three/terrain/zz-guard.ts",
      ),
    ).toEqual([]);
    expect(await hits(`export const MODEL_ROOT = "/models/";`, "three/utils/model-url.ts")).toEqual([]);
    expect(await hits(`export const p = "/models/realms/city.glb";`, "three/terrain/zz-guard.test.ts")).toEqual([]);
    expect(await hits(`export const s = "/lab/rss-icons/models/wheat.png";`, "ui/features/debug/zz-guard.tsx")).toEqual(
      [],
    );
  });
});
