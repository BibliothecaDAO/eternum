// @vitest-environment node
import { existsSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { ICY_DRAGON_ASSET_URL } from "./icy-dragon-assets";

const publicDirectory = fileURLToPath(new URL("../../../../public/", import.meta.url));
const assetPath = `${publicDirectory}${ICY_DRAGON_ASSET_URL.slice(1)}`;
const assetDirectory = `${publicDirectory}models/characters/icy-dragon/`;

describe("Icy dragon source asset", () => {
  it("ships the licensed Sketchfab glTF with its attribution and modification record", () => {
    expect(existsSync(assetPath)).toBe(true);
    expect(statSync(`${assetDirectory}scene.bin`).size).toBeGreaterThan(6_000_000);
    expect(readFileSync(`${assetDirectory}license.txt`, "utf8")).toContain("CC-BY-4.0");
    expect(readFileSync(`${assetDirectory}license.txt`, "utf8")).toContain("chengzijieczj");
    const attribution = readFileSync(`${assetDirectory}ATTRIBUTION.md`, "utf8");
    expect(attribution).toContain("2db9268227b943e6a41e88390f2875a6");
    expect(attribution).toContain("1024 × 1024");
  });
});
