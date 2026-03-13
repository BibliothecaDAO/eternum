// @vitest-environment jsdom
import { vi } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import * as THREE from "three";

vi.mock("@bibliothecadao/eternum", () => {
  const scalar = new Proxy(
    {},
    {
      get: (_, key) => key,
    },
  );

  return new Proxy(
    {
      ActionType: {
        Explore: "Explore",
        Move: "Move",
        Attack: "Attack",
        Help: "Help",
        Build: "Build",
        Quest: "Quest",
        Chest: "Chest",
        CreateArmy: "CreateArmy",
      },
      FELT_CENTER: 0,
    } as Record<string, unknown>,
    {
      get: (target, prop) => (prop in target ? target[prop as string] : scalar),
      has: () => true,
    },
  );
});

vi.mock("@bibliothecadao/types", () => {
  const enumProxy = new Proxy(
    {},
    {
      get: (_, key) => key,
    },
  );

  return new Proxy(
    {
      TroopTier: { T1: "T1", T2: "T2", T3: "T3" },
      TroopType: { Knight: "Knight", Crossbowman: "Crossbowman", Paladin: "Paladin" },
      StructureType: { Realm: "Realm", Hyperstructure: "Hyperstructure", Bank: "Bank", FragmentMine: "FragmentMine" },
      ResourcesIds: { StaminaRelic1: 1, Copper: 2, ColdIron: 3 },
      BiomeType: enumProxy,
      BuildingType: enumProxy,
      RealmLevelNames: enumProxy,
      RealmLevels: enumProxy,
      ResourceMiningTypes: enumProxy,
    } as Record<string, unknown>,
    {
      get: (target, prop) => (prop in target ? target[prop as string] : enumProxy),
      has: () => true,
    },
  );
});

Object.defineProperty(navigator, "getBattery", {
  configurable: true,
  value: vi.fn(async () => ({ charging: true })),
});

const { HighlightHexManager } = await import("./highlight-hex-manager");

function readShaderSource(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, "..", "shaders", "highlight-hex-material.ts"), "utf8");
}

describe("HighlightHexManager material ownership", () => {
  it("keeps instanced highlight material state isolated per manager", () => {
    const first = new HighlightHexManager(new THREE.Scene());
    const second = new HighlightHexManager(new THREE.Scene());

    first.updateHighlightPulse(0.2);
    second.updateHighlightPulse(0.8);

    const firstMaterial = (first as any).material as THREE.ShaderMaterial;
    const secondMaterial = (second as any).material as THREE.ShaderMaterial;

    expect(firstMaterial).not.toBe(secondMaterial);
    expect(firstMaterial.uniforms.opacity.value).toBe(0.2);
    expect(secondMaterial.uniforms.opacity.value).toBe(0.8);
  });

  it("creates highlight materials through a factory instead of exporting a singleton", () => {
    const source = readShaderSource();

    expect(source).toMatch(/export function createHighlightHexInstancedMaterial\(/);
    expect(source).not.toMatch(/export const highlightHexInstancedMaterial = new ShaderMaterial/);
  });
});
