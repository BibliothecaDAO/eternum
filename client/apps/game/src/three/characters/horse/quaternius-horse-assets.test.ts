// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  QUATERNIUS_HORSE_ASSET,
  QUATERNIUS_HORSE_BONES,
  QUATERNIUS_HORSE_REFERENCE_CLIPS,
} from "./quaternius-horse-assets";

interface HorseGlbJson {
  animations?: Array<{ name?: string }>;
  materials?: unknown[];
  nodes?: Array<{ name?: string }>;
  skins?: Array<{ joints?: number[] }>;
}

describe("Quaternius horse asset", () => {
  it("ships the audited 50-joint skin and every required procedural control bone", () => {
    const glb = readRuntimeGlb();
    const names = new Set(glb.nodes?.map(({ name }) => normalizeThreeNodeName(name ?? "")));

    expect(glb.skins).toHaveLength(1);
    expect(glb.skins?.[0].joints).toHaveLength(50);
    expect(Object.values(QUATERNIUS_HORSE_BONES).filter((name) => !names.has(name))).toEqual([]);
  });

  it("keeps the authored clips as gym references and flat-color material roles", () => {
    const glb = readRuntimeGlb();
    expect(glb.animations?.map(({ name }) => name)).toEqual(QUATERNIUS_HORSE_REFERENCE_CLIPS);
    expect(glb.materials).toHaveLength(8);
  });

  it("keeps CC0 provenance beside the runtime asset", () => {
    const license = readFileSync(resolve(publicRoot(), "models/characters/quaternius-horse/LICENSE.asset.txt"), "utf8");
    expect(license).toContain("CC0 1.0 Universal");
    expect(license).toContain("quaternius.com/packs/ultimateanimatedanimals.html");
    expect(license).toContain("3deb61550dff1d2786d04b6e8559d63ad3907d6ab606ba28ce0af074ed96341b");
  });
});

function readRuntimeGlb(): HorseGlbJson {
  const buffer = readFileSync(resolve(publicRoot(), QUATERNIUS_HORSE_ASSET.url.slice(1)));
  expect(buffer.toString("utf8", 0, 4)).toBe("glTF");
  expect(buffer.readUInt32LE(16)).toBe(0x4e4f534a);
  const jsonLength = buffer.readUInt32LE(12);
  return JSON.parse(buffer.toString("utf8", 20, 20 + jsonLength)) as HorseGlbJson;
}

function normalizeThreeNodeName(name: string): string {
  return ["[", "]", ".", ":", "/"].reduce((normalized, character) => normalized.replaceAll(character, ""), name);
}

function publicRoot(): string {
  return resolve(process.cwd(), "../../public");
}
