import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";

import { clientDataPlugin } from "./client-data";

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
