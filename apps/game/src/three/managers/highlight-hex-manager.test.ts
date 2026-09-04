// @vitest-environment jsdom
import { vi } from "vitest";
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

Object.defineProperty(URL, "createObjectURL", {
  configurable: true,
  value: vi.fn(() => "blob:mock"),
});

const { HighlightHexManager } = await import("./highlight-hex-manager");

describe("HighlightHexManager material ownership", () => {
  it("keeps instanced highlight material state isolated per manager", () => {
    const first = new HighlightHexManager(new THREE.Scene());
    const second = new HighlightHexManager(new THREE.Scene());

    first.updateHighlightPulse(0.2);
    second.updateHighlightPulse(0.8);

    const firstRouteMaterial = (first as any).routeLayer.material as THREE.MeshBasicMaterial;
    const secondRouteMaterial = (second as any).routeLayer.material as THREE.MeshBasicMaterial;
    const firstEndpointMaterial = (first as any).endpointLayer.material as THREE.MeshBasicMaterial;
    const secondEndpointMaterial = (second as any).endpointLayer.material as THREE.MeshBasicMaterial;

    expect(firstRouteMaterial).not.toBe(secondRouteMaterial);
    expect(firstEndpointMaterial).not.toBe(secondEndpointMaterial);
    expect(firstRouteMaterial.opacity).not.toBe(secondRouteMaterial.opacity);
    expect(firstEndpointMaterial.opacity).not.toBe(secondEndpointMaterial.opacity);
  });
});
