// @vitest-environment node
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { QUATERNIUS_PIRATE_SHIP_ASSET, QUATERNIUS_PIRATE_SHIP_MUZZLES } from "./quaternius-pirate-ship-assets";

interface ShipGlbJson {
  animations?: unknown[];
  materials?: unknown[];
  meshes?: Array<{ primitives?: Array<{ indices?: number }> }>;
}

describe("Quaternius pirate ship asset", () => {
  it("ships the audited single-material static combat vessel", () => {
    const glb = readRuntimeGlb();

    expect(glb.meshes).toHaveLength(1);
    expect(glb.materials).toHaveLength(1);
    expect(glb.animations ?? []).toHaveLength(0);
    expect(QUATERNIUS_PIRATE_SHIP_MUZZLES.port).toHaveLength(6);
    expect(QUATERNIUS_PIRATE_SHIP_MUZZLES.starboard).toHaveLength(6);
  });

  it("keeps exact CC0 provenance beside the optimized runtime GLB", () => {
    const asset = readFileSync(resolve(publicRoot(), QUATERNIUS_PIRATE_SHIP_ASSET.url.slice(1)));
    const license = readFileSync(resolve(publicRoot(), "models/boats/quaternius-pirate/LICENSE.asset.txt"), "utf8");

    expect(createHash("sha256").update(asset).digest("hex")).toBe(
      "05fbed64d4bad35a7e0823e90560d9e4b3b213665a4c792d11dac8f521c53db1",
    );
    expect(license).toContain("CC0 1.0 Universal");
    expect(license).toContain("quaternius.com/packs/piratekit.html");
    expect(license).toContain("7f4acd7490bbc3c1ceac9d6a5e0fa9006449884ca148fade96bba7e35eede2e1");
  });
});

function readRuntimeGlb(): ShipGlbJson {
  const buffer = readFileSync(resolve(publicRoot(), QUATERNIUS_PIRATE_SHIP_ASSET.url.slice(1)));
  expect(buffer.toString("utf8", 0, 4)).toBe("glTF");
  expect(buffer.readUInt32LE(16)).toBe(0x4e4f534a);
  const jsonLength = buffer.readUInt32LE(12);
  return JSON.parse(buffer.toString("utf8", 20, 20 + jsonLength)) as ShipGlbJson;
}

function publicRoot(): string {
  return resolve(process.cwd(), "public");
}
