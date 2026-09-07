import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { clientDataPlugin } from "./client-data";

const transform = (relative: string) => {
  const path = resolve(process.cwd(), "../..", relative);
  const source = readFileSync(path, "utf8");
  const plugin = clientDataPlugin();
  const hook = plugin.transform as (source: string, id: string) => { code: string } | null;
  return { original: JSON.parse(source), result: JSON.parse(hook(source, path)!.code) };
};

describe("browser deployment data boundary", () => {
  it.each(["blitz.madara", "blitz.appchain", "eternum.appchain"])(
    "preserves every balance value in %s while excluding deployment setup",
    (name) => {
      const { original, result } = transform(`config/generated/${name}.json`);
      expect(original.configuration.setup.manifest).toBeDefined();
      expect(result.configuration).not.toHaveProperty("setup");
      for (const [key, value] of Object.entries(original.configuration)) {
        if (key !== "setup") expect(result.configuration[key], key).toEqual(value);
      }
    },
  );

  it.each(["madara", "appchain_blitz", "appchain_eternum"])(
    "preserves provider ABIs and all manifest metadata in %s",
    (chain) => {
      const { original, result } = transform(`contracts/l3/game/manifest_${chain}.json`);
      expect(original.abis.length).toBeGreaterThan(0);
      expect(result).not.toHaveProperty("abis");
      expect(result.world.abi.length).toBeGreaterThan(0);
      for (const [key, value] of Object.entries(original)) {
        if (key !== "abis") expect(result[key], key).toEqual(value);
      }
    },
  );

  it("does not transform unrelated JSON or raw asset requests", () => {
    const hook = clientDataPlugin().transform as (source: string, id: string) => unknown;
    expect(hook("{}", "/other/config.json")).toBeNull();
    expect(hook("{}", "/contracts/l3/game/manifest_madara.json?raw")).toBeNull();
    expect(() => hook("{}", "/config/generated/blitz.madara.json")).toThrow("configuration object");
  });
});
