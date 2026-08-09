import { describe, expect, test } from "bun:test";
import { fileURLToPath } from "node:url";
import { renderToriiConfig } from "../../../../deploy/appchain/torii-s2/render-config";

const templatePath = fileURLToPath(
  new URL("../../../../deploy/appchain/torii-s2/torii.toml.template", import.meta.url),
);

describe("single-world s2 Torii config", () => {
  test("pins one s2 world without registry discovery or exclusions", async () => {
    const rendered = renderToriiConfig(await Bun.file(templatePath).text(), {
      rpcUrl: "http://katana:5050",
      dbDir: "/data/torii-db-v1",
      worldAddress: "0x123",
    });

    expect(rendered.match(/WORLD:/g)).toHaveLength(1);
    expect(rendered).toContain('"WORLD:0x123"');
    expect(rendered).toContain('namespaces = ["s2_blitz"]');
    expect(rendered).toContain("world_block = 0");
    expect(rendered).toContain("pending = true");
    expect(rendered).toContain("pre_confirmed = true");
    expect(rendered).toContain("controllers = true");
    expect(rendered).not.toContain("world_registry_models");
    expect(rendered).not.toContain("exclude");
    expect(rendered).not.toContain("s1_eternum");
  });

  test("rejects unsafe TOML substitutions", () => {
    expect(() =>
      renderToriiConfig('rpc = "{RPC_URL}"', {
        rpcUrl: 'http://localhost:5050"\nworld = "bad',
        dbDir: "/data",
        worldAddress: "0x1",
      }),
    ).toThrow("unsafe in a TOML string");
  });
});
