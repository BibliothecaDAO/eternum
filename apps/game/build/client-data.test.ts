import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
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

describe("native release selection", () => {
  const release = {
    world: { address: "0x101", abi: [] },
    contracts: [],
    abis: ["deployment-only"],
    native: {
      activeSchema: "current",
      schemas: { current: { models: [] } },
      domains: { season: { address: "0x101" } },
    },
  };
  const configure = (document: unknown) => {
    const directory = mkdtempSync(join(tmpdir(), "native-release-"));
    const file = join(directory, "manifest.json");
    writeFileSync(file, JSON.stringify(document));
    try {
      const hook = clientDataPlugin(file).config as () => { define: Record<string, string> };
      return hook();
    } finally {
      rmSync(directory, { recursive: true });
    }
  };

  it("embeds the release's addresses and schema together without deployment-only ABI data", () => {
    const embedded = JSON.parse(configure(release).define.__NATIVE_WORLD_MANIFEST__);
    expect(embedded.world).toEqual(release.world);
    expect(embedded.native).toEqual(release.native);
    expect(embedded).not.toHaveProperty("abis");
  });
  it("rejects a missing release instead of selecting the old world", () => {
    const hook = clientDataPlugin().config as () => unknown;
    expect(hook).toThrow("NATIVE_WORLD_MANIFEST");
  });
  it("rejects a missing schema or mismatched authenticated entrypoint", () => {
    expect(() => configure({ ...release, native: {} })).toThrow("active schema");
    expect(() => configure({ ...release, world: { address: "0x999" } })).toThrow("season entrypoint");
  });
});
